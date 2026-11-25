import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Evals } from "../shared/contracts.js";
import type { DockerCli } from "./docker-cli.js";
import { allowedHosts, type IsolationConfig } from "./isolation-config.js";
import { ensureImage, type RunnerImageSpec } from "./runner-image.js";

/** Label keys on everything the engine creates, so leftovers can be found and removed. */
export const LABELS = {
  run: "iointel-evals.run",
  role: "iointel-evals.role",
  pid: "iointel-evals.pid",
  host: "iointel-evals.host",
} as const;

/** Shared by every runner container: npm's cache is content-addressed, so sharing it is safe. */
export const NPM_CACHE_VOLUME = "iointel-evals-npm-cache";

const ROOT = "/home/node/project";
const PROXY_ALIAS = "egress-proxy";
const PROXY_PORT = 3128;
const PROXY_URL = `http://${PROXY_ALIAS}:${PROXY_PORT}`;
/** Left out of the copy a container's workdir gets on the host. */
const SNAPSHOT_EXCLUDES = ["node_modules"];

/** Environment variables an agent process may receive by name (credentials). */
export const CREDENTIAL_ENV = [
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
] as const;

/** Never forwarded into a container: they describe this machine, not the agent. */
const HOST_ONLY_ENV = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
  "PWD",
  "OLDPWD",
  "SHELL",
  "USER",
  "USERNAME",
  "HOSTNAME",
  "COMSPEC",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "NODE_OPTIONS",
  "CODEX_HOME",
  "CLAUDE_CONFIG_DIR",
]);

/** Set in every runner container: route traffic through the proxy, and keep agent tools quiet. */
const STATIC_ENV: Readonly<Record<string, string>> = {
  HTTP_PROXY: PROXY_URL,
  HTTPS_PROXY: PROXY_URL,
  http_proxy: PROXY_URL,
  https_proxy: PROXY_URL,
  NO_PROXY: "localhost,127.0.0.1",
  no_proxy: "localhost,127.0.0.1",
  // Node's own fetch ignores proxy variables unless told otherwise.
  NODE_USE_ENV_PROXY: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  DISABLE_AUTOUPDATER: "1",
  npm_config_update_notifier: "false",
  npm_config_fund: "false",
};

/** What a run's agents need to authenticate inside a container. */
export interface CredentialPlan {
  /** Reasons the run can't start (e.g. no credential a container can use). */
  readonly problems: readonly string[];
  /** Host files copied into every runner container (box path is absolute). */
  readonly files: readonly { readonly host: string; readonly box: string }[];
  /** Lines worth printing once (e.g. which fallback is in use). */
  readonly notes: readonly string[];
}

export interface ContainerSandboxOptions {
  readonly docker: DockerCli;
  readonly image: RunnerImageSpec;
  readonly config: IsolationConfig;
  /** Host folder for each run's copy of its workdir (the snapshot). */
  readonly workdirRoot: string;
  /** Keep the host snapshot after the run (--keep-workdirs). */
  readonly keep?: boolean;
  /** Decides how the targets' agents authenticate; called once in start(). */
  readonly credentials: (tools: readonly string[]) => CredentialPlan;
  readonly log?: (line: string) => void;
  /** Fixed in tests; random otherwise. */
  readonly runId?: string;
  /** Whether a process of this machine is still alive (tests replace it). */
  readonly isAlive?: (pid: number) => boolean;
}

/**
 * --isolation container. One eval run gets an internal Docker network whose only way out is an
 * allowlisting proxy container. Each unit gets a fresh runner container on that network, removed
 * after its files are copied out. See README "Container isolation".
 */
export class ContainerSandbox implements Evals.Sandbox.Provider {
  public readonly isolation = "container";
  public readonly runId: string;
  private readonly log: (line: string) => void;
  private readonly labels: string[];
  private image: string | undefined;
  private proxy: EgressProxy | undefined;
  private credentialFiles: CredentialPlan["files"] = [];
  private seq = 0;
  /** Runner containers not yet closed, removed by stop() (e.g. on Ctrl-C). */
  private readonly running = new Set<string>();

  public constructor(private readonly options: ContainerSandboxOptions) {
    this.runId = options.runId ?? randomBytes(4).toString("hex");
    this.log = options.log ?? (() => {});
    this.labels = labelArgs({
      [LABELS.run]: this.runId,
      [LABELS.pid]: String(process.pid),
      [LABELS.host]: os.hostname(),
    });
  }

  /** Checks Docker and credentials, removes leftovers, builds the image, starts the proxy. */
  public async start(tools: readonly string[]): Promise<void> {
    const { docker } = this.options;
    const version = await docker.run(
      ["version", "--format", "{{.Server.Version}}"],
      { timeoutMs: 30_000 },
    );
    if (version.code !== 0)
      throw new Error(
        `--isolation container needs a running Docker daemon, and \`docker version\` failed. Start Docker Desktop and try again.\n${version.stderr.trim()}`,
      );

    const plan = this.options.credentials(tools);
    if (plan.problems.length) throw new Error(plan.problems.join("\n"));
    plan.notes.forEach((n) => this.log(n));
    this.credentialFiles = plan.files;

    await this.removeLeftovers();
    this.image = await ensureImage(docker, this.options.image, this.log);
    await mustSucceed(
      docker.run([
        "volume",
        "create",
        "--label",
        `${LABELS.role}=npm-cache`,
        NPM_CACHE_VOLUME,
      ]),
      "create the npm cache volume",
    );
    this.proxy = new EgressProxy(docker, this.runId, this.image, this.labels);
    await this.proxy.start();
  }

  /** Removes the proxy, the network and any runner container still running. Safe to call twice. */
  public async stop(): Promise<void> {
    const left = [...this.running];
    this.running.clear();
    if (left.length)
      await this.options.docker.run(["rm", "--force", "--volumes", ...left]);
    await this.proxy?.stop();
    this.proxy = undefined;
  }

  public async open({
    network,
  }: Evals.Sandbox.OpenOptions): Promise<Evals.Sandbox.Box> {
    const { docker, config } = this.options;
    if (!this.image || !this.proxy)
      throw new Error("the container sandbox was not started");
    const hostRoot = await mkdtemp(
      path.join(this.options.workdirRoot, "project-"),
    );
    const name = `iointel-evals-${this.runId}-${++this.seq}`;
    const keep = !!this.options.keep;
    this.running.add(name);
    try {
      await mustSucceed(
        docker.run([
          "run",
          "--detach",
          "--name",
          name,
          ...this.labels,
          ...labelArgs({ [LABELS.role]: "unit" }),
          ...unitContainerArgs(config, this.proxy.network),
          this.image,
        ]),
        "start a runner container",
      );
      const ip = await this.proxy.addressOf(name);
      await this.proxy.register(ip, allowedHosts(config, network));
      for (const file of this.credentialFiles)
        await docker.copyIn(name, file.host, file.box);
      return new ContainerBox(
        docker,
        name,
        ip,
        this.proxy,
        hostRoot,
        keep,
        () => this.running.delete(name),
      );
    } catch (err) {
      this.running.delete(name);
      await docker.run(["rm", "--force", "--volumes", name]);
      await rm(hostRoot, { recursive: true, force: true });
      throw err;
    }
  }

  /**
   * npm run eval:shell: copies a kept workspace into a fresh runner container (same image, same
   * proxy, the global allowlist) and opens a shell there. The container goes away on exit; the kept
   * folder on the host is left as it was.
   */
  public async shell(hostWorkdir: string): Promise<number> {
    const box = (await this.open({ network: true })) as ContainerBox;
    try {
      await box.copyIn(hostWorkdir, box.workdir);
      return await box.interactive(["bash"]);
    } finally {
      await box.close();
    }
  }

  /**
   * Removes containers and networks left by earlier eval runs on this machine whose process is gone
   * (Ctrl-C, a crash). Runs of other live processes, and other machines' resources, are left alone.
   */
  private async removeLeftovers(): Promise<void> {
    const { docker } = this.options;
    const isAlive = this.options.isAlive ?? processAlive;
    const stale = async (kind: "container" | "network") => {
      const listed = await docker.run([
        kind === "container" ? "ps" : "network",
        ...(kind === "container" ? ["--all"] : ["ls"]),
        "--filter",
        `label=${LABELS.run}`,
        "--format",
        `{{.ID}}\t{{.Label "${LABELS.pid}"}}\t{{.Label "${LABELS.host}"}}`,
      ]);
      return listed.stdout
        .split(/\r?\n/)
        .map((line) => line.trim().split("\t"))
        .filter(
          ([id, pid, host]) =>
            !!id && host === os.hostname() && !isAlive(Number(pid)),
        )
        .map(([id]) => id!);
    };
    const containers = await stale("container");
    if (containers.length) {
      this.log(
        `Removing ${containers.length} container(s) left by an interrupted eval run.`,
      );
      await docker.run(["rm", "--force", "--volumes", ...containers]);
    }
    const networks = await stale("network");
    if (networks.length) await docker.run(["network", "rm", ...networks]);
  }
}

/** The flags every runner container starts with: hardening, limits, volumes, proxy settings. */
export function unitContainerArgs(
  config: IsolationConfig,
  network: string,
): string[] {
  const { cpus, memory, pids } = config.limits;
  return [
    "--network",
    network,
    "--init",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,nosuid,size=1g",
    "--mount",
    "type=volume,dst=/home/node",
    "--mount",
    `type=volume,src=${NPM_CACHE_VOLUME},dst=/home/node/.npm`,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--cpus",
    String(cpus),
    "--memory",
    memory,
    "--memory-swap",
    memory,
    "--pids-limit",
    String(pids),
    ...Object.entries(STATIC_ENV).flatMap(([k, v]) => ["--env", `${k}=${v}`]),
  ];
}

/**
 * The env entries of an agent's request that may enter the container: credentials by name, and
 * whatever the adapter or SDK set on top of this process's own environment. The host's own
 * environment (PATH, home folders, unrelated secrets) never does, nor any value that is a host path.
 */
export function forwardableEnv(
  env: Readonly<Record<string, string | undefined>>,
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const credentials = new Set<string>(CREDENTIAL_ENV);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === "") continue;
    if (credentials.has(name)) out[name] = value;
    else if (
      hostEnv[name] !== value &&
      !HOST_ONLY_ENV.has(name.toUpperCase()) &&
      !/^[A-Za-z]:[\\/]/.test(value)
    )
      out[name] = value;
  }
  return out;
}

class ContainerBox implements Evals.Sandbox.Box {
  public readonly isolation = "container";
  public readonly root = ROOT;
  public readonly workdir = `${ROOT}/work`;
  public readonly hostWorkdir: string;
  private static readonly PID_DIR = "/tmp";
  private spawned = 0;
  private finalLog: readonly Evals.Sandbox.NetworkRequest[] | undefined;

  public constructor(
    private readonly docker: DockerCli,
    private readonly container: string,
    private readonly ip: string,
    private readonly proxy: EgressProxy,
    private readonly hostRoot: string,
    public readonly kept: boolean,
    private readonly onClosed: () => void,
  ) {
    this.hostWorkdir = path.join(hostRoot, "work");
  }

  public resolve(rel: string): string {
    return path.posix.resolve(this.workdir, rel.replaceAll("\\", "/"));
  }

  public async exec(
    file: string,
    args: readonly string[],
    options: Evals.Sandbox.ExecOptions = {},
  ): Promise<Evals.Sandbox.ExecResult> {
    // The head is kept: callers such as the diff truncate from the start, like execFile's output.
    const result = await this.docker.run(
      [
        "exec",
        "--workdir",
        options.cwd ?? this.workdir,
        this.container,
        file,
        ...args,
      ],
      { keep: "head" },
    );
    if (result.code !== 0)
      throw new Error(
        `${file} ${args.join(" ")} exited ${result.code ?? "on timeout"}: ${result.stderr.trim()}`,
      );
    return { stdout: result.stdout, stderr: result.stderr };
  }

  /** `timeout` runs inside the container, so a timed-out command really stops there too. */
  public readonly shell: Evals.Commands.Runner = async (
    command,
    cwd,
    timeoutMs,
  ) => {
    const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const started = Date.now();
    const result = await this.docker.run(
      [
        "exec",
        "--workdir",
        cwd,
        this.container,
        "timeout",
        "--kill-after=10s",
        `${seconds}s`,
        "sh",
        "-c",
        `exec 2>&1\n${command}`,
      ],
      { timeoutMs: timeoutMs + 30_000 },
    );
    // 124/137 also mean "killed" for other reasons (the OOM killer exits 137), so the clock decides.
    const timedOut =
      result.code === null ||
      ((result.code === 124 || result.code === 137) &&
        Date.now() - started >= seconds * 1000 - 500);
    return {
      exitCode: timedOut ? null : result.code,
      output: (result.stdout + result.stderr).slice(-200_000),
    };
  };

  /**
   * Killing `docker exec` on the host doesn't stop what it started in the container, so each process
   * runs in its own session with its id in a pid file, and kill() also stops that whole group inside.
   */
  public spawn(request: Evals.Sandbox.SpawnRequest) {
    const env = forwardableEnv(request.env);
    const pidFile = `${ContainerBox.PID_DIR}/agent-${++this.spawned}.pid`;
    const child = this.docker.spawn(
      [
        "exec",
        "--interactive",
        "--workdir",
        request.cwd ?? this.workdir,
        // By name only: the values travel in the docker CLI's environment, not its arguments.
        ...Object.keys(env).flatMap((name) => ["--env", name]),
        this.container,
        "setsid",
        "--wait",
        "sh",
        "-c",
        'echo $$ > "$0" && exec "$@"',
        pidFile,
        request.command,
        ...request.args,
      ],
      { env },
    );
    const kill = child.kill.bind(child);
    child.kill = (signal?: NodeJS.Signals | number) => {
      void this.stopProcesses();
      return kill(signal);
    };
    return child;
  }

  public async stopProcesses(): Promise<void> {
    if (!this.spawned) return;
    await this.docker.run([
      "exec",
      this.container,
      "sh",
      "-c",
      `for f in ${ContainerBox.PID_DIR}/agent-*.pid; do [ -f "$f" ] && kill -KILL -- "-$(cat "$f")" 2>/dev/null; rm -f "$f"; done; true`,
    ]);
  }

  public copyIn(hostPath: string, boxPath: string): Promise<void> {
    return this.docker.copyIn(this.container, hostPath, boxPath);
  }

  public interactive(command: readonly string[]): Promise<number> {
    return this.docker.interactive([
      "exec",
      "--interactive",
      "--tty",
      "--workdir",
      this.workdir,
      this.container,
      ...command,
    ]);
  }

  public async readFile(boxPath: string): Promise<string | undefined> {
    const result = await this.docker.run(
      ["exec", this.container, "cat", boxPath],
      { keep: "head" },
    );
    return result.code === 0 ? result.stdout : undefined;
  }

  public async exists(boxPath: string): Promise<boolean> {
    const result = await this.docker.run([
      "exec",
      this.container,
      "test",
      "-e",
      boxPath,
    ]);
    return result.code === 0;
  }

  public async writeFile(boxPath: string, content: string): Promise<void> {
    await mustSucceed(
      this.docker.run(
        [
          "exec",
          "--interactive",
          this.container,
          "sh",
          "-c",
          'mkdir -p "$(dirname "$1")" && cat > "$1"',
          "sh",
          boxPath,
        ],
        { input: content },
      ),
      `write ${boxPath}`,
    );
  }

  public async sync(): Promise<void> {
    await rm(this.hostWorkdir, { recursive: true, force: true, maxRetries: 3 });
    await this.docker.copyOut(
      this.container,
      this.workdir,
      this.hostWorkdir,
      SNAPSHOT_EXCLUDES,
    );
  }

  public async networkLog(): Promise<readonly Evals.Sandbox.NetworkRequest[]> {
    return this.finalLog ?? (await this.proxy.readLog(this.ip));
  }

  public async close(): Promise<void> {
    // The log is read before the IP is released: a later container may get the same address.
    this.finalLog = await this.proxy.readLog(this.ip).catch(() => []);
    await this.proxy.forget(this.ip).catch(() => {});
    await this.docker.run(["rm", "--force", "--volumes", this.container]);
    this.onClosed();
    if (!this.kept)
      await rm(this.hostRoot, { recursive: true, force: true, maxRetries: 3 });
  }
}

/** The proxy container of one eval run, and the internal network it guards. */
class EgressProxy {
  public readonly network: string;
  private readonly name: string;

  public constructor(
    private readonly docker: DockerCli,
    runId: string,
    private readonly image: string,
    private readonly labels: readonly string[],
  ) {
    this.network = `iointel-evals-${runId}`;
    this.name = `iointel-evals-${runId}-proxy`;
  }

  public async start(): Promise<void> {
    await mustSucceed(
      this.docker.run([
        "network",
        "create",
        "--internal",
        ...this.labels,
        this.network,
      ]),
      "create the run's internal network",
    );
    // Started on the default bridge (its way out), then attached to the internal network.
    await mustSucceed(
      this.docker.run([
        "run",
        "--detach",
        "--name",
        this.name,
        ...this.labels,
        ...labelArgs({ [LABELS.role]: "proxy" }),
        "--init",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,nosuid,size=64m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--memory",
        "256m",
        "--pids-limit",
        "256",
        "--entrypoint",
        "node",
        this.image,
        "/opt/evals/proxy.mjs",
      ]),
      "start the egress proxy",
    );
    await mustSucceed(
      this.docker.run([
        "network",
        "connect",
        "--alias",
        PROXY_ALIAS,
        this.network,
        this.name,
      ]),
      "attach the egress proxy to the run's network",
    );
  }

  public async stop(): Promise<void> {
    await this.docker.run(["rm", "--force", this.name]);
    await this.docker.run(["network", "rm", this.network]);
  }

  /** A container's IP on the run's network: how the proxy tells runs apart. */
  public async addressOf(container: string): Promise<string> {
    const result = await mustSucceed(
      this.docker.run([
        "inspect",
        "--format",
        `{{(index .NetworkSettings.Networks "${this.network}").IPAddress}}`,
        container,
      ]),
      "read the runner container's address",
    );
    const ip = result.stdout.trim();
    if (!/^[0-9a-f.:]+$/i.test(ip))
      throw new Error(`unexpected container address "${ip}"`);
    return ip;
  }

  public async register(ip: string, allow: readonly string[]): Promise<void> {
    await mustSucceed(
      this.docker.run(
        [
          "exec",
          "--interactive",
          this.name,
          "sh",
          "-c",
          'mkdir -p /tmp/policies && cat > "/tmp/policies/$1.json"',
          "sh",
          ip,
        ],
        { input: JSON.stringify({ allow }) },
      ),
      "register the run's allowlist with the proxy",
    );
  }

  public async readLog(ip: string): Promise<Evals.Sandbox.NetworkRequest[]> {
    const result = await this.docker.run([
      "exec",
      this.name,
      "cat",
      `/tmp/logs/${ip}.jsonl`,
    ]);
    return result.code === 0 ? summarizeLog(result.stdout) : [];
  }

  public async forget(ip: string): Promise<void> {
    await this.docker.run([
      "exec",
      this.name,
      "rm",
      "-f",
      `/tmp/policies/${ip}.json`,
      `/tmp/logs/${ip}.jsonl`,
    ]);
  }
}

/** The proxy's JSON-lines log as one entry per host and verdict, blocked first, then by count. */
export function summarizeLog(text: string): Evals.Sandbox.NetworkRequest[] {
  const counts = new Map<string, Evals.Sandbox.NetworkRequest>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry: { host?: unknown; allowed?: unknown };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry.host !== "string") continue;
    const allowed = entry.allowed === true;
    const key = `${allowed}|${entry.host}`;
    const prev = counts.get(key);
    counts.set(key, {
      host: entry.host,
      allowed,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].sort(
    (a, b) =>
      Number(a.allowed) - Number(b.allowed) ||
      b.count - a.count ||
      a.host.localeCompare(b.host),
  );
}

function labelArgs(labels: Record<string, string>): string[] {
  return Object.entries(labels).flatMap(([k, v]) => ["--label", `${k}=${v}`]);
}

async function mustSucceed<T extends { code: number | null; stderr: string }>(
  result: Promise<T>,
  what: string,
): Promise<T> {
  const r = await result;
  if (r.code !== 0)
    throw new Error(
      `Could not ${what}: ${r.stderr.trim() || `exit ${r.code}`}`,
    );
  return r;
}

function processAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
