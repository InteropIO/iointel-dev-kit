import { EventEmitter } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  ContainerSandbox,
  forwardableEnv,
  NPM_CACHE_VOLUME,
  summarizeLog,
} from "../src/sandbox/container-sandbox.js";
import { containerCredentials } from "../src/sandbox/credentials.js";
import type {
  DockerCli,
  DockerResult,
  DockerRunOptions,
} from "../src/sandbox/docker-cli.js";
import {
  allowedHosts,
  type IsolationConfig,
} from "../src/sandbox/isolation-config.js";
import { imageTag } from "../src/sandbox/runner-image.js";
// @ts-expect-error -- plain .mjs without types; it runs inside the runner image.
import { isAllowed, splitHostPort } from "../docker/proxy.mjs";

const CONFIG: IsolationConfig = {
  network: {
    always: ["api.anthropic.com", "registry.npmjs.org"],
    allow: ["github.com", "*.interop.io"],
  },
  limits: { cpus: 2, memory: "4g", pids: 1024 },
};
const CONTEXT_DIR = path.resolve(import.meta.dirname, "..", "docker");
const IP = "172.30.0.5";

interface Call {
  readonly args: readonly string[];
  readonly input?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/** Records every docker call; answers the few whose output the sandbox reads. */
class FakeDocker implements DockerCli {
  public readonly calls: Call[] = [];
  public daemonUp = true;
  public imageExists = true;
  public leftovers = "";
  public proxyLog = "";
  public execCode = 0;
  public execDelayMs = 0;

  public async run(
    args: readonly string[],
    options: DockerRunOptions = {},
  ): Promise<DockerResult> {
    this.calls.push({
      args,
      ...(options.input !== undefined ? { input: options.input } : {}),
    });
    const ok = (stdout = ""): DockerResult => ({ code: 0, stdout, stderr: "" });
    if (args[0] === "version")
      return this.daemonUp
        ? ok("29.1.3")
        : { code: 1, stdout: "", stderr: "cannot connect to the daemon" };
    if (args[0] === "image" && args[1] === "inspect")
      return this.imageExists ? ok() : { code: 1, stdout: "", stderr: "" };
    if (args[0] === "inspect") return ok(`${IP}\n`);
    if (args[0] === "ps" || (args[0] === "network" && args[1] === "ls"))
      return ok(this.leftovers);
    if (
      args[0] === "exec" &&
      args.includes("cat") &&
      String(args.at(-1)).startsWith("/tmp/logs/")
    )
      return ok(this.proxyLog);
    if (args[0] === "exec" && args.includes("timeout")) {
      await new Promise((r) => setTimeout(r, this.execDelayMs));
      return { code: this.execCode, stdout: "built\n", stderr: "" };
    }
    return ok();
  }

  public spawn(
    args: readonly string[],
    options: Pick<DockerRunOptions, "env"> = {},
  ): ChildProcess {
    this.calls.push({ args, ...(options.env ? { env: options.env } : {}) });
    const child = new EventEmitter() as ChildProcess;
    Object.assign(child, {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => true,
    });
    return child;
  }

  public async interactive(args: readonly string[]): Promise<number> {
    this.calls.push({ args: ["(interactive)", ...args] });
    return 0;
  }

  public async copyIn(container: string, hostPath: string, boxPath: string) {
    this.calls.push({ args: ["(copyIn)", container, hostPath, boxPath] });
  }

  public async copyOut(
    container: string,
    boxPath: string,
    hostPath: string,
    exclude: readonly string[],
  ) {
    this.calls.push({
      args: ["(copyOut)", container, boxPath, hostPath, ...exclude],
    });
  }

  public find(...prefix: string[]): Call[] {
    return this.calls.filter((c) => prefix.every((p, i) => c.args[i] === p));
  }
}

async function sandbox(
  docker = new FakeDocker(),
  extra: Partial<ConstructorParameters<typeof ContainerSandbox>[0]> = {},
) {
  const workdirRoot = await mkdtemp(path.join(os.tmpdir(), "evals-ctr-"));
  const s = new ContainerSandbox({
    docker,
    image: {
      contextDir: CONTEXT_DIR,
      buildArgs: { CLAUDE_CODE_VERSION: "1.0.0", CODEX_VERSION: "0.1.0" },
    },
    config: CONFIG,
    workdirRoot,
    credentials: () => ({ problems: [], files: [], notes: [] }),
    runId: "abcd1234",
    isAlive: () => false,
    ...extra,
  });
  return { s, docker, workdirRoot };
}

describe("container sandbox: start", () => {
  it("fails with a clear message when Docker is not running", async () => {
    const docker = new FakeDocker();
    docker.daemonUp = false;
    const { s } = await sandbox(docker);
    await expect(s.start(["claude-code"])).rejects.toThrow(
      /needs a running Docker daemon.*Start Docker Desktop/s,
    );
  });

  it("fails when the agents have no credential a container can use", async () => {
    const { s } = await sandbox(new FakeDocker(), {
      credentials: () => ({ problems: ["no token"], files: [], notes: [] }),
    });
    await expect(s.start(["claude-code"])).rejects.toThrow("no token");
  });

  it("builds the image only when its tag is missing, then starts the proxy on an internal network", async () => {
    const docker = new FakeDocker();
    docker.imageExists = false;
    const { s } = await sandbox(docker);
    await s.start(["claude-code"]);

    const build = docker.find("build")[0]!;
    expect(build.args).toContain("CLAUDE_CODE_VERSION=1.0.0");
    expect(build.args.at(-1)).toBe(CONTEXT_DIR);
    expect(docker.find("network", "create")[0]!.args).toContain("--internal");
    expect(docker.find("volume", "create")[0]!.args).toContain(
      NPM_CACHE_VOLUME,
    );
    const proxy = docker
      .find("run")
      .find((c) => c.args.includes("/opt/evals/proxy.mjs"))!;
    expect(proxy.args).toEqual(
      expect.arrayContaining(["--read-only", "--cap-drop", "ALL"]),
    );
    expect(docker.find("network", "connect")[0]!.args).toEqual([
      "network",
      "connect",
      "--alias",
      "egress-proxy",
      "iointel-evals-abcd1234",
      "iointel-evals-abcd1234-proxy",
    ]);
  });

  it("reuses an existing image", async () => {
    const { s, docker } = await sandbox();
    await s.start([]);
    expect(docker.find("build")).toEqual([]);
  });

  it("removes only leftovers of dead runs on this machine", async () => {
    const docker = new FakeDocker();
    docker.leftovers = [
      `dead1\t111\t${os.hostname()}`,
      `alive\t222\t${os.hostname()}`,
      `other\t333\tsomeone-elses-machine`,
    ].join("\n");
    const { s } = await sandbox(docker, { isAlive: (pid) => pid === 222 });
    await s.start([]);
    expect(docker.find("rm")[0]!.args).toEqual([
      "rm",
      "--force",
      "--volumes",
      "dead1",
    ]);
    expect(docker.find("network", "rm")[0]!.args).toEqual([
      "network",
      "rm",
      "dead1",
    ]);
  });
});

describe("container sandbox: a run's box", () => {
  async function openBox(network: boolean | { allow: string[] } = true) {
    const ctx = await sandbox();
    await ctx.s.start(["claude-code"]);
    const box = await ctx.s.open({ network });
    return { ...ctx, box };
  }

  it("starts a hardened, limited runner container on the run's network", async () => {
    const { docker, box } = await openBox();
    const run = docker
      .find("run", "--detach")
      .find((c) => c.args.includes("iointel-evals.role=unit"))!;
    expect(run.args).toEqual(
      expect.arrayContaining([
        "--network",
        "iointel-evals-abcd1234",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--cpus",
        "2",
        "--memory",
        "4g",
        "--memory-swap",
        "4g",
        "--pids-limit",
        "1024",
        "--env",
        "HTTPS_PROXY=http://egress-proxy:3128",
        "--label",
        "iointel-evals.run=abcd1234",
      ]),
    );
    expect(run.args.at(-1)).toMatch(/^iointel-evals-runner:[0-9a-f]{12}$/);
    expect(box.workdir).toBe("/home/node/project/work");
    expect(box.resolve("a/b.txt")).toBe("/home/node/project/work/a/b.txt");
  });

  it.each([
    [
      true,
      ["api.anthropic.com", "registry.npmjs.org", "github.com", "*.interop.io"],
    ],
    [false, ["api.anthropic.com", "registry.npmjs.org"]],
    [
      { allow: ["example.com"] },
      [
        "api.anthropic.com",
        "registry.npmjs.org",
        "github.com",
        "*.interop.io",
        "example.com",
      ],
    ],
  ] as const)(
    "registers network %j with the proxy by the container's address",
    async (network, hosts) => {
      const { docker } = await openBox(
        network as boolean | { allow: string[] },
      );
      const register = docker.calls.find(
        (c) =>
          c.args.includes("/tmp/policies") ||
          c.args.some((a) => a.includes("/tmp/policies/")),
      )!;
      expect(register.args.at(-1)).toBe(IP);
      expect(JSON.parse(register.input!)).toEqual({ allow: hosts });
    },
  );

  it("forwards only credentials and the SDK's own settings to an agent, by name", async () => {
    const { docker, box } = await openBox();
    const env = {
      ...process.env,
      CLAUDE_CODE_OAUTH_TOKEN: "secret-token",
      CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
      SOME_HOST_PATH: "C:\\Users\\me",
    };
    box.spawn({ command: "claude", args: ["--print"], env });
    const call = docker.find("exec", "--interactive").at(-1)!;
    expect(call.args.join(" ")).not.toContain("secret-token");
    expect(call.args).toEqual(
      expect.arrayContaining([
        "--env",
        "CLAUDE_CODE_OAUTH_TOKEN",
        "--env",
        "CLAUDE_CODE_ENTRYPOINT",
      ]),
    );
    expect(call.args).not.toContain("PATH");
    expect(call.args).not.toContain("SOME_HOST_PATH");
    expect(call.env).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: "secret-token",
      CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
    });
    expect(call.args.slice(-9)).toEqual([
      expect.stringMatching(/^iointel-evals-abcd1234-\d+$/),
      "setsid",
      "--wait",
      "sh",
      "-c",
      'echo $$ > "$0" && exec "$@"',
      "/tmp/agent-1.pid",
      "claude",
      "--print",
    ]);
  });

  it("stops the agent's whole process group inside the container when it is killed", async () => {
    const { docker, box } = await openBox();
    const child = box.spawn({ command: "codex", args: [], env: {} });
    child.kill();
    await box.stopProcesses();
    const kills = docker.calls.filter((c) =>
      c.args.at(-1)?.includes("kill -KILL"),
    );
    expect(kills).toHaveLength(2); // once from kill(), once from stopProcesses()
    expect(kills[0]!.args.at(-1)).toContain("/tmp/agent-*.pid");
  });

  it("runs check commands under timeout inside the container and reports a timeout as null", async () => {
    const { docker, box } = await openBox();
    docker.execCode = 124;
    docker.execDelayMs = 600;
    const timedOut = await box.shell("npm run build", box.workdir, 1_000);
    expect(timedOut.exitCode).toBeNull();
    docker.execDelayMs = 0;
    docker.execCode = 137; // killed early, e.g. by the OOM killer: not a timeout
    const killed = await box.shell("npm run build", box.workdir, 60_000);
    expect(killed.exitCode).toBe(137);
    const result = await box.shell("npm run build", box.workdir, 60_000);
    const call = docker.calls.filter((c) => c.args.includes("timeout")).at(-1)!;
    expect(call.args).toEqual(
      expect.arrayContaining([
        "--workdir",
        box.workdir,
        "timeout",
        "60s",
        "sh",
        "-c",
      ]),
    );
    expect(call.args.at(-1)).toContain("npm run build");
  });

  it("copies the workdir out without node_modules, and reads the proxy log before removing the container", async () => {
    const { docker, box } = await openBox();
    docker.proxyLog = [
      { host: "github.com", allowed: true },
      { host: "github.com", allowed: true },
      { host: "evil.example", allowed: false },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");

    await box.sync();
    const copy = docker.find("(copyOut)")[0]!;
    expect(copy.args).toEqual([
      "(copyOut)",
      expect.any(String),
      "/home/node/project/work",
      box.hostWorkdir,
      "node_modules",
    ]);

    await box.close();
    const order = docker.calls.map((c) => c.args.join(" "));
    const readAt = order.findIndex(
      (a) => a.includes(`/tmp/logs/${IP}.jsonl`) && a.includes("cat"),
    );
    const rmAt = order.findIndex((a) =>
      a.startsWith("rm --force --volumes iointel-evals-abcd1234-"),
    );
    expect(readAt).toBeGreaterThan(-1);
    expect(rmAt).toBeGreaterThan(readAt);
    expect(await box.networkLog()).toEqual([
      { host: "evil.example", allowed: false, count: 1 },
      { host: "github.com", allowed: true, count: 2 },
    ]);
  });

  it("stop() removes containers still running, the proxy and the network", async () => {
    const { docker, s } = await openBox();
    await s.stop();
    const rms = docker.find("rm").map((c) => c.args.join(" "));
    expect(rms).toContainEqual(
      expect.stringMatching(/^rm --force --volumes iointel-evals-abcd1234-1$/),
    );
    expect(rms).toContain("rm --force iointel-evals-abcd1234-proxy");
    expect(docker.find("network", "rm")[0]!.args).toEqual([
      "network",
      "rm",
      "iointel-evals-abcd1234",
    ]);
  });

  it("copies credential files into each container", async () => {
    const docker = new FakeDocker();
    const { s } = await sandbox(docker, {
      credentials: () => ({
        problems: [],
        files: [
          {
            host: "/host/creds.json",
            box: "/home/node/.claude/.credentials.json",
          },
        ],
        notes: [],
      }),
    });
    await s.start(["claude-code"]);
    await s.open({ network: true });
    expect(docker.find("(copyIn)")[0]!.args.slice(2)).toEqual([
      "/host/creds.json",
      "/home/node/.claude/.credentials.json",
    ]);
  });
});

describe("eval:shell", () => {
  it("copies the kept workspace into a fresh runner container, opens bash there, then removes it", async () => {
    const { s, docker } = await sandbox();
    await s.start([]);
    const code = await s.shell("/kept/project-x/work");

    expect(code).toBe(0);
    expect(docker.find("(copyIn)")[0]!.args.slice(2)).toEqual([
      "/kept/project-x/work",
      "/home/node/project/work",
    ]);
    expect(docker.find("(interactive)")[0]!.args).toEqual([
      "(interactive)",
      "exec",
      "--interactive",
      "--tty",
      "--workdir",
      "/home/node/project/work",
      "iointel-evals-abcd1234-1",
      "bash",
    ]);
    expect(
      docker.find("rm", "--force", "--volumes", "iointel-evals-abcd1234-1"),
    ).toHaveLength(1);
  });
});

describe("forwardableEnv", () => {
  it("keeps credentials and values that differ from this process, drops host-only and host paths", () => {
    const host = { PATH: "/usr/bin", FOO: "same", ANTHROPIC_API_KEY: "k" };
    expect(
      forwardableEnv(
        {
          ...host,
          BAR: "new",
          PATH: "/other",
          WIN: "D:/x",
          HOME: "/h",
          EMPTY: "",
        },
        host,
      ),
    ).toEqual({ ANTHROPIC_API_KEY: "k", BAR: "new" });
  });
});

describe("network allowlists", () => {
  it("resolves true, false and { allow } without ever opening everything", () => {
    expect(allowedHosts(CONFIG, false)).toEqual([
      "api.anthropic.com",
      "registry.npmjs.org",
    ]);
    expect(allowedHosts(CONFIG, true)).toHaveLength(4);
    expect(
      allowedHosts(CONFIG, { allow: ["Example.com", "github.com"] }),
    ).toEqual([
      "api.anthropic.com",
      "registry.npmjs.org",
      "github.com",
      "*.interop.io",
      "example.com",
    ]);
  });

  it("matches exact hosts and subdomain wildcards in the proxy", () => {
    const allow = ["github.com", "*.interop.io"];
    expect(isAllowed("github.com", allow)).toBe(true);
    expect(isAllowed("GitHub.com.", allow)).toBe(true);
    expect(isAllowed("api.github.com", allow)).toBe(false);
    expect(isAllowed("docs-ai.interop.io", allow)).toBe(true);
    expect(isAllowed("interop.io", allow)).toBe(false);
    expect(isAllowed("evilinterop.io", allow)).toBe(false);
  });

  it("parses CONNECT targets", () => {
    expect(splitHostPort("github.com:443", 443)).toEqual({
      host: "github.com",
      port: 443,
    });
    expect(splitHostPort("[::1]:8443", 443)).toEqual({
      host: "::1",
      port: 8443,
    });
    expect(splitHostPort("example.com", 443)).toEqual({
      host: "example.com",
      port: 443,
    });
  });

  it("summarizes the proxy log, blocked hosts first", () => {
    expect(
      summarizeLog(
        '{"host":"a.com","allowed":true}\nnot json\n{"host":"b.com","allowed":false}\n',
      ),
    ).toEqual([
      { host: "b.com", allowed: false, count: 1 },
      { host: "a.com", allowed: true, count: 1 },
    ]);
  });
});

describe("runner image tag", () => {
  it("changes when the agent CLI versions change", async () => {
    const a = await imageTag({
      contextDir: CONTEXT_DIR,
      buildArgs: { CLAUDE_CODE_VERSION: "1" },
    });
    const b = await imageTag({
      contextDir: CONTEXT_DIR,
      buildArgs: { CLAUDE_CODE_VERSION: "2" },
    });
    expect(a).not.toBe(b);
    expect(a).toBe(
      await imageTag({
        contextDir: CONTEXT_DIR,
        buildArgs: { CLAUDE_CODE_VERSION: "1" },
      }),
    );
  });
});

describe("container credentials", () => {
  it("needs nothing extra with an env-var credential, or without Claude targets", () => {
    expect(
      containerCredentials(
        ["claude-code"],
        { CLAUDE_CODE_OAUTH_TOKEN: "t" },
        "linux",
      ),
    ).toEqual({ problems: [], files: [], notes: [] });
    expect(containerCredentials(["codex"], {}, "darwin").problems).toEqual([]);
  });

  it("falls back to copying the login file, except on macOS", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "evals-creds-"));
    await writeFile(path.join(dir, ".credentials.json"), "{}");
    const plan = containerCredentials(
      ["claude-code"],
      { CLAUDE_CONFIG_DIR: dir },
      "win32",
    );
    expect(plan.files).toEqual([
      {
        host: path.join(dir, ".credentials.json"),
        box: "/home/node/.claude/.credentials.json",
      },
    ]);
    expect(plan.notes[0]).toContain("claude setup-token");

    const mac = containerCredentials(
      ["claude-code"],
      { CLAUDE_CONFIG_DIR: dir },
      "darwin",
    );
    expect(mac.problems[0]).toMatch(/Keychain.*claude setup-token/);
  });
});
