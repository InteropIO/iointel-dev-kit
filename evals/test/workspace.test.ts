import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { resolveWorkdirRoot } from "../src/workspace/workdir-root.js";
import { GitWorkspaceManager } from "../src/workspace/workspace.js";

const exec = promisify(execFile);
const git = (cwd: string, ...args: string[]) =>
  exec(
    "git",
    ["-c", "user.name=Agent", "-c", "user.email=agent@example.com", ...args],
    { cwd },
  ).then((r) => r.stdout);

async function prepare(workdirRoot?: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "evals-ws-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: s\n---\n");
  const manager = new GitWorkspaceManager({
    skillDir,
    localTemplatesDir: path.join(root, "templates"),
    ...(workdirRoot ? { workdirRoot } : {}),
  });
  return manager.prepare({
    skillInstallPath: ".claude/skills/s",
    withSkill: true,
  });
}

describe("workspace git repo", () => {
  it("keeps changes the agent committed in the diff, alongside uncommitted ones", async () => {
    const ws = await prepare();
    try {
      await writeFile(path.join(ws.workdir, "committed.txt"), "one\n");
      await git(ws.workdir, "add", "-A");
      await git(ws.workdir, "commit", "-q", "-m", "agent work");
      await writeFile(path.join(ws.workdir, "uncommitted.txt"), "two\n");

      const diff = await ws.diff();
      expect(diff).toContain("+++ b/committed.txt");
      expect(diff).toContain("+++ b/uncommitted.txt");
      expect(diff).not.toContain(".claude/skills/s");
    } finally {
      await ws.cleanup();
    }
  });

  it("works in a neutrally named temp folder, from one starting commit", async () => {
    const ws = await prepare();
    try {
      expect(path.basename(path.dirname(ws.workdir))).toMatch(/^project-/);
      const log = await git(ws.workdir, "log", "--format=%an <%ae> %s");
      expect(log.trim()).toBe("eval <eval@localhost> eval: starting state");
    } finally {
      await ws.cleanup();
    }
  });
});

describe("workspace root", () => {
  it("defaults to the OS temp folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "evals-root-"));
    expect(await resolveWorkdirRoot(root, root, {})).toBe(os.tmpdir());
  });

  it("creates EVAL_WORKDIR_ROOT, relative to the evals folder, and runs workspaces there", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "evals-root-"));
    const repo = path.join(base, "repo");
    const evalsRoot = path.join(repo, "evals");
    const dir = await resolveWorkdirRoot(evalsRoot, repo, {
      EVAL_WORKDIR_ROOT: "../../workdirs",
    });
    expect(dir).toBe(path.join(base, "workdirs"));

    const ws = await prepare(dir);
    try {
      expect(path.dirname(path.dirname(ws.workdir))).toBe(dir);
    } finally {
      await ws.cleanup();
    }
  });

  it("rejects a root inside the repository", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "evals-root-"));
    const evalsRoot = path.join(repo, "evals");
    for (const value of [".workdirs", "..", repo.toUpperCase()])
      await expect(
        resolveWorkdirRoot(evalsRoot, repo, { EVAL_WORKDIR_ROOT: value }),
      ).rejects.toThrow(/inside the repository/);
  });
});
