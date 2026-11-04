// Builds the CaseReport for each way a run can end: completed, or failed before the agent started.
import type { Evals } from "../shared/contracts.js";
import type { Grading } from "../shared/types.js";

/** The agent ran (possibly with an error), and its checks and grading are in. */
export function completedReport(
  c: Evals.Cases.Case,
  agent: Evals.Agent.RunResult,
  checks: readonly Evals.Checks.Result[],
  grading: Grading,
  transcriptFile: string | undefined,
): Evals.Report.CaseReport {
  const allChecks = grading.failedCheck
    ? [...checks, grading.failedCheck]
    : checks;
  const pass =
    allChecks.every((x) => x.pass) &&
    (grading.lines?.every((l) => l.pass) ?? true);

  return {
    caseId: c.id,
    ran: true,
    pass,
    skillTriggered: agent.skillTriggered,
    checks: allChecks,
    ...(grading.lines ? { judge: grading.lines } : {}),
    stopReason: agent.stopReason,
    ...(agent.error ? { error: agent.error } : {}),
    costUsd:
      agent.costUsd === null || grading.costUsd === null
        ? null
        : agent.costUsd + grading.costUsd,
    ...(transcriptFile ? { transcriptFile } : {}),
  };
}

/** The run failed before the agent could start, e.g. the workspace could not be prepared. Nothing was spent. */
export function notRunReport(
  c: Evals.Cases.Case,
  error: string,
): Evals.Report.CaseReport {
  return {
    caseId: c.id,
    ran: false,
    pass: false,
    skillTriggered: false,
    checks: [],
    stopReason: "error",
    error,
    costUsd: 0,
  };
}
