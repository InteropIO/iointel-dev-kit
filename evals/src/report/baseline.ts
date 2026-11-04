import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EvalSetupError } from "../engine/errors.js";
import type { Evals } from "../shared/contracts.js";

export const SUMMARY_FILE = "summary.json";
const BASELINE_VERSION = 2;

function toBaselineEntries(
  report: Pick<Evals.Report.RunReport, "cases">,
): Evals.Baseline.Entry[] {
  return report.cases.map((c) => ({
    caseId: c.caseId,
    pass: c.pass,
    costUsd: c.costUsd,
  }));
}

/** The committed baseline, or no reference when there isn't one. Throws on a baseline from another engine version. */
export async function loadReference(
  baselineFile: string,
): Promise<Evals.Baseline.Reference> {
  const baseline = await readBaseline(baselineFile);
  return baseline
    ? { kind: "baseline", runId: baseline.runId, entries: baseline.entries }
    : { kind: "none", entries: [] };
}

async function readBaseline(
  baselineFile: string,
): Promise<Evals.Baseline.File | undefined> {
  const baseline = await readJson<{ version?: unknown }>(baselineFile);
  if (baseline && baseline.version !== BASELINE_VERSION)
    throw new EvalSetupError(
      `${baselineFile} has version ${String(baseline.version)}, but this engine reads version ${BASELINE_VERSION}. ` +
        `It was written by an older engine: delete it, run the suite, and approve a new baseline.`,
    );
  return baseline as Evals.Baseline.File | undefined;
}

/**
 * Compares a run's cases with the baseline. A run filtered with --case only covers part of the
 * suite, so baseline entries it did not run are not reported as removed.
 */
export function compareWithReference(
  cases: readonly Evals.Report.CaseReport[],
  reference: Evals.Baseline.Reference,
  options: Evals.Baseline.CompareOptions,
): Evals.Report.CaseComparison[] {
  if (reference.kind === "none") return [];
  const before = new Map(reference.entries.map((e) => [e.caseId, e]));
  const comparisons: Evals.Report.CaseComparison[] = [];

  for (const c of cases) {
    const ref = before.get(c.caseId);
    before.delete(c.caseId);
    const status: Evals.Report.ComparisonStatus = !ref
      ? "new"
      : ref.pass && !c.pass
        ? "regressed"
        : !ref.pass && c.pass
          ? "improved"
          : "unchanged";
    comparisons.push({
      caseId: c.caseId,
      status,
      pass: { before: ref?.pass ?? null, after: c.pass },
    });
  }
  for (const ref of options.filtered ? [] : before.values()) {
    comparisons.push({
      caseId: ref.caseId,
      status: "removed",
      pass: { before: ref.pass, after: null },
    });
  }
  return comparisons;
}

/**
 * Promotes a run (the latest by default) to the committed baseline. Returns the approved run id.
 * A full run replaces the baseline; a filtered run only replaces the entries it covered.
 * Refuses a run with no cases, or with cases that never reached the agent: approving those would
 * record setup failures as skill failures.
 */
export async function approveRun(
  options: Evals.Baseline.ApproveOptions,
): Promise<string> {
  const runId = options.runId ?? (await listRunIds(options.resultsDir)).at(-1);
  if (!runId)
    throw new EvalSetupError(`No runs found in ${options.resultsDir}`);
  const report = await readJson<Evals.Report.RunReport>(
    path.join(options.resultsDir, runId, SUMMARY_FILE),
  );
  if (!report) throw new EvalSetupError(`Run ${runId} has no ${SUMMARY_FILE}`);
  if (!report.cases.length)
    throw new EvalSetupError(
      `Run ${runId} ran no cases; refusing to approve it`,
    );
  // `ran` is missing from runs made by the older engine, so they are refused here too.
  const notRun = report.cases.filter((c) => c.ran !== true);
  if (notRun.length)
    throw new EvalSetupError(
      `Run ${runId} has cases that never reached the agent (${notRun.map((c) => c.caseId).join(", ")}); ` +
        `fix the setup problem and rerun before approving`,
    );

  let entries = toBaselineEntries(report);
  if (isFiltered(report.options)) {
    const covered = new Set(entries.map((e) => e.caseId));
    const existing = (await readBaseline(options.baselineFile))?.entries ?? [];
    entries = [...existing.filter((e) => !covered.has(e.caseId)), ...entries];
  }
  const baseline: Evals.Baseline.File = {
    version: BASELINE_VERSION,
    runId,
    approvedAt: (options.now?.() ?? new Date()).toISOString(),
    entries,
  };
  await mkdir(path.dirname(options.baselineFile), { recursive: true });
  await writeFile(
    options.baselineFile,
    JSON.stringify(baseline, null, 2) + "\n",
  );
  return runId;
}

export function isFiltered(options: Evals.Engine.Filters): boolean {
  return !!options.caseId;
}

async function listRunIds(resultsDir: string): Promise<string[]> {
  const entries = await readdir(resultsDir, { withFileTypes: true }).catch(
    () => [],
  );
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}
