import { execFile, spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { runShellCommand } from "../checks/command-runner.js";
import type { Evals } from "../shared/contracts.js";

const execFileAsync = promisify(execFile);

export interface HostSandboxOptions {
  /** Folder the per-run temp folders are created in; default the OS temp folder. */
  readonly workdirRoot?: string;
  /** Keep temp folders after the run, for debugging. */
  readonly keep?: boolean;
}

/**
 * Runs everything directly on this machine, in a fresh temp folder per run. No network control:
 * containment is up to the adapters (the Claude guard, Codex's own sandbox).
 */
export class HostSandbox implements Evals.Sandbox.Provider {
  // Neutral name for the temp folder, which the agent sees in every path.
  public static readonly TEMP_PREFIX = "project-";
  public readonly isolation = "host";

  public constructor(private readonly options: HostSandboxOptions = {}) {}

  public async open(): Promise<Evals.Sandbox.Box> {
    const root = await mkdtemp(
      path.join(
        this.options.workdirRoot ?? os.tmpdir(),
        HostSandbox.TEMP_PREFIX,
      ),
    );
    return new HostBox(root, !!this.options.keep);
  }
}

class HostBox implements Evals.Sandbox.Box {
  public readonly isolation = "host";
  public readonly workdir: string;
  public readonly hostWorkdir: string;
  public readonly shell: Evals.Commands.Runner = runShellCommand;

  public constructor(
    public readonly root: string,
    public readonly kept: boolean,
  ) {
    this.workdir = path.join(root, "work");
    this.hostWorkdir = this.workdir;
  }

  public resolve(rel: string): string {
    return path.resolve(this.workdir, rel);
  }

  public async exec(
    file: string,
    args: readonly string[],
    options: Evals.Sandbox.ExecOptions = {},
  ): Promise<Evals.Sandbox.ExecResult> {
    const { stdout, stderr } = await execFileAsync(file, [...args], {
      cwd: options.cwd ?? this.workdir,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { stdout, stderr };
  }

  public spawn(request: Evals.Sandbox.SpawnRequest) {
    return spawn(request.command, [...request.args], {
      cwd: request.cwd ?? this.workdir,
      env: { ...request.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  public async copyIn(hostPath: string, boxPath: string): Promise<void> {
    await cp(hostPath, boxPath, { recursive: true });
  }

  public readFile(boxPath: string): Promise<string | undefined> {
    return readFile(boxPath, "utf8").catch(() => undefined);
  }

  public exists(boxPath: string): Promise<boolean> {
    return access(boxPath).then(
      () => true,
      () => false,
    );
  }

  public async writeFile(boxPath: string, content: string): Promise<void> {
    await mkdir(path.dirname(boxPath), { recursive: true });
    await writeFile(boxPath, content);
  }

  public async sync(): Promise<void> {}

  /** Nothing to do: on the host, the adapters' own kill reaches the agent process. */
  public async stopProcesses(): Promise<void> {}

  public async networkLog(): Promise<undefined> {
    return undefined;
  }

  public async close(): Promise<void> {
    if (!this.kept)
      await rm(this.root, { recursive: true, force: true, maxRetries: 3 });
  }
}
