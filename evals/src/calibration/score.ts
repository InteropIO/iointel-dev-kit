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
  const agreementCi = wilson(agree, verdicts);
  const falsePassRateCi = wilson(falsePasses, humanFail);
  const falseFailRateCi = wilson(falseFails, humanPass);
  // Judge passed = human passed and judge agreed, plus false passes.
  const { kappa, kappaCi } = cohenKappa({
    bothPass: humanPass - falseFails,
    judgePassOnly: falsePasses,
    humanPassOnly: falseFails,
    bothFail: humanFail - falsePasses,
  });

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

  // The point values meet the targets, but with few labels the true value could still miss them:
  // PASS needs the whole 95% range on the right side of each target.
  let unsure = false;
  if (!missedTarget && measured) {
    const tooWide = (what: string, bound: number, target: string) => {
      unsure = true;
      problems.push(
        `Too few labelled verdicts to be sure: the 95% range for the ${what} reaches ${pct(bound)} (target ${target}).`,
      );
    };
    if (agreementCi && agreementCi.low < targets.minAgreement)
      tooWide("agreement", agreementCi.low, `≥ ${pct(targets.minAgreement)}`);
    if (falsePassRateCi && falsePassRateCi.high > targets.maxFalsePassRate)
      tooWide(
        "false-pass rate",
        falsePassRateCi.high,
        `≤ ${pct(targets.maxFalsePassRate)}`,
      );
    if (falseFailRateCi && falseFailRateCi.high > targets.maxFalseFailRate)
      tooWide(
        "false-fail rate",
        falseFailRateCi.high,
        `≤ ${pct(targets.maxFalseFailRate)}`,
      );
  }

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
    agreementCi,
    falsePassRateCi,
    falseFailRateCi,
    kappa,
    kappaCi,
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
    status: missedTarget ? "fail" : measured && !unsure ? "pass" : "incomplete",
    problems,
  };
}

type Interval = Evals.Calibration.Interval;
const Z95 = 1.959964;

/** Wilson score interval for k successes in n: stays inside 0–1 and behaves at 0 of n. Null when n is 0. */
export function wilson(k: number, n: number, z = Z95): Interval | null {
  if (!n) return null;
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/**
 * Cohen's κ between judge and human on pass/fail, with a large-sample 95% interval.
 * Null when it's undefined: no verdicts, or both sides gave one answer only.
 */
export function cohenKappa(
  t: {
    bothPass: number;
    judgePassOnly: number;
    humanPassOnly: number;
    bothFail: number;
  },
  z = Z95,
): { kappa: number | null; kappaCi: Interval | null } {
  const n = t.bothPass + t.judgePassOnly + t.humanPassOnly + t.bothFail;
  if (!n) return { kappa: null, kappaCi: null };
  const observed = (t.bothPass + t.bothFail) / n;
  const judgePass = (t.bothPass + t.judgePassOnly) / n;
  const humanPass = (t.bothPass + t.humanPassOnly) / n;
  const chance = judgePass * humanPass + (1 - judgePass) * (1 - humanPass);
  if (chance >= 1) return { kappa: null, kappaCi: null };
  const kappa = (observed - chance) / (1 - chance);
  const se = Math.sqrt((observed * (1 - observed)) / n) / (1 - chance);
  return {
    kappa,
    kappaCi: {
      low: Math.max(-1, kappa - z * se),
      high: Math.min(1, kappa + z * se),
    },
  };
}

export const pct = (v: number | null) =>
  v === null ? "-" : `${Math.round(v * 1000) / 10}%`;

/** "88.1–98.2%", or "-" without an interval. */
export const range = (ci: Interval | null) =>
  ci
    ? `${Math.round(ci.low * 1000) / 10}–${Math.round(ci.high * 1000) / 10}%`
    : "-";

export const kappaText = (k: number | null, ci: Interval | null) =>
  k === null
    ? "-"
    : `${k.toFixed(2)}${ci ? ` (${ci.low.toFixed(2)} to ${ci.high.toFixed(2)})` : ""}`;
