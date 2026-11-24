import type { Evals } from "../shared/contracts.js";
import { DEFAULT_TARGETS, kappaText, pct, range } from "./score.js";

type CalibrationRun = Evals.Calibration.Run;

const STATUS = {
  pass: "PASS: the judge meets the targets",
  fail: "FAIL: the judge misses a target",
  incomplete: "INCOMPLETE: not enough labels to measure",
} as const;

export function renderCalibrationConsole(run: CalibrationRun): string {
  const s = run.score;
  if (!s.items)
    return "No calibration items. Add one with: npm run eval:calibrate -- add --case <id> [--run <run-id>]";
  const out = [
    `Calibration (${run.mode === "replay" ? `replayed judge, $${run.costUsd.toFixed(2)}` : "recorded verdicts"}): ${s.items} items, ${s.verdicts} labelled verdicts`,
    `  agreement   ${pct(s.agreement).padEnd(7)} 95% range ${range(s.agreementCi).padEnd(12)} target ≥ ${pct(DEFAULT_TARGETS.minAgreement)}`,
    `  false pass  ${pct(s.falsePassRate).padEnd(7)} 95% range ${range(s.falsePassRateCi).padEnd(12)} target ≤ ${pct(DEFAULT_TARGETS.maxFalsePassRate)}  (${s.falsePasses} of ${s.humanFail} lines a human failed)`,
    `  false fail  ${pct(s.falseFailRate).padEnd(7)} 95% range ${range(s.falseFailRateCi).padEnd(12)} target ≤ ${pct(DEFAULT_TARGETS.maxFalseFailRate)}  (${s.falseFails} of ${s.humanPass} lines a human passed)`,
    `  kappa       ${kappaText(s.kappa, s.kappaCi)}  agreement beyond chance; ${pct(rate(s.humanPass, s.verdicts))} of labels are pass`,
  ];
  if (run.mode === "replay")
    out.push(
      `  flips       ${s.flips} line(s) got different verdicts across replays`,
    );
  if (s.unlabelled)
    out.push(
      `  unlabelled  ${s.unlabelled} verdict(s) skipped: pass is still null in labels.json`,
    );
  for (const d of s.disagreements)
    out.push(
      `  ${d.outcome.toUpperCase().padEnd(10)} ${d.item} [${d.source}]: ${d.line}`,
    );
  for (const x of s.skipped) out.push(`  skipped     ${x.item}: ${x.reason}`);
  for (const x of s.errors)
    out.push(`  error       ${x.item} [${x.source}]: ${x.error}`);
  for (const x of s.strayLabels)
    out.push(`  stray label ${x.item}: "${x.line}" isn't in the rubric`);
  out.push(STATUS[s.status]);
  for (const p of s.problems) out.push(`  - ${p}`);
  return out.join("\n");
}

/** The report for one "<case-id>/<results-run-id>" folder: only that folder's items are scored. */
export function renderCalibrationMarkdown(
  run: CalibrationRun,
  group: Evals.Calibration.GroupScore,
  at: string,
): string {
  const s = group.score;
  const others = run.groups.length - 1;
  const out = [
    `# Judge calibration: ${group.id}`,
    "",
    `Run ${at}. Scores the ${s.items} item(s) in this folder only${others ? `; the same run also scored ${others} other folder(s), and its overall result was **${run.score.status.toUpperCase()}**` : ""}.`,
    "",
    `**${STATUS[s.status]}**`,
    ...s.problems.map((p) => `- ${p}`),
    "",
    `Graded with: ${run.mode === "replay" ? `the current judge, replayed ($${group.costUsd.toFixed(2)})` : "the verdicts recorded in the original runs"}.`,
    "",
    "PASS needs the whole 95% range on the right side of each target, not just the value.",
    "",
    "| Number | Value | 95% range | Target |",
    "|---|---|---|---|",
    `| Agreement | ${pct(s.agreement)} (${s.agree} of ${s.verdicts}) | ${range(s.agreementCi)} | ≥ ${pct(DEFAULT_TARGETS.minAgreement)} |`,
    `| False-pass rate | ${pct(s.falsePassRate)} (${s.falsePasses} of ${s.humanFail}) | ${range(s.falsePassRateCi)} | ≤ ${pct(DEFAULT_TARGETS.maxFalsePassRate)} |`,
    `| False-fail rate | ${pct(s.falseFailRate)} (${s.falseFails} of ${s.humanPass}) | ${range(s.falseFailRateCi)} | ≤ ${pct(DEFAULT_TARGETS.maxFalseFailRate)} |`,
    `| Cohen's κ (agreement beyond chance) | ${s.kappa === null ? "-" : s.kappa.toFixed(2)} | ${s.kappaCi ? `${s.kappaCi.low.toFixed(2)} to ${s.kappaCi.high.toFixed(2)}` : "-"} | reported only |`,
    `| Labels that are pass (base rate) | ${pct(rate(s.humanPass, s.verdicts))} (${s.humanPass} of ${s.verdicts}) | | |`,
    `| Lines that flipped across replays | ${run.mode === "replay" ? s.flips : "-"} | | 0 |`,
    `| Unlabelled verdicts (not counted) | ${s.unlabelled} | | 0 |`,
    "",
    ...explainKappa(s),
    "## Lines",
    "",
    "Worst first. A line with any false pass or flip shouldn't count towards a score until it's fixed.",
    "",
    "| Line | Verdicts | False pass | False fail | Flips |",
    "|---|---|---|---|---|",
    ...s.lines.map(
      (l) =>
        `| ${cell(l.line)}${l.critical ? " **(critical)**" : l.reportOnly ? " *(report)*" : ""} | ${l.verdicts} | ${l.falsePasses} | ${l.falseFails} | ${l.flips} |`,
    ),
  ];
  if (s.disagreements.length) {
    out.push(
      "",
      "## Disagreements",
      "",
      "Settle each one: judge error, line defect, missing evidence or label error (judge-governance.md §5.1, step 6).",
      "",
    );
    for (const d of s.disagreements)
      out.push(
        `### ${d.outcome}: ${d.item} (${d.source})`,
        "",
        `- **Line:** ${d.line}`,
        `- **Judge:** ${d.judgeReason}`,
        `- **Human:** ${d.humanEvidence || "(no evidence written)"}`,
        "",
      );
  }
  const notes = [
    ...s.skipped.map((x) => `- Skipped ${x.item}: ${x.reason}`),
    ...s.errors.map((x) => `- Error ${x.item} (${x.source}): ${x.error}`),
    ...s.strayLabels.map(
      (x) => `- Stray label in ${x.item}: "${x.line}" isn't in the rubric`,
    ),
  ];
  if (notes.length) out.push("", "## Notes", "", ...notes);
  return out.join("\n") + "\n";
}

const cell = (text: string) => text.replaceAll("|", "\\|");
const rate = (n: number, of: number) => (of ? n / of : null);

/** "What κ means" for this report, worked through with its own numbers. */
function explainKappa(s: Evals.Calibration.Score): string[] {
  const out = [
    "### What κ means",
    "",
    "Agreement alone flatters the judge when most lines pass. If 90% of the labels are pass, a judge that answers pass without reading anything agrees 90% of the time and catches nothing. κ (Cohen's kappa) asks how much better than that the judge did: it takes the agreement two raters would reach by chance, answering pass as often as these two did but without looking, and counts only what the judge achieved beyond it.",
    "",
    "κ = (agreement − chance agreement) ÷ (1 − chance agreement)",
    "",
    "- **1**: agrees on every verdict.",
    "- **0**: no better than guessing at the same pass rate. A judge that always says pass scores 0, whatever its agreement.",
    "- **Below 0**: disagrees more often than chance would.",
    "",
    "A rough reading: under 0.4 weak, 0.4 to 0.6 moderate, 0.6 to 0.8 substantial, above 0.8 strong. κ is not gated, because the same judge gets a lower κ on a set where almost every label is the same. Read it with the base rate, and next to the false-pass rate, which is the number that guards the gate.",
    "",
  ];
  const n = s.verdicts;
  if (s.kappa === null || !n) {
    out.push(
      n
        ? "**This set:** κ can't be computed: the judge and the labels each gave only one answer, so there is nothing to tell apart from chance."
        : "**This set:** no labelled verdicts yet, so there is no κ.",
      "",
    );
    return out;
  }
  const human = s.humanPass / n;
  const judge = (s.humanPass - s.falseFails + s.falsePasses) / n;
  const chance = human * judge + (1 - human) * (1 - judge);
  const agreement = s.agree / n;
  out.push(
    `**This set:** ${pct(human)} of the labels are pass and the judge said pass ${pct(judge)} of the time, so guessing at those rates would agree ${pct(chance)} of the time. The judge agreed ${pct(agreement)}. κ = (${pct(agreement)} − ${pct(chance)}) ÷ (100% − ${pct(chance)}) = **${s.kappa.toFixed(2)}**: ${s.kappa >= 0 ? `it closed ${pct(s.kappa)} of the gap between chance and perfect agreement` : "it did worse than chance"}.${s.kappaCi ? ` With ${n} labelled verdicts the 95% range is ${s.kappaCi.low.toFixed(2)} to ${s.kappaCi.high.toFixed(2)}${s.kappaCi.high - s.kappaCi.low > 0.5 ? ", too wide to say much yet: label more items" : ""}.` : ""}`,
    "",
  );
  return out;
}
