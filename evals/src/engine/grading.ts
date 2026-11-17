// The judge step of a run: grades the agent's work against the case's rubric, line by line,
// and scores it as the share of counted lines that passed. Each rubric item has an optional type:
//   (none)     a standard line: counted in the score
//   "critical" counted in the score, and failing it fails the run whatever the score
//   "report"   graded and reported, but never counted and never fails the run
import { JudgeError } from "../judge/judge-error.js";
import type { Evals } from "../shared/contracts.js";
import type { Grading } from "../shared/types.js";

/** The case's judge checks, or undefined when it has none (trigger cases never do). */
export function judgeOf(
  c: Evals.Cases.Case,
): Evals.Cases.JudgeChecks | undefined {
  return c.kind === "trigger" ? undefined : c.output.judge;
}

// Floating-point slack, so 2/3 meets a threshold written as 0.6667 the way people expect.
const EPSILON = 1e-4;

/** The share of rubric items a run must pass: output.judge.threshold, default 1. */
export function rubricThresholdOf(c: Evals.Cases.Case): number {
  return judgeOf(c)?.threshold ?? 1;
}

/**
 * Whether a graded run meets the case's rubric: its score reaches the threshold and no critical
 * line failed. Ungraded runs and rubrics of only "report" lines pass.
 */
export function meetsRubric(c: Evals.Cases.Case, grading: Grading): boolean {
  return (
    !failedCritical(grading.lines) &&
    (grading.score === undefined ||
      grading.score >= rubricThresholdOf(c) - EPSILON)
  );
}

/** Whether any critical line failed. */
export function failedCritical(
  lines: readonly Evals.Judge.Line[] | undefined,
): boolean {
  return !!lines?.some((l) => l.type === "critical" && !l.pass);
}

/**
 * Grades one run. Never throws: when only grading fails, the run keeps the agent's result
 * (and its cost) and gets a failed "judge" check instead of judge lines.
 */
export async function gradeRun(
  judge: Evals.Judge.Grader,
  rubric: readonly Evals.Cases.RubricItem[],
  agent: Evals.Agent.RunResult,
  diff: string | undefined,
  workdir?: string,
): Promise<Grading> {
  try {
    // The judge sees only the assertions, never the types, so every line is graded the same way.
    const result = await judge.grade({
      rubric: rubric.map((item) => item.assertion),
      finalMessage: agent.finalMessage,
      transcript: agent.transcript,
      ...(diff !== undefined ? { diff } : {}),
      ...(workdir !== undefined ? { workdir } : {}),
    });
    const lines = result.lines.map((line, i) => {
      const type = rubric[i]?.type;
      return type ? { ...line, type } : line;
    });
    const counted = lines.filter((l) => l.type !== "report");
    return {
      lines,
      ...(counted.length
        ? { score: counted.filter((l) => l.pass).length / counted.length }
        : {}),
      costUsd: result.costUsd,
      ...(result.request ? { request: result.request } : {}),
    };
  } catch (err) {
    return {
      costUsd: 0,
      // Kept on errors too, so a refusal or bad verdict can be debugged from what was sent.
      ...(err instanceof JudgeError ? { request: err.request } : {}),
      failedCheck: {
        name: "judge",
        pass: false,
        detail: `judge error: ${(err as Error).message}`,
      },
    };
  }
}
