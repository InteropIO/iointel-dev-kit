// Compares the judge's verdicts with the human labels and computes the calibration numbers
// (docs/judge-governance.md §5.1). Pure: no files, no judge.

import type { Evals } from "../shared/contracts.js";
import type { Mutable } from "../shared/types.js";

type Targets = Evals.Calibration.Targets;
type LineStats = Mutable<Evals.Calibration.LineStats>;

/** The example targets from judge-governance.md §5.1. */
export const DEFAULT_TARGETS: Targets = {
  minAgreement: 0.9,
  maxFalsePassRate: 0.05,
  maxFalseFailRate: 0.1,
};

export function scoreCalibration(
  items: readonly Evals.Calibration.ItemGradings[],
  targets: Targets = DEFAULT_TARGETS,
): Evals.Calibration.Score {
  const lines = new Map<string, LineStats>();
  const disagreements: Evals.Calibration.Disagreement[] = [];
  const skipped: { item: string; reason: string }[] = [];
  const errors: { item: string; source: string; error: string }[] = [];
  const strayLabels: { item: string; line: string }[] = [];
  let gradings = 0,
    agree = 0,
    falsePasses = 0,
    falseFails = 0,
    humanPass = 0,
    humanFail = 0,
    unlabelled = 0,
    missing = 0,
    flips = 0;

  for (const item of items) {
    if (item.skipped) skipped.push({ item: item.id, reason: item.skipped });
    const label = new Map(item.labels.map((l) => [l.line, l]));
    for (const l of item.labels)
      if (!item.rubric.includes(l.line))
        strayLabels.push({ item: item.id, line: l.line });
    const ok = item.gradings.filter((g) => {
      if (g.error)
        errors.push({ item: item.id, source: g.source, error: g.error });
      return !g.error;
    });
    gradings += ok.length;

    for (const line of item.rubric) {
      const stats =
        lines.get(line) ??
        lines
          .set(line, {
            line,
            reportOnly: item.reportOnly.includes(line),
            critical: item.critical.includes(line),
            verdicts: 0,
            falsePasses: 0,
            falseFails: 0,
            flips: 0,
          })
          .get(line)!;
      const human = label.get(line);
      const verdicts = ok.map((g) => ({ g, v: g.lines.get(line) }));
      const given = verdicts.filter((x) => x.v);
      if (new Set(given.map((x) => x.v!.pass)).size > 1) {
        stats.flips++;
        flips++;
      }
      if (human?.pass == null) {
        unlabelled += ok.length;
        continue;
      }
      missing += verdicts.length - given.length;
      for (const { g, v } of given) {
        stats.verdicts++;
        if (human.pass) humanPass++;
        else humanFail++;
        const outcome: Evals.Calibration.Outcome =
          v!.pass === human.pass
            ? "agree"
            : v!.pass
              ? "false pass"
              : "false fail";
        if (outcome === "agree") {
          agree++;
          continue;
        }
        if (outcome === "false pass") {
          falsePasses++;
          stats.falsePasses++;
        } else {
          falseFails++;
          stats.falseFails++;
        }
        disagreements.push({
          item: item.id,
          line,
          source: g.source,
          outcome,
          judgeReason: v!.reason,
          humanEvidence: human.evidence,
        });
      }
    }
  }

  const verdicts = agree + falsePasses + falseFails;
  const rate = (n: number, of: number) => (of ? n / of : null);
  const agreement = rate(agree, verdicts);
  const falsePassRate = rate(falsePasses, humanFail);
  const falseFailRate = rate(falseFails, humanPass);

  const problems: string[] = [];
  let measured = true;
  if (agreement === null) {
    problems.push("No labelled verdicts to compare: fill in labels.json.");
    measured = false;
  } else if (agreement < targets.minAgreement)
    problems.push(
      `Agreement ${pct(agreement)} is below ${pct(targets.minAgreement)}.`,
    );
  if (falsePassRate === null) {
    if (agreement !== null)
      problems.push(
        "No line is labelled fail, so the false-pass rate can't be measured: add seeded items with planted mistakes.",
      );
    measured = false;
  } else if (falsePassRate > targets.maxFalsePassRate)
    problems.push(
      `False-pass rate ${pct(falsePassRate)} is above ${pct(targets.maxFalsePassRate)}.`,
    );
  if (falseFailRate !== null && falseFailRate > targets.maxFalseFailRate)
    problems.push(
      `False-fail rate ${pct(falseFailRate)} is above ${pct(targets.maxFalseFailRate)}.`,
    );
  const missedTarget =
    (agreement !== null && agreement < targets.minAgreement) ||
    (falsePassRate !== null && falsePassRate > targets.maxFalsePassRate) ||
    (falseFailRate !== null && falseFailRate > targets.maxFalseFailRate);

  return {
    items: items.length,
    gradings,
    verdicts,
    agree,
    falsePasses,
    falseFails,
    humanPass,
    humanFail,
    agreement,
    falsePassRate,
    falseFailRate,
    unlabelled,
    missing,
    flips,
    lines: [...lines.values()].sort(
      (a, b) =>
        b.falsePasses - a.falsePasses ||
        b.flips - a.flips ||
        b.falseFails - a.falseFails,
    ),
    disagreements,
    skipped,
    errors,
    strayLabels,
    status: missedTarget ? "fail" : measured ? "pass" : "incomplete",
    problems,
  };
}

export const pct = (v: number | null) =>
  v === null ? "-" : `${Math.round(v * 1000) / 10}%`;
