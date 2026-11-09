import { describeStep } from "../flow/normalize.js";
import type { Evals } from "../shared/contracts.js";
import type { RunDetails } from "../shared/types.js";

// Keeps a huge diff from burying the report; the transcript file always has the full one.
const MAX_DIFF_CHARS = 20_000;

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `${Math.round(v * 100)}%`;
const mark = (pass: boolean) => (pass ? "✅" : "❌");

/**
 * One markdown file per case with everything a run gathered: the prompt, then for every target
 * and run the result, checks, judge verdicts, flow, final message and diff.
 */
export function renderCaseMarkdown(
  c: Evals.Cases.Case,
  reports: readonly Evals.Report.CaseReport[],
  details: (run: Evals.Report.RunRecord) => RunDetails | undefined,
): string {
  const out = [`# ${c.id}`, "", `**Kind:** ${c.kind}`, ""];
  if (c.input.template)
    out.push(`**Template:** \`${JSON.stringify(c.input.template)}\``, "");
  out.push("**Prompt:**", "", ...quote(c.input.prompt), "");

  for (const report of reports) {
    const result =
      report.pass === null ? "SKIPPED" : report.pass ? "PASS" : "FAIL";
    out.push(
      `## ${report.target}: ${result}`,
      "",
      `pass ${pct(report.passRate)} of ${report.ran} (needs ${pct(report.threshold)}) · trigger ${pct(report.triggerRate)} · rubric ${pct(report.rubricScore)} · $${report.costUsd.toFixed(2)}${report.costUnknown ? "+?" : ""}`,
      "",
    );
    for (const run of [...report.runs, ...(report.withoutSkill?.runs ?? [])])
      out.push(...renderRun(run, details(run)));
  }
  return out.join("\n");
}

function renderRun(
  run: Evals.Report.RunRecord,
  details: RunDetails | undefined,
): string[] {
  const title = `### Run ${run.index + 1}${run.withSkill ? "" : " (without skill)"}`;
  if (run.skipped)
    return [`${title}: skipped`, "", `_${run.skipReason ?? "skipped"}_`, ""];

  const out = [`${title}: ${run.pass ? "✅ pass" : "❌ fail"}`, ""];
  const outcome = [
    run.flow
      ? `${run.flow.stopReason} · ${run.flow.turns} turns`
      : run.stopReason,
    `skill ${run.triggered ? "triggered" : "not triggered"}`,
    run.costUsd === null ? "cost unknown" : `$${run.costUsd.toFixed(2)}`,
  ];
  out.push(outcome.filter(Boolean).join(" · "), "");
  if (run.error) out.push(`**Error:** ${run.error}`, "");

  if (run.checks.length) {
    out.push("**Checks**", "");
    for (const check of run.checks)
      out.push(
        `- ${mark(check.pass)} ${check.name}${check.detail ? `: ${inline(check.detail)}` : ""}`,
      );
    out.push("");
  }

  if (run.judge) {
    out.push(`**Judge** (rubric score ${pct(run.rubricScore)})`, "");
    for (const line of run.judge)
      out.push(
        `- ${mark(line.pass)} ${line.reportOnly ? "_[report-only]_ " : ""}${line.text}`,
        `  - ${inline(line.reason)}`,
      );
    out.push("");
  } else if (run.checks.every((c) => c.pass)) {
    out.push("_Not judged (no rubric)._", "");
  } else {
    out.push("_Not judged: a check failed first._", "");
  }

  out.push("**Flow**", "");
  const steps = run.flow?.steps ?? [];
  if (steps.length)
    steps.forEach((step, i) => out.push(`${i + 1}. ${describeStep(step)}`));
  else out.push("_no key steps recorded_");
  out.push("");

  if (details) {
    out.push("**Final message**", "");
    out.push(
      ...(details.finalMessage ? quote(details.finalMessage) : ["_(empty)_"]),
      "",
    );
    if (details.diff !== undefined) {
      if (!details.diff.trim()) out.push("**Diff:** no file changes", "");
      else {
        const lines = details.diff.split("\n").length;
        const truncated = details.diff.length > MAX_DIFF_CHARS;
        out.push(
          `<details><summary>Diff (${lines} lines${truncated ? ", truncated" : ""})</summary>`,
          "",
          "```diff",
          truncated ? details.diff.slice(0, MAX_DIFF_CHARS) : details.diff,
          "```",
          "",
          "</details>",
          "",
        );
      }
    }
  }
  if (run.workdir) out.push(`Workspace kept at: \`${run.workdir}\``, "");
  if (run.transcriptFile)
    out.push(
      `Full transcript: [${run.transcriptFile}](../${run.transcriptFile})`,
      "",
    );
  return out;
}

/** Quotes text as a markdown blockquote, so its own headings can't break the report's structure. */
function quote(text: string): string[] {
  return text.split(/\r?\n/).map((l) => (l ? `> ${l}` : ">"));
}

/** Collapses multi-line text (command output, reasons) onto one list line. */
function inline(text: string): string {
  const flat = text.replace(/\s*\r?\n\s*/g, " ⏎ ").trim();
  return flat.length > 600 ? `${flat.slice(0, 600)}…` : flat;
}
