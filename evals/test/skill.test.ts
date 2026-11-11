import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractClaudeFlow } from "../src/flow/claude-flow.js";
import { extractCodexFlow } from "../src/flow/codex-flow.js";
import { frontmatterName, resolveSkill } from "../src/workspace/skill.js";

async function skillFolder(root: string, folder: string, skillMd?: string) {
  const dir = path.join(root, folder);
  await mkdir(dir, { recursive: true });
  if (skillMd !== undefined) await writeFile(path.join(dir, "SKILL.md"), skillMd);
  return dir;
}

describe("skill under test", () => {
  it("requires EVAL_SKILL_DIR", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "evals-skill-"));
    await skillFolder(
      root,
      "skills/io-intelligence",
      "---\nname: io-intelligence\ndescription: x\n---\n",
    );
    for (const env of [{}, { EVAL_SKILL_DIR: "  " }])
      await expect(resolveSkill(path.join(root, "evals"), env)).rejects.toThrow(
        /EVAL_SKILL_DIR is not set/,
      );
  });

  it("uses EVAL_SKILL_DIR, relative or absolute, and takes the name from SKILL.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "evals-skill-"));
    const dir = await skillFolder(
      root,
      "other/folder",
      '---\r\nname: "my-skill"\r\ndescription: x\r\n---\r\n',
    );
    const evalsRoot = path.join(root, "evals");
    expect(
      await resolveSkill(evalsRoot, { EVAL_SKILL_DIR: "../other/folder" }),
    ).toEqual({ dir, name: "my-skill" });
    expect(await resolveSkill(evalsRoot, { EVAL_SKILL_DIR: dir })).toEqual({
      dir,
      name: "my-skill",
    });
  });

  it("falls back to the folder name when SKILL.md has no frontmatter name", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "evals-skill-"));
    const dir = await skillFolder(root, "plain-skill", "# Plain\n");
    expect(await resolveSkill(root, { EVAL_SKILL_DIR: dir })).toEqual({
      dir,
      name: "plain-skill",
    });
  });

  it("rejects a folder without SKILL.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "evals-skill-"));
    await skillFolder(root, "empty");
    await expect(
      resolveSkill(root, { EVAL_SKILL_DIR: "empty" }),
    ).rejects.toThrow(/No SKILL\.md/);
  });

  it("reads only the frontmatter name", () => {
    expect(frontmatterName("---\nname: a-b\n---\nname: body")).toBe("a-b");
    expect(frontmatterName("no frontmatter\nname: x")).toBeUndefined();
  });

  it("detects triggering by the installed skill's own name", () => {
    const workdir = path.join(os.tmpdir(), "iointel-eval-xyz", "work");
    const skillCall = (skill: string) => [
      {
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Skill", input: { skill } },
          ],
        },
      },
    ];
    const install = ".claude/skills/my-skill";
    expect(
      extractClaudeFlow(skillCall("my-skill"), workdir, install).skillTriggered,
    ).toBe(true);
    expect(
      extractClaudeFlow(skillCall("io-intelligence"), workdir, install)
        .skillTriggered,
    ).toBe(false);

    const codex = extractCodexFlow(
      [
        {
          type: "command_execution",
          command: "cat .agents/skills/my-skill/SKILL.md",
          exit_code: 0,
        },
      ],
      workdir,
      ".agents/skills/my-skill",
    );
    expect(codex.skillTriggered).toBe(true);
    expect(codex.steps[0]).toEqual({
      kind: "skill-loaded",
      skill: "my-skill",
      via: "skill-md-read",
    });
  });
});
