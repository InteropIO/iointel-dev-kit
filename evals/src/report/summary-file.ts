// Shapes the RunReport into summary.json (Evals.Summary.File), and reads summary.json back
// (including the pre-version-2 format, which was the RunReport itself) for baseline comparison.
import type { Evals } from "../shared/contracts.js";

type Summary = Evals.Summary.File;
type RunReport = Evals.Report.RunReport;

export const SUMMARY_FILE = "summary.json";

export function toSummaryFile(report: RunReport): Summary {
  const changes = new Map(
    report.comparison.map((c) => [key(c.caseId, c.target), c]),
  );
  const { totals } = report;
  return {
    version: 2,
    run: {
      id: report.runId,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      durationSec: Math.round(
        (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000,
      ),
      options: report.options,
      comparedTo: report.reference,
      resultsPath: report.resultsPath,
    },
    totals: {
      verdict: totals.casesFailed
        ? "fail"
        : totals.casesPassed
          ? "pass"
          : "skipped",
      cases: {
        passed: totals.casesPassed,
        failed: totals.casesFailed,
        skipped: report.cases.length - totals.casesPassed - totals.casesFailed,
      },
      runs: { ran: totals.runs, skipped: totals.skipped },
      cost: {
        usd: usd(totals.costUsd),
        incomplete: totals.costUnknown,
        byTarget: Object.fromEntries(
          Object.entries(totals.costByTarget).map(([t, v]) => [t, usd(v)]),
        ),
      },
    },
    cases: report.cases.map((c) =>
      toCase(c, changes.get(key(c.caseId, c.target))),
    ),
    removed: report.comparison
      .filter((c) => c.status === "removed")
      .map((c) => ({
        id: c.caseId,
        target: c.target,
        before: {
          pass: share(c.passRate.before),
          trigger: share(c.triggerRate.before),
          rubric: share(c.rubricScore.before),
        },
      })),
  };
}

function toCase(
  c: Evals.Report.CaseReport,
  change: Evals.Report.CaseComparison | undefined,
): Evals.Summary.Case {
  return {
    id: c.caseId,
    kind: c.kind,
    target: c.target,
    verdict: verdict(c.pass),
    scores: {
      pass: share(c.passRate),
      trigger: share(c.triggerRate),
      rubric: share(c.rubricScore),
    },
    passThreshold: c.threshold,
    ran: c.ran,
    skipped: c.skipped,
    network: c.network,
    costUsd: usd(c.costUsd),
    ...(change && change.status !== "removed"
      ? {
          change: {
            status: change.status,
            before: {
              pass: share(change.passRate.before),
              trigger: share(change.triggerRate.before),
              rubric: share(change.rubricScore.before),
            },
            ...(change.flowDiff
              ? {
                  flow: {
                    added: change.flowDiff.added.length,
                    removed: change.flowDiff.removed.length,
                  },
                }
              : {}),
          },
        }
      : {}),
    oddRuns: c.oddRuns.map((i) => i + 1),
    files: {
      report: `reports/${c.caseId}.md`,
      flow: `flows/${c.caseId}.md`,
    },
    runs: c.runs.map(toRun),
    ...(c.withoutSkill
      ? {
          withoutSkill: {
            ran: c.withoutSkill.ran,
            scores: {
              pass: share(c.withoutSkill.passRate),
              trigger: share(c.withoutSkill.triggerRate),
            },
            runs: c.withoutSkill.runs.map(toRun),
          },
        }
      : {}),
  };
}

function toRun(r: Evals.Report.RunRecord): Evals.Summary.Run {
  const failed = r.checks.filter((c) => !c.pass).length;
  return {
    run: r.index + 1,
    verdict: r.skipped ? "skipped" : r.pass ? "pass" : "fail",
    ...(r.skipReason ? { skipReason: r.skipReason } : {}),
    ...(r.error ? { error: r.error } : {}),
    ...(r.stopReason ? { stopReason: r.stopReason } : {}),
    ...(r.flow ? { turns: r.flow.turns } : {}),
    costUsd: r.costUsd === null ? null : usd(r.costUsd),
    trigger: {
      triggered: r.triggered,
      ...(r.triggerDetection ? { via: r.triggerDetection } : {}),
    },
    checks: {
      passed: r.checks.length - failed,
      failed,
      results: r.checks,
    },
    ...(r.judge
      ? {
          judge: {
            score: share(r.rubricScore ?? null),
            results: r.judge.map((l) => ({
              criterion: l.text,
              pass: l.pass,
              reason: l.reason,
              ...(l.reportOnly ? { reportOnly: true as const } : {}),
            })),
          },
        }
      : {}),
    files: {
      ...(r.transcriptFile ? { transcript: r.transcriptFile } : {}),
      ...(r.workdir ? { workdir: r.workdir } : {}),
    },
    ...(r.flow ? { flow: r.flow.steps } : {}),
  };
}

/**
 * The baseline entries a saved summary.json describes. Reads both version 2 and the earlier
 * format (the RunReport itself), so runs saved before the change still serve as a reference.
 */
export function summaryEntries(
  saved: Summary | RunReport,
): Evals.Baseline.Entry[] {
  if (!isVersion2(saved))
    return saved.cases.map((c) => ({
      caseId: c.caseId,
      target: c.target,
      kind: c.kind,
      pass: c.pass,
      passRate: c.passRate,
      triggerRate: c.triggerRate,
      rubricScore: c.rubricScore,
      costUsd: c.costUsd,
      flows: c.runs.flatMap((r) => (r.flow ? [r.flow.steps] : [])),
    }));
  return saved.cases.map((c) => ({
    caseId: c.id,
    target: c.target,
    kind: c.kind,
    pass: c.verdict === "skipped" ? null : c.verdict === "pass",
    passRate: c.scores.pass,
    triggerRate: c.scores.trigger,
    rubricScore: c.scores.rubric,
    costUsd: c.costUsd,
    flows: c.runs.flatMap((r) => (r.flow ? [r.flow] : [])),
  }));
}

/** The filter options a saved summary.json was run with. */
export function summaryOptions(
  saved: Summary | RunReport,
): Evals.Engine.Filters {
  return isVersion2(saved) ? saved.run.options : saved.options;
}

function isVersion2(saved: Summary | RunReport): saved is Summary {
  return (saved as Summary).version === 2;
}

function verdict(pass: boolean | null): Evals.Summary.Verdict {
  return pass === null ? "skipped" : pass ? "pass" : "fail";
}

const key = (caseId: string, target: string) => `${caseId}|${target}`;
const usd = (n: number) => Math.round(n * 10_000) / 10_000;
const share = (n: number | null) =>
  n === null ? null : Math.round(n * 1000) / 1000;
