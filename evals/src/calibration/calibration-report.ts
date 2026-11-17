import type { Evals } from "../shared/contracts.js";
import { DEFAULT_TARGETS, pct } from "./score.js";

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
    `  agreement   ${pct(s.agreement).padEnd(7)} target ≥ ${pct(DEFAULT_TARGETS.minAgreement)}`,
    `  false pass  ${pct(s.falsePassRate).padEnd(7)} target ≤ ${pct(DEFAULT_TARGETS.maxFalsePassRate)}  (${s.falsePasses} of ${s.humanFail} lines a human failed)`,
    `  false fail  ${pct(s.falseFailRate).padEnd(7)} target ≤ ${pct(DEFAULT_TARGETS.maxFalseFailRate)}  (${s.falseFails} of ${s.humanPass} lines a human passed)`,
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

export function renderCalibrationMarkdown(
  run: CalibrationRun,
  at: string,
): string {
  const s = run.score;
  const out = [
    `# Judge calibration ${at}`,
    "",
    `**${STATUS[s.status]}**`,
    ...s.problems.map((p) => `- ${p}`),
    "",
    `Graded with: ${run.mode === "replay" ? `the current judge, replayed ($${run.costUsd.toFixed(2)})` : "the verdicts recorded in the original runs"}.`,
    "",
    "| Number | Value | Target |",
    "|---|---|---|",
    `| Agreement | ${pct(s.agreement)} (${s.agree} of ${s.verdicts}) | ≥ ${pct(DEFAULT_TARGETS.minAgreement)} |`,
    `| False-pass rate | ${pct(s.falsePassRate)} (${s.falsePasses} of ${s.humanFail}) | ≤ ${pct(DEFAULT_TARGETS.maxFalsePassRate)} |`,
    `| False-fail rate | ${pct(s.falseFailRate)} (${s.falseFails} of ${s.humanPass}) | ≤ ${pct(DEFAULT_TARGETS.maxFalseFailRate)} |`,
    `| Lines that flipped across replays | ${run.mode === "replay" ? s.flips : "-"} | 0 |`,
    `| Unlabelled verdicts (not counted) | ${s.unlabelled} | 0 |`,
    "",
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
