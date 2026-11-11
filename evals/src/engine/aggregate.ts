// Turns the run records into one CaseReport per case and target, with its pass/fail verdict.
import { findOddRuns } from "../flow/compare.js";
import type { Evals } from "../shared/contracts.js";
import type { RunUnit } from "../shared/types.js";
import { TRIGGER_THRESHOLD } from "./defaults.js";
import { judgeOf, rubricThresholdOf } from "./grading.js";

type RunRecord = Evals.Report.RunRecord;

export function aggregateCases(
  cases: Evals.Cases.Case[],
  units: RunUnit[],
  records: RunRecord[],
  options: Evals.Engine.Options,
): Evals.Report.CaseReport[] {
  const reports: Evals.Report.CaseReport[] = [];
  for (const c of cases) {
    const targets = new Set(
      units.filter((u) => u.case.id === c.id).map((u) => u.target),
    );
    for (const target of targets) {
      const mine = records.filter(
        (r) => r.caseId === c.id && r.target === target,
      );
      reports.push(caseReport(c, target, mine, options));
    }
  }
  return reports;
}

/** A case passes on a target when its pass rate over the runs that ran reaches the threshold. */
function caseReport(
  c: Evals.Cases.Case,
  target: string,
  records: RunRecord[],
  options: Evals.Engine.Options,
): Evals.Report.CaseReport {
  const withSkill = records.filter((r) => r.withSkill);
  const ran = withSkill.filter((r) => !r.skipped);
  const passRate = rate(ran, (r) => r.pass);
  const threshold =
    c.passThreshold ?? (c.kind === "trigger" ? TRIGGER_THRESHOLD : 1);
  const { odd } = findOddRuns(ran.map((r) => r.flow?.steps ?? []));

  return {
    caseId: c.id,
    kind: c.kind,
    target,
    prompt: c.input.prompt,
    ...(c.input.reply ? { reply: c.input.reply } : {}),
    network: c.network,
    pass: passRate === null ? null : passRate >= threshold - 1e-9,
    threshold,
    rubricThreshold: judgeOf(c) ? rubricThresholdOf(c) : null,
    ran: ran.length,
    skipped: withSkill.length - ran.length,
    passRate,
    triggerRate: rate(ran, (r) => r.triggered),
    rubricScore: meanRubricScore(ran),
    costUsd: records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    costUnknown: records.some((r) => !r.skipped && r.costUsd === null),
    oddRuns: odd.map((i) => ran[i]!.index),
    runs: withSkill,
    ...(options.withoutSkill
      ? { withoutSkill: withoutSkillSummary(records) }
      : {}),
  };
}

/** The --baseline side: the same case with the skill removed, to show what the skill adds. */
function withoutSkillSummary(records: RunRecord[]) {
  const without = records.filter((r) => !r.withSkill);
  const ran = without.filter((r) => !r.skipped);
  return {
    ran: ran.length,
    passRate: rate(ran, (r) => r.pass),
    triggerRate: rate(ran, (r) => r.triggered),
    runs: without,
  };
}

/** Mean rubric score of the runs the judge graded, or null when it graded none. */
function meanRubricScore(records: RunRecord[]): number | null {
  const scores = records.flatMap((r) =>
    r.rubricScore === undefined ? [] : [r.rubricScore],
  );
  return scores.length
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : null;
}

/** Share of records matching the predicate, or null when there are none. */
function rate(
  records: RunRecord[],
  predicate: (r: RunRecord) => boolean,
): number | null {
  return records.length
    ? records.filter(predicate).length / records.length
    : null;
}
