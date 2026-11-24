import { describeStep } from "../flow/normalize.js";
import type { Evals } from "../shared/contracts.js";

/** One markdown file per case: every target and run as numbered steps, odd runs and baseline changes highlighted. */
export function renderFlowMarkdown(
  caseId: string,
  reports: Evals.Report.CaseReport[],
  comparisons: Evals.Report.CaseComparison[],
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
      out.push(
        ...renderRun(
          run,
          report.oddFlows.find((o) => o.index === run.index),
          report.oddRuns.length ? usualRuns(report) : "",
        ),
      );
    for (const run of report.withoutSkill?.runs ?? [])
      out.push(...renderRun(run));
  }
  return out.join("\n");
}

/** "runs 1 and 3": the with-skill runs that took the usual flow. */
function usualRuns(report: Evals.Report.CaseReport): string {
  const usual = report.runs
    .filter((r) => !r.skipped && !report.oddRuns.includes(r.index))
    .map((r) => r.index + 1);
  return usual.length === 1
    ? `run ${usual[0]}`
    : `runs ${usual.slice(0, -1).join(", ")} and ${usual.at(-1)}`;
}

/** "What's odd" for an odd run: the steps it added to and dropped from the usual flow. */
function describeOddFlow(odd: Evals.Flow.OddRun, usual: string): string[] {
  return [
    `**What's odd** (compared with the usual flow, ${usual}):`,
    "",
    ...odd.removed.map((s) => `- missing: \`${s}\``),
    ...odd.added.map((s) => `- extra: \`${s}\``),
    "",
  ];
}

function renderRun(
  run: Evals.Report.RunRecord,
  odd?: Evals.Flow.OddRun,
  usual = "",
): string[] {
  const label = [
    `### Run ${run.index + 1}${run.withSkill ? "" : " (without skill)"}`,
    run.skipped ? " (skipped)" : run.pass ? " ✅" : " ❌",
    odd ? " ⚠️ odd flow" : "",
  ].join("");
  const lines = [label, "", ...(odd ? describeOddFlow(odd, usual) : [])];
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
