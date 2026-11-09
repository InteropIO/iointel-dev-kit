// The judge step of a run: grades the agent's work against the case's rubric, line by line,
// and scores it as the share of lines that passed. Lines marked "[report-only]" are graded and
// reported but never count towards the score or the run's pass/fail.
import type { Evals } from "../shared/contracts.js";
import type { Grading } from "../shared/types.js";

/** The case's rubric, or undefined when it has none (trigger cases never do). */
export function rubricOf(c: Evals.Cases.Case): string | undefined {
  const rubric =
    c.kind === "answer"
      ? c.rubric
      : c.kind === "task"
        ? c.checks.reviewRubric
        : undefined;
  return rubric?.trim() ? rubric : undefined;
}

const REPORT_ONLY = /^\[report-only\]\s*/i;
// Floating-point slack, so 2/3 meets a threshold written as 0.6667 the way people expect.
const EPSILON = 1e-4;

/** The share of rubric lines a run must pass: rubricThreshold / reviewThreshold, default 1. */
export function rubricThresholdOf(c: Evals.Cases.Case): number {
  const threshold =
    c.kind === "answer"
      ? c.rubricThreshold
      : c.kind === "task"
        ? c.checks.reviewThreshold
        : undefined;
  return threshold ?? 1;
}

/** Whether a graded run meets the case's rubric threshold. Ungraded runs and report-only rubrics pass. */
export function meetsRubric(c: Evals.Cases.Case, grading: Grading): boolean {
  return (
    grading.score === undefined ||
    grading.score >= rubricThresholdOf(c) - EPSILON
  );
}

/**
 * Grades one run. Never throws: when only grading fails, the run keeps the agent's result
 * (and its cost) and gets a failed "judge" check instead of judge lines.
 */
export async function gradeRun(
  judge: Evals.Judge.Grader,
  rubric: string,
  agent: Evals.Agent.RunResult,
  diff: string | undefined,
): Promise<Grading> {
  const parsed = rubricLines(rubric);
  try {
    // The judge sees the lines without their markers, so report-only lines are graded the same way.
    const result = await judge.grade({
      rubric: parsed.map((l) => l.text),
      finalMessage: agent.finalMessage,
      transcript: agent.transcript,
      ...(diff !== undefined ? { diff } : {}),
    });
    const lines = result.lines.map((line, i) =>
      parsed[i]?.reportOnly ? { ...line, reportOnly: true } : line,
    );
    const counted = lines.filter((l) => !l.reportOnly);
    return {
      lines,
      ...(counted.length
        ? { score: counted.filter((l) => l.pass).length / counted.length }
        : {}),
      costUsd: result.costUsd,
    };
  } catch (err) {
    return {
      costUsd: 0,
      failedCheck: {
        name: "judge",
        pass: false,
        detail: `judge error: ${(err as Error).message}`,
      },
    };
  }
}

/** One rubric line per non-empty line, with list markers ("-", "*", "1.") and "[report-only]" removed. */
function rubricLines(rubric: string): { text: string; reportOnly: boolean }[] {
  return rubric
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map((l) => ({
      text: l.replace(REPORT_ONLY, "").trim(),
      reportOnly: REPORT_ONLY.test(l),
    }))
    .filter((l) => l.text);
}
