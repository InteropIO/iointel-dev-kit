// Fails fast, before anything runs or is written, when the adapter or the judge cannot run.
import type { Evals } from "../shared/contracts.js";
import { EvalSetupError } from "./errors.js";
import { rubricOf } from "./grading.js";

/** Throws an EvalSetupError listing every problem found. */
export function checkSetup(
  cases: Evals.Cases.Case[],
  deps: Evals.Engine.Deps,
): void {
  const adapterNotReady = deps.adapter.checkReady();
  const problems = [
    ...(adapterNotReady ? [`${deps.adapter.name}: ${adapterNotReady}`] : []),
    ...judgeProblems(cases, deps.judge),
  ];
  if (problems.length) throw new EvalSetupError(problems.join("\n"));
}

function judgeProblems(
  cases: Evals.Cases.Case[],
  judge: Evals.Judge.Grader | undefined,
): string[] {
  if (!cases.some(rubricOf)) return [];
  if (!judge) return ["some cases have a rubric but no judge is configured"];
  const notReady = judge.checkReady();
  return notReady ? [`judge: ${notReady}`] : [];
}
