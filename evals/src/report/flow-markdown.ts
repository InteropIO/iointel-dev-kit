import { describeStep } from "../flow/normalize.js";
import type {
  CaseComparison,
  CaseReport,
  RunRecord,
} from "../engine/report-types.js";

/** One markdown file per case: every target and run as numbered steps, odd runs and baseline changes highlighted. */
export function renderFlowMarkdown(
  caseId: string,
  reports: CaseReport[],
  comparisons: CaseComparison[],
): string {
  const out: string[] = [`# Flows: ${caseId}`, ""];
  for (const report of reports) {
    out.push(`## ${report.target}`, "");
    const cmp = comparisons.find((c) => c.target === report.target);
    if (
      cmp?.flowDiff &&
      (cmp.flowDiff.added.length || cmp.flowDiff.removed.length)
    ) {
      out.push("**Flow changed from the reference:**", "");
      for (const s of cmp.flowDiff.removed) out.push(`- \`- ${s}\``);
      for (const s of cmp.flowDiff.added) out.push(`- \`+ ${s}\``);
      out.push("");
    }
    for (const run of report.runs)
      out.push(...renderRun(run, report.oddRuns.includes(run.index)));
    for (const run of report.withoutSkill?.runs ?? [])
      out.push(...renderRun(run, false));
  }
  return out.join("\n");
}

function renderRun(run: RunRecord, odd: boolean): string[] {
  const label = [
    `### Run ${run.index + 1}${run.withSkill ? "" : " (without skill)"}`,
    run.skipped ? " (skipped)" : run.pass ? " ✅" : " ❌",
    odd ? " ⚠️ odd flow" : "",
  ].join("");
  const lines = [label, ""];
  if (run.skipped) return [...lines, `_${run.skipReason ?? "skipped"}_`, ""];
  if (!run.flow)
    return [
      ...lines,
      `_no flow recorded${run.error ? `: ${run.error}` : ""}_`,
      "",
    ];
  run.flow.steps.forEach((step, i) =>
    lines.push(`${i + 1}. ${describeStep(step)}`),
  );
  if (!run.flow.steps.length) lines.push("_no key steps_");
  const cost =
    run.flow.costUsd === null
      ? "cost unknown"
      : `$${run.flow.costUsd.toFixed(2)}`;
  lines.push(
    "",
    `outcome: ${run.flow.stopReason} · ${run.flow.turns} turns · ${cost}`,
    "",
  );
  return lines;
}
