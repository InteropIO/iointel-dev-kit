// Assembles the RunReport written to summary.json and printed by the CLI.
import type { Evals } from "../shared/contracts.js";
import type { ReportParts } from "../shared/types.js";

export function buildRunReport(parts: ReportParts): Evals.Report.RunReport {
  return {
    runId: parts.runId,
    startedAt: parts.startedAt.toISOString(),
    finishedAt: parts.finishedAt.toISOString(),
    options: {
      ...(parts.options.caseId ? { caseId: parts.options.caseId } : {}),
      ...(parts.options.model ? { model: parts.options.model } : {}),
      concurrency: parts.concurrency,
    },
    reference: {
      kind: parts.reference.kind,
      ...(parts.reference.runId ? { runId: parts.reference.runId } : {}),
    },
    cases: parts.cases,
    comparison: parts.comparison,
    totals: {
      costUsd: parts.cases.reduce((sum, c) => sum + (c.costUsd ?? 0), 0),
      costUnknown: parts.cases.some((c) => c.costUsd === null),
      casesPassed: parts.cases.filter((c) => c.pass).length,
      casesFailed: parts.cases.filter((c) => !c.pass).length,
    },
    resultsPath: parts.runDir,
  };
}
