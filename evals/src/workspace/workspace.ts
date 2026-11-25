import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Evals } from "../shared/contracts.js";
import type { GitWorkspaceOptions } from "../shared/types.js";
import { HostSandbox } from "../sandbox/host-sandbox.js";

/**
 * Opens a fresh box per run (a temp folder, or a container), seeds its workdir, installs the skill
 * where the tool discovers it, and commits the starting state to a throwaway git repo so the final
 * diff is exact. The diff is taken against that commit's hash, not HEAD, so it still holds if the
 * agent commits. Everything goes through the box, so the same steps work on the host and in a container.
 *
 * Official templates are fetched once per eval run: the first run that needs one materializes it,
 * a copy is kept on the host, and every other run of that template is seeded from the copy.
 *
 * Not a singleton: each instance is bound to a skill folder and local templates folder, and tests
 * create one per isolated environment. The CLI creates one per eval run.
 */
export class GitWorkspaceManager implements Evals.Workspace.Manager {
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
  private static readonly GIT_CONFIG: readonly string[] = [
    "-c",
    "user.name=eval",
    "-c",
    "user.email=eval@localhost",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.autocrlf=false",
  ];

  private readonly sandbox: Evals.Sandbox.Provider;
  public readonly isolation: Evals.Sandbox.Isolation;
  /** Official template id → host folder holding it, fetched once. A failure stays cached too. */
  private readonly templates = new Map<string, Promise<string>>();
  private templateCacheDir: Promise<string> | undefined;

  public constructor(private readonly options: GitWorkspaceOptions) {
    this.sandbox =
      options.sandbox ??
      new HostSandbox({
        ...(options.workdirRoot ? { workdirRoot: options.workdirRoot } : {}),
        ...(options.keep ? { keep: options.keep } : {}),
      });
    this.isolation = this.sandbox.isolation;
  }

  public async start(tools: readonly string[]): Promise<void> {
    await this.sandbox.start?.(tools);
  }

  public async stop(): Promise<void> {
    await this.sandbox.stop?.();
    const cacheDir = await this.templateCacheDir?.catch(() => undefined);
    this.templates.clear();
    this.templateCacheDir = undefined;
    if (cacheDir && !this.options.keep)
      await rm(cacheDir, { recursive: true, force: true, maxRetries: 3 });
  }

  public async prepare({
    template,
    skillInstallPath,
    withSkill,
    network = true,
  }: Evals.Workspace.PrepareOptions): Promise<Evals.Workspace.Prepared> {
    const box = await this.sandbox.open({ network });
    try {
      await this.seed(box, template);
      await GitWorkspaceManager.ensureGitignore(box);
      const skillRel = skillInstallPath.replaceAll("\\", "/");
      if (withSkill)
        await box.copyIn(this.options.skillDir, box.resolve(skillRel));

      await GitWorkspaceManager.git(box, ["init", "-q"]);
      await GitWorkspaceManager.git(box, ["add", "-A"]);
      await GitWorkspaceManager.git(box, [
        "commit",
        "-q",
        "--no-verify",
        "--allow-empty",
        "-m",
        "eval: starting state",
      ]);
      const start = (
        await GitWorkspaceManager.git(box, ["rev-parse", "HEAD"])
      ).stdout.trim();

      return {
        workdir: box.workdir,
        box,
        kept: box.kept,
        diff: () => GitWorkspaceManager.diff(box, start, skillRel),
        cleanup: () => box.close(),
      };
    } catch (err) {
      await box.close().catch(() => {});
      throw err;
    }
  }

  private async seed(
    box: Evals.Sandbox.Box,
    template: Evals.Workspace.Template | undefined,
  ): Promise<void> {
    if (template && "official" in template) {
      await this.seedOfficial(box, template.official);
    } else if (template) {
      await box.copyIn(
        path.resolve(this.options.localTemplatesDir, template.local),
        box.workdir,
      );
    }
    // No template: the workdir starts empty. ensureGitignore always writes .gitignore, creating it.
  }

  /**
   * Each template is fetched once, in a box of its own that may reach every host on the global
   * allowlist, so the fetch neither depends on the first case's network setting nor shows up in a
   * run's network log. Every run is then seeded from the host copy. Runs that start while it's being
   * fetched wait for it. A failed fetch fails every run of that template with the same error, without retrying.
   */
  private async seedOfficial(
    box: Evals.Sandbox.Box,
    templateId: string,
  ): Promise<void> {
    let fetched = this.templates.get(templateId);
    if (!fetched) {
      fetched = this.fetchTemplate(templateId);
      fetched.catch(() => {}); // awaited below, and by every later run of this template
      this.templates.set(templateId, fetched);
    }
    await box.copyIn(await fetched, box.workdir);
  }

  private async fetchTemplate(templateId: string): Promise<string> {
    const box = await this.sandbox.open({ network: true });
    try {
      const materialize =
        this.options.materialize ?? this.materializeWithSkillScript;
      await materialize(templateId, box.workdir, box);
      await box.sync(); // a container's workdir is now in box.hostWorkdir too
      const dir = path.join(await this.cacheDir(), templateId);
      await cp(box.hostWorkdir, dir, { recursive: true });
      return dir;
    } finally {
      await box.close();
    }
  }

  private cacheDir(): Promise<string> {
    return (this.templateCacheDir ??= mkdtemp(
      path.join(this.options.workdirRoot ?? os.tmpdir(), "eval-templates-"),
    ));
  }

  /**
   * The skill's own materializer. On the host it runs from the skill folder; in a container the
   * skill folder is copied in first, outside the workdir, so the agent never sees the copy.
   */
  private readonly materializeWithSkillScript: Evals.Workspace.TemplateMaterializer =
    async (templateId, target, box) => {
      if (!box) throw new Error("the skill's materializer needs a box");
      let skillDir = this.options.skillDir;
      if (box.isolation !== "host") {
        skillDir = `${box.root}/.template-tool`;
        await box.copyIn(this.options.skillDir, skillDir);
      }
      const script =
        box.isolation === "host"
          ? path.join(skillDir, "scripts", "materialize-template.mjs")
          : `${skillDir}/scripts/materialize-template.mjs`;
      await box.exec(
        box.isolation === "host" ? process.execPath : "node",
        [script, "--template", templateId, "--target", target],
        { cwd: box.root },
      );
      if (box.isolation !== "host")
        await box.exec("rm", ["-rf", skillDir], { cwd: box.root });
    };

  /** Everything that differs from the starting commit, committed by the agent or not. */
  private static async diff(
    box: Evals.Sandbox.Box,
    start: string,
    skillRel: string,
  ): Promise<string> {
    const max = GitWorkspaceManager.MAX_DIFF_CHARS;
    await GitWorkspaceManager.git(box, ["add", "-A"]);
    const excludes = [
      ...GitWorkspaceManager.DIFF_EXCLUDES.map((f) => `:(exclude,glob)**/${f}`),
      `:(exclude)${skillRel}`,
    ];
    const { stdout } = await GitWorkspaceManager.git(box, [
      "diff",
      "--cached",
      "--no-color",
      start,
      "--",
      ".",
      ...excludes,
    ]);
    return stdout.length > max
      ? `${stdout.slice(0, max)}\n[diff truncated at ${max} characters]`
      : stdout;
  }

  private static async ensureGitignore(box: Evals.Sandbox.Box): Promise<void> {
    const file = box.resolve(".gitignore");
    const existing = (await box.readFile(file)) ?? "";
    const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
    const missing = GitWorkspaceManager.IGNORED.filter(
      (p) =>
        !lines.has(p) &&
        !lines.has(p.replace(/\/$/, "")) &&
        !lines.has(`/${p}`),
    );
    if (missing.length)
      await box.writeFile(
        file,
        `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`,
      );
  }

  private static git(box: Evals.Sandbox.Box, args: readonly string[]) {
    return box.exec("git", [...GitWorkspaceManager.GIT_CONFIG, ...args]);
  }
}
