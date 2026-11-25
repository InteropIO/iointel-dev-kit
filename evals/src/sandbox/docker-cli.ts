// The only place that starts the `docker` CLI. Everything container-related goes through this
// interface, so the engine's container logic is tested with a fake that records arguments.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

export interface DockerResult {
  /** null when the command was killed by the timeout. */
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DockerRunOptions {
  /** Written to the command's stdin. */
  readonly input?: string;
  /** Extra environment for the docker CLI itself (values referenced by `-e NAME`). */
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  /**
   * Which end of stdout to keep when it is longer than the cap: "tail" (default; build logs end
   * with the error) or "head" (command output that is truncated from the start by its caller, e.g. a diff).
   */
  readonly keep?: "head" | "tail";
}

export interface DockerCli {
  run(
    args: readonly string[],
    options?: DockerRunOptions,
  ): Promise<DockerResult>;
  /** A long-running docker process with piped stdio (e.g. `docker exec -i` for an agent). */
  spawn(
    args: readonly string[],
    options?: Pick<DockerRunOptions, "env">,
  ): ChildProcess;
  /** Runs docker attached to this terminal (e.g. `exec -it … bash`); resolves with its exit code. */
  interactive(args: readonly string[]): Promise<number>;
  /** Copies a host file or folder into a container path, owned by the container's user. */
  copyIn(container: string, hostPath: string, boxPath: string): Promise<void>;
  /** Copies a container folder's contents to a host folder, skipping names in `exclude`. */
  copyOut(
    container: string,
    boxPath: string,
    hostPath: string,
    exclude: readonly string[],
  ): Promise<void>;
}

const MAX_TAIL_CHARS = 1_000_000;
const MAX_HEAD_CHARS = 50 * 1024 * 1024;

/** The real docker CLI. Files move as tar streams, so they're owned by the container user. */
export class SpawnDockerCli implements DockerCli {
  public constructor(private readonly command = "docker") {}

  public run(
    args: readonly string[],
    options: DockerRunOptions = {},
  ): Promise<DockerResult> {
    return new Promise((resolve) => {
      const child = this.spawn(args, options);
      let stdout = "";
      let stderr = "";
      const head = options.keep === "head";
      child.stdout!.on("data", (c: Buffer) => {
        if (head) {
          if (stdout.length < MAX_HEAD_CHARS)
            stdout = (stdout + c.toString()).slice(0, MAX_HEAD_CHARS);
        } else stdout = (stdout + c.toString()).slice(-MAX_TAIL_CHARS);
      });
      child.stderr!.on("data", (c: Buffer) => {
        stderr = (stderr + c.toString()).slice(-MAX_TAIL_CHARS);
      });
      let timedOut = false;
      const timer = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs)
        : undefined;
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ code: 127, stdout, stderr: stderr + String(err) });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: timedOut ? null : (code ?? 1), stdout, stderr });
      });
      child.stdin!.on("error", () => {}); // the process may exit before reading all input
      child.stdin!.end(options.input ?? "");
    });
  }

  public spawn(
    args: readonly string[],
    options: Pick<DockerRunOptions, "env"> = {},
  ): ChildProcess {
    return spawn(this.command, [...args], {
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  public interactive(args: readonly string[]): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn(this.command, [...args], { stdio: "inherit" });
      child.on("error", () => resolve(127));
      child.on("close", (code) => resolve(code ?? 1));
    });
  }

  public async copyIn(
    container: string,
    hostPath: string,
    boxPath: string,
  ): Promise<void> {
    const isDir = (await stat(hostPath)).isDirectory();
    // A folder's contents go into boxPath; a file is packed by name, then renamed if needed.
    const cwd = isDir ? hostPath : path.dirname(hostPath);
    const entry = isDir ? "." : path.basename(hostPath);
    const target = isDir ? boxPath : path.posix.dirname(boxPath);
    const rename =
      !isDir && path.posix.basename(boxPath) !== entry
        ? ` && mv "$1/${entry}" "$2"`
        : "";
    await pipeline(
      spawnTar(["-cf", "-", entry], cwd),
      this.spawn([
        "exec",
        "-i",
        container,
        "sh",
        "-c",
        `mkdir -p "$1" && tar -xf - -C "$1" --no-same-owner${rename}`,
        "sh",
        target,
        boxPath,
      ]),
      `copy ${hostPath} into the container`,
    );
  }

  public async copyOut(
    container: string,
    boxPath: string,
    hostPath: string,
    exclude: readonly string[],
  ): Promise<void> {
    await mkdir(hostPath, { recursive: true });
    await pipeline(
      this.spawn([
        "exec",
        container,
        "tar",
        "-cf",
        "-",
        "-C",
        boxPath,
        ...exclude.map((e) => `--exclude=${e}`),
        ".",
      ]),
      spawnTar(["-xf", "-"], hostPath),
      `copy ${boxPath} out of the container`,
    );
  }
}

/**
 * The host's tar, run in `cwd` with relative paths only: GNU tar (Git for Windows) reads a
 * "C:" argument as a remote host, so no drive-letter path is ever passed to it.
 */
function spawnTar(args: readonly string[], cwd: string): ChildProcess {
  return spawn("tar", [...args], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
}

/** Pipes producer's stdout into consumer's stdin; rejects unless both exit 0. */
function pipeline(
  producer: ChildProcess,
  consumer: ChildProcess,
  what: string,
): Promise<void> {
  const exit = (child: ChildProcess) =>
    new Promise<{ code: number | null; stderr: string }>((resolve) => {
      let stderr = "";
      child.stderr!.on("data", (c: Buffer) => {
        stderr = (stderr + c.toString()).slice(-10_000);
      });
      child.on("error", (err) => resolve({ code: 127, stderr: String(err) }));
      child.on("close", (code) => resolve({ code, stderr }));
    });
  const done = Promise.all([exit(producer), exit(consumer)]);
  consumer.stdin!.on("error", () => {});
  producer.stdout!.pipe(consumer.stdin!);
  producer.stdin!.end();
  return done.then(([p, c]) => {
    if (p.code !== 0 || c.code !== 0)
      throw new Error(
        `Could not ${what}: ${[p.stderr, c.stderr].filter(Boolean).join("\n").trim() || `exit ${p.code}/${c.code}`}`,
      );
  });
}
