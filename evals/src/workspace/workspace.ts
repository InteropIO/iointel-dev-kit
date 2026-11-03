import { execFile } from "node:child_process";
import { appendFile, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { TaskCase } from "../cases/schema.js";

const exec = promisify(execFile);

export type WorkspaceSetup = TaskCase["setup"];

export interface PreparedWorkspace {
  readonly workdir: string;
  /** Changes since the workspace was prepared (git diff, lockfiles and the skill folder excluded). */
  diff(): Promise<string>;
  cleanup(): Promise<void>;
}

export interface PrepareOptions {
  readonly setup: WorkspaceSetup;
  readonly skillInstallPath: string;
  readonly withSkill: boolean;
}

export interface WorkspaceManager {
  prepare(options: PrepareOptions): Promise<PreparedWorkspace>;
}

export type TemplateMaterializer = (
  templateId: string,
  target: string,
) => Promise<void>;

export interface GitWorkspaceOptions {
  /** The working copy of the skill under test. */
  readonly skillDir: string;
  /** Folder that `setup.fixture` paths are relative to. */
  readonly fixturesDir: string;
  /** Keep temp folders after the run, for debugging. */
  readonly keep?: boolean;
  readonly materialize?: TemplateMaterializer;
}

/**
 * Creates a fresh temp folder per run, seeds it, installs the skill where the tool discovers it,
 * and commits the starting state to a throwaway git repo so the final diff is exact.
 *
 * Not a singleton: each instance is bound to a skill folder and fixtures folder, and tests
 * create one per isolated environment.
 */
export class GitWorkspaceManager implements WorkspaceManager {
  private static readonly IGNORED: readonly string[] = [
    "node_modules/",
    "dist/",
    ".angular/",
  ];
  private static readonly DIFF_EXCLUDES: readonly string[] = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ];
  private static readonly MAX_DIFF_CHARS = 200_000;

  public constructor(private readonly options: GitWorkspaceOptions) {}

  public async prepare({
    setup,
    skillInstallPath,
    withSkill,
  }: PrepareOptions): Promise<PreparedWorkspace> {
    const root = await mkdtemp(path.join(os.tmpdir(), "iointel-eval-"));
    const workdir = path.join(root, "work");

    if ("template" in setup) {
      await (this.options.materialize ?? this.materializeWithSkillScript)(
        setup.template,
        workdir,
      );
    } else if ("fixture" in setup) {
      await cp(path.resolve(this.options.fixturesDir, setup.fixture), workdir, {
        recursive: true,
      });
    } else {
      await mkdir(workdir);
    }

    await GitWorkspaceManager.ensureGitignore(workdir);
    const skillRel = skillInstallPath.replaceAll("\\", "/");
    if (withSkill)
      await cp(this.options.skillDir, path.join(workdir, skillInstallPath), {
        recursive: true,
      });

    await GitWorkspaceManager.git(workdir, ["init", "-q"]);
    await GitWorkspaceManager.git(workdir, ["add", "-A"]);
    await GitWorkspaceManager.git(workdir, [
      "commit",
      "-q",
      "--no-verify",
      "--allow-empty",
      "-m",
      "eval: starting state",
    ]);

    return {
      workdir,
      diff: () => GitWorkspaceManager.diff(workdir, skillRel),
      cleanup: async () => {
        if (!this.options.keep)
          await rm(root, { recursive: true, force: true, maxRetries: 3 });
      },
    };
  }

  private readonly materializeWithSkillScript: TemplateMaterializer = async (
    templateId,
    target,
  ) => {
    const script = path.join(
      this.options.skillDir,
      "scripts",
      "materialize-template.mjs",
    );
    await exec(
      process.execPath,
      [script, "--template", templateId, "--target", target],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  };

  private static async diff(
    workdir: string,
    skillRel: string,
  ): Promise<string> {
    const max = GitWorkspaceManager.MAX_DIFF_CHARS;
    await GitWorkspaceManager.git(workdir, ["add", "-A"]);
    const excludes = [
      ...GitWorkspaceManager.DIFF_EXCLUDES.map((f) => `:(exclude,glob)**/${f}`),
      `:(exclude)${skillRel}`,
    ];
    const { stdout } = await GitWorkspaceManager.git(workdir, [
      "diff",
      "--cached",
      "--no-color",
      "--",
      ".",
      ...excludes,
    ]);
    return stdout.length > max
      ? `${stdout.slice(0, max)}\n[diff truncated at ${max} characters]`
      : stdout;
  }

  private static async ensureGitignore(workdir: string): Promise<void> {
    const file = path.join(workdir, ".gitignore");
    const existing = await readFile(file, "utf8").catch(() => "");
    const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
    const missing = GitWorkspaceManager.IGNORED.filter(
      (p) =>
        !lines.has(p) &&
        !lines.has(p.replace(/\/$/, "")) &&
        !lines.has(`/${p}`),
    );
    if (missing.length)
      await appendFile(
        file,
        `${existing && !existing.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`,
      );
  }

  private static git(cwd: string, args: readonly string[]) {
    return exec(
      "git",
      [
        "-c",
        "user.name=eval",
        "-c",
        "user.email=eval@localhost",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.autocrlf=false",
        ...args,
      ],
      { cwd, maxBuffer: 50 * 1024 * 1024 },
    );
  }
}
