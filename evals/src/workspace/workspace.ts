import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Evals } from "../shared/contracts.js";
import type { TempWorkspaceOptions } from "../shared/types.js";

/**
 * Creates a fresh, empty temp folder per run and installs the skill where the tool discovers it.
 *
 * Not a singleton: each instance is bound to a skill folder, and tests create one per
 * isolated environment.
 */
export class TempWorkspaceManager implements Evals.Workspace.Manager {
  public constructor(private readonly options: TempWorkspaceOptions) {}

  public async prepare({
    skillInstallPath,
  }: Evals.Workspace.PrepareOptions): Promise<Evals.Workspace.Prepared> {
    const root = await mkdtemp(path.join(os.tmpdir(), "iointel-eval-"));
    const workdir = path.join(root, "work");
    const cleanup = () =>
      rm(root, { recursive: true, force: true, maxRetries: 3 });
    try {
      await mkdir(workdir);
      await cp(this.options.skillDir, path.join(workdir, skillInstallPath), {
        recursive: true,
      });
    } catch (err) {
      await cleanup();
      throw err;
    }

    return { workdir, cleanup };
  }
}
