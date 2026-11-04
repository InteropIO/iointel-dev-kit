// Fails fast, before anything runs or is written, when an adapter or the judge cannot run.
import type { Evals } from "../shared/contracts.js";
import type { RunUnit } from "../shared/types.js";
import { EvalSetupError } from "./errors.js";
import { rubricOf } from "./grading.js";

/** Throws an EvalSetupError listing every problem found. */
export function checkSetup(units: RunUnit[], deps: Evals.Engine.Deps): void {
  const problems = [
    ...adapterProblems(units, deps.adapters),
    ...judgeProblems(units, deps.judge),
  ];
  if (problems.length) throw new EvalSetupError(problems.join("\n"));
}

function adapterProblems(
  units: RunUnit[],
  adapters: Evals.Engine.Deps["adapters"],
): string[] {
  const problems: string[] = [];
  for (const tool of new Set(units.map((u) => u.tool))) {
    const adapter = adapters[tool];
    if (!adapter) {
      problems.push(
        `no adapter for tool "${tool}" (known: ${Object.keys(adapters).join(", ")})`,
      );
      continue;
    }
    const notReady = adapter.checkReady();
    if (notReady) problems.push(`${tool}: ${notReady}`);
  }
  return problems;
}

function judgeProblems(
  units: RunUnit[],
  judge: Evals.Judge.Grader | undefined,
): string[] {
  if (!units.some((u) => rubricOf(u.case))) return [];
  if (!judge) return ["some cases have a rubric but no judge is configured"];
  const notReady = judge.checkReady();
  return notReady ? [`judge: ${notReady}`] : [];
}
