// Step 1 of a run: decide what to run. Loads the cases, applies the filters, and expands every
// case into one unit per target, per repeat (and per skill-removed repeat with --baseline).
import { loadCases } from "../cases/loader.js";
import type { Evals } from "../shared/contracts.js";
import type { ParsedTarget, RunUnit } from "../shared/types.js";
import { DEFAULT_REPEAT } from "./defaults.js";

/** The cases matching the --kind and --case filters. */
export async function selectCases(
  options: Evals.Engine.Options,
): Promise<Evals.Cases.Case[]> {
  return (await loadCases(options.casesDir))
    .map((loaded) => loaded.case)
    .filter((c) => !options.kind || c.kind === options.kind)
    .filter((c) => !options.caseId || c.id === options.caseId);
}

/** Every run to make, after the --target filter. */
export function planRuns(
  cases: Evals.Cases.Case[],
  options: Evals.Engine.Options,
): RunUnit[] {
  const units: RunUnit[] = [];
  for (const c of cases) {
    for (const target of c.targets) {
      const { tool, model } = parseTarget(target);
      if (!matchesTargetFilter(options.target, target, tool)) continue;

      const repeat = c.repeat ?? options.repeat ?? DEFAULT_REPEAT;
      for (let index = 0; index < repeat; index++) {
        units.push({ case: c, target, tool, model, index, withSkill: true });
        if (options.withoutSkill)
          units.push({ case: c, target, tool, model, index, withSkill: false });
      }
    }
  }
  return units;
}

/** "claude-code/claude-sonnet-5-5" → tool "claude-code", model "claude-sonnet-5-5". */
function parseTarget(target: string): ParsedTarget {
  const slash = target.indexOf("/");
  return slash === -1
    ? { tool: target, model: undefined }
    : { tool: target.slice(0, slash), model: target.slice(slash + 1) };
}

/** --target takes an exact target id, or a tool name that matches all of that tool's targets. */
function matchesTargetFilter(
  filter: string | undefined,
  target: string,
  tool: string,
): boolean {
  return !filter || filter === target || filter === tool;
}
