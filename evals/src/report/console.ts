import type { Evals } from "../shared/contracts.js";

const usd = (v: number | null) => (v === null ? "?" : `$${v.toFixed(2)}`);

export function renderConsoleSummary(report: Evals.Report.RunReport): string {
  if (!report.cases.length)
    return `No cases matched (cases live in evals/cases/<id>.yaml).\nResults: ${report.resultsPath}`;
  const header = ["case", "result", "cost", "notes"];
  const rows = report.cases.map((c) => [
    c.caseId,
    c.pass ? "PASS" : "FAIL",
    usd(c.costUsd),
    firstFailure(c),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i]!))
      .join("  ")
      .trimEnd();

  const { totals } = report;
  const out = [
    line(header),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
    "",
    `Cases: ${totals.casesPassed} passed, ${totals.casesFailed} failed · cost: $${totals.costUsd.toFixed(2)}${totals.costUnknown ? " (some runs reported no cost)" : ""}`,
  ];

  const ref = report.reference;
  if (ref.kind === "none")
    out.push(
      "Comparison: no baseline.json yet (npm run eval:approve creates one).",
    );
  else {
    out.push(`Compared with baseline (${ref.runId}):`);
    const changed = report.comparison.filter((c) => c.status !== "unchanged");
    if (!changed.length) out.push("  no result changes");
    for (const c of changed)
      out.push(`  ${c.status.toUpperCase().padEnd(9)} ${c.caseId}`);
  }
  out.push(`Results: ${report.resultsPath}`);
  return out.join("\n");
}

/** Why the case didn't run, else the first failed check, else the first failed rubric line with the judge's reason. */
function firstFailure(c: Evals.Report.CaseReport): string {
  if (!c.ran) return oneLine(`not run: ${c.error ?? "unknown error"}`);
  const check = c.checks.find((x) => !x.pass);
  if (check)
    return oneLine(`${check.name}${check.detail ? `: ${check.detail}` : ""}`);
  const line = c.judge?.find((l) => !l.pass);
  if (line) return oneLine(`rubric "${line.text}": ${line.reason}`);
  return c.error ? oneLine(c.error) : "";
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat;
}
