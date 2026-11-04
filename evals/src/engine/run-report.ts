// Assembles the RunReport written to summary.json and printed by the CLI.
import type { Evals } from "../shared/contracts.js";
import type { ReportParts } from "../shared/types.js";

export function buildRunReport(parts: ReportParts): Evals.Report.RunReport {
  return {
    runId: parts.runId,
    startedAt: parts.startedAt.toISOString(),
    finishedAt: parts.finishedAt.toISOString(),
    options: echoOptions(parts.options, parts.concurrency),
    reference: {
      kind: parts.reference.kind,
      ...(parts.reference.runId ? { runId: parts.reference.runId } : {}),
    },
    cases: parts.cases,
    comparison: parts.comparison,
    totals: totals(parts.records, parts.cases),
    resultsPath: parts.runDir,
  };
}

/** The options the run used, without paths, so runs can be told apart in summary.json. */
function echoOptions(
  options: Evals.Engine.Options,
  concurrency: number,
): Evals.Report.RunReport["options"] {
  return {
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.caseId ? { caseId: options.caseId } : {}),
    ...(options.target ? { target: options.target } : {}),
    ...(options.repeat ? { repeat: options.repeat } : {}),
    concurrency,
    ...(options.maxCostUsd !== undefined
      ? { maxCostUsd: options.maxCostUsd }
      : {}),
    withoutSkill: !!options.withoutSkill,
  };
}

function totals(
  records: readonly Evals.Report.RunRecord[],
  cases: readonly Evals.Report.CaseReport[],
): Evals.Report.RunReport["totals"] {
  const costByTarget: Record<string, number> = {};
  for (const r of records)
    costByTarget[r.target] = (costByTarget[r.target] ?? 0) + (r.costUsd ?? 0);

  return {
    costUsd: records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    costUnknown: records.some((r) => !r.skipped && r.costUsd === null),
    costByTarget,
    runs: records.filter((r) => !r.skipped).length,
    skipped: records.filter((r) => r.skipped).length,
    casesPassed: cases.filter((c) => c.pass === true).length,
    casesFailed: cases.filter((c) => c.pass === false).length,
  };
}
