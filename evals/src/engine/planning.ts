// Step 1 of a run: decide what to run. Loads the cases and applies the --case filter.
import { loadCases } from "../cases/loader.js";
import type { Evals } from "../shared/contracts.js";

/** The cases matching the --case filter. Each one runs once. */
export async function selectCases(
  options: Evals.Engine.Options,
): Promise<Evals.Cases.Case[]> {
  return (await loadCases(options.casesDir))
    .map((loaded) => loaded.case)
    .filter((c) => !options.caseId || c.id === options.caseId);
}
