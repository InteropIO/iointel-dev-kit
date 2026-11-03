import type { Evals } from "../shared/contracts.js";

const pct = (v: number | null) =>
  v === null ? "-" : `${Math.round(v * 100)}%`;
const usd = (v: number, unknown: boolean) =>
  `$${v.toFixed(2)}${unknown ? "+?" : ""}`;

export function renderConsoleSummary(report: Evals.Report.RunReport): string {
  if (!report.cases.length)
    return `No cases matched (cases live in evals/cases/<kind>/<id>.yaml).\nResults: ${report.resultsPath}`;
  const header = [
    "case",
    "target",
    "kind",
    "result",
    "pass",
    "trigger",
    "cost",
    "notes",
  ];
  const rows = report.cases.map((c) => [
    c.caseId,
    c.target,
    c.kind,
    c.pass === null ? "SKIPPED" : c.pass ? "PASS" : "FAIL",
    `${pct(c.passRate)} (${c.ran})`,
    pct(c.triggerRate),
    usd(c.costUsd, c.costUnknown),
    notes(c, report),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i]!))
      .join("  ")
      .trimEnd();

  const out = [
    line(header),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
    "",
  ];

  const { totals } = report;
  out.push(
    `Cases: ${totals.casesPassed} passed, ${totals.casesFailed} failed · runs: ${totals.runs}, skipped: ${totals.skipped} · cost: ${usd(totals.costUsd, totals.costUnknown)}`,
  );
  const byTarget = Object.entries(totals.costByTarget).map(
    ([t, v]) => `${t} $${v.toFixed(2)}`,
  );
  if (byTarget.length) out.push(`Cost by target: ${byTarget.join(", ")}`);
  if (totals.costUnknown)
    out.push(
      "Some runs reported no cost (see CODEX_PRICE_* in .env.example); totals are a lower bound.",
    );

  const ref = report.reference;
  if (ref.kind === "none")
    out.push("Comparison: no baseline or earlier run to compare against.");
  else {
    out.push(
      `Comparison against ${ref.kind === "baseline" ? "committed baseline" : "previous local run"} (${ref.runId}):`,
    );
    const changed = report.comparison.filter(
      (c) =>
        c.status !== "unchanged" ||
        changedRate(c.passRate) ||
        changedRate(c.triggerRate),
    );
    if (!changed.length) out.push("  no result changes");
    for (const c of changed)
      out.push(
        `  ${c.status.toUpperCase().padEnd(9)} ${c.caseId} [${c.target}] pass ${pct(c.passRate.before)} → ${pct(c.passRate.after)}, trigger ${pct(c.triggerRate.before)} → ${pct(c.triggerRate.after)}`,
      );
    const flowChanged = report.comparison.filter(
      (c) =>
        c.flowDiff && (c.flowDiff.added.length || c.flowDiff.removed.length),
    );
    if (flowChanged.length) {
      out.push("Flow changes (see flows/<case>.md):");
      for (const c of flowChanged)
        out.push(
          `  ${c.caseId} [${c.target}]: +${c.flowDiff!.added.length} / -${c.flowDiff!.removed.length} steps`,
        );
    }
  }
  const odd = report.cases.filter((c) => c.oddRuns.length);
  if (odd.length) {
    out.push("Odd flows among repeats (see flows/<case>.md):");
    for (const c of odd)
      out.push(
        `  ${c.caseId} [${c.target}]: run ${c.oddRuns.map((i) => i + 1).join(", ")}`,
      );
  }
  out.push(`Results: ${report.resultsPath}`);
  return out.join("\n");
}

function notes(
  c: Evals.Report.CaseReport,
  report: Evals.Report.RunReport,
): string {
  const parts: string[] = [];
  if (!c.network) parts.push("network off");
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  if (c.oddRuns.length) parts.push("odd flow");
  const cmp = report.comparison.find(
    (x) => x.caseId === c.caseId && x.target === c.target,
  );
  if (cmp && cmp.status !== "unchanged") parts.push(cmp.status);
  if (
    cmp?.flowDiff &&
    (cmp.flowDiff.added.length || cmp.flowDiff.removed.length)
  )
    parts.push("flow changed");
  if (c.withoutSkill)
    parts.push(`without skill: pass ${pct(c.withoutSkill.passRate)}`);
  const stops = new Set(
    c.runs.flatMap((r) =>
      r.stopReason && r.stopReason !== "done" ? [r.stopReason] : [],
    ),
  );
  if (stops.size) parts.push([...stops].join("/"));
  return parts.join(", ");
}

function changedRate(r: {
  before: number | null;
  after: number | null;
}): boolean {
  return (
    r.before !== null && r.after !== null && Math.abs(r.before - r.after) > 1e-9
  );
}
