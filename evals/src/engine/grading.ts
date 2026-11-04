// The judge step of a run: grades the agent's work against the case's rubric, line by line.
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
  try {
    const result = await judge.grade({
      rubric: rubricLines(rubric),
      finalMessage: agent.finalMessage,
      transcript: agent.transcript,
      ...(diff !== undefined ? { diff } : {}),
    });
    return { lines: result.lines, costUsd: result.costUsd };
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

/** One rubric line per non-empty line, with list markers ("-", "*", "1.") removed. */
function rubricLines(rubric: string): string[] {
  return rubric
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
