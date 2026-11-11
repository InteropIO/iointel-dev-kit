// Where run workspaces are created: EVAL_WORKDIR_ROOT (from evals/.env or the environment), or the
// OS temp folder when it is unset. It must be outside the repository: Node, TypeScript, Prettier,
// ESLint, npm and Claude Code all search parent folders, so a workspace under the repo would pick up
// evals/node_modules, its @types and its configs, and could pass a build a real project would fail.
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EvalSetupError } from "../engine/index.js";

/**
 * Resolves and creates the workspace root. Relative paths are taken from evalsRoot.
 * Throws EvalSetupError when the folder is inside repoRoot or cannot be created.
 */
export async function resolveWorkdirRoot(
  evalsRoot: string,
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const configured = env.EVAL_WORKDIR_ROOT?.trim();
  if (!configured) return os.tmpdir();

  const dir = path.resolve(evalsRoot, configured);
  if (isInside(dir, repoRoot))
    throw new EvalSetupError(
      `EVAL_WORKDIR_ROOT (${dir}) is inside the repository (${repoRoot}). Choose a folder outside it: tools in a workspace search parent folders and would pick up the repo's node_modules and configs.`,
    );
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    throw new EvalSetupError(
      `Cannot create EVAL_WORKDIR_ROOT (${dir}): ${(err as Error).message}`,
    );
  }
  return dir;
}

/** Whether child is parent itself or somewhere below it (case-insensitive on Windows). */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
