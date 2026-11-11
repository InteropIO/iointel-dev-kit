// Which skill is under test: EVAL_SKILL_DIR (from evals/.env or the environment) names its folder,
// and the `name` in its SKILL.md frontmatter is what the agent must load for a run to count as triggered.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EvalSetupError } from "../engine/index.js";

export interface SkillUnderTest {
  /** Absolute path of the skill folder (the one holding SKILL.md). */
  readonly dir: string;
  readonly name: string;
}

/**
 * Resolves the skill folder (relative paths are taken from evalsRoot) and reads its name.
 * Throws EvalSetupError when EVAL_SKILL_DIR is unset, the folder has no SKILL.md, or its name is
 * unusable as a folder name.
 */
export async function resolveSkill(
  evalsRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SkillUnderTest> {
  const configured = env.EVAL_SKILL_DIR?.trim();
  if (!configured)
    throw new EvalSetupError(
      "EVAL_SKILL_DIR is not set. Set it in evals/.env to the folder of the skill under test, e.g. EVAL_SKILL_DIR=../skills/io-intelligence",
    );
  const dir = path.resolve(evalsRoot, configured);
  const skillFile = path.join(dir, "SKILL.md");

  let content: string;
  try {
    content = await readFile(skillFile, "utf8");
  } catch {
    throw new EvalSetupError(
      `No SKILL.md in the skill folder ${dir} (EVAL_SKILL_DIR=${configured}). Point EVAL_SKILL_DIR in evals/.env at a skill folder.`,
    );
  }

  const name = frontmatterName(content) ?? path.basename(dir);
  if (!/^[\w.-]+$/.test(name))
    throw new EvalSetupError(
      `The skill name "${name}" in ${skillFile} must be a plain folder name (letters, digits, "-", "_", ".").`,
    );
  return { dir, name };
}

/** The `name:` value of a SKILL.md YAML frontmatter block, or undefined when there is none. */
export function frontmatterName(content: string): string | undefined {
  const block = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
  const value = block && /^name:\s*(.+?)\s*$/m.exec(block)?.[1];
  return value ? value.replace(/^(["'])(.*)\1$/, "$2") : undefined;
}
