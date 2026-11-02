import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CaseKind } from '../cases/schema.js';
import { diffFlows, findOddRuns } from '../flow/compare.js';
import type { CaseComparison, CaseReport, RunReport } from '../engine/report-types.js';
import type { FlowStep } from '../types.js';

export interface BaselineEntry {
  caseId: string;
  target: string;
  kind: CaseKind;
  pass: boolean | null;
  passRate: number | null;
  triggerRate: number | null;
  costUsd: number;
  /** Approved flows, one per with-skill run. */
  flows: FlowStep[][];
}

export interface BaselineFile {
  version: 1;
  runId: string;
  approvedAt: string;
  entries: BaselineEntry[];
}

export const SUMMARY_FILE = 'summary.json';

export function toBaselineEntries(report: Pick<RunReport, 'cases'>): BaselineEntry[] {
  return report.cases.map((c) => ({
    caseId: c.caseId,
    target: c.target,
    kind: c.kind,
    pass: c.pass,
    passRate: c.passRate,
    triggerRate: c.triggerRate,
    costUsd: c.costUsd,
    flows: c.runs.flatMap((r) => (r.flow ? [r.flow.steps] : [])),
  }));
}

export interface Reference {
  kind: 'baseline' | 'previous-run' | 'none';
  runId?: string;
  entries: BaselineEntry[];
}

/** The committed baseline if there is one, otherwise the most recent earlier local run. */
export async function loadReference(baselineFile: string, resultsDir: string, currentRunId: string): Promise<Reference> {
  const baseline = await readJson<BaselineFile>(baselineFile);
  if (baseline) return { kind: 'baseline', runId: baseline.runId, entries: baseline.entries };

  const previous = (await listRunIds(resultsDir)).filter((id) => id < currentRunId).at(-1);
  if (previous) {
    const report = await readJson<RunReport>(path.join(resultsDir, previous, SUMMARY_FILE));
    if (report) return { kind: 'previous-run', runId: previous, entries: toBaselineEntries(report) };
  }
  return { kind: 'none', entries: [] };
}

/**
 * Compares a run's cases with the reference. A filtered run (--case/--kind/--target) only covers
 * part of the suite, so reference entries it did not run are not reported as removed.
 */
export function compareWithReference(cases: CaseReport[], reference: Reference, options: { filtered: boolean }): CaseComparison[] {
  if (reference.kind === 'none') return [];
  const key = (caseId: string, target: string) => `${caseId}|${target}`;
  const before = new Map(reference.entries.map((e) => [key(e.caseId, e.target), e]));
  const comparisons: CaseComparison[] = [];

  for (const c of cases) {
    const ref = before.get(key(c.caseId, c.target));
    before.delete(key(c.caseId, c.target));
    const currentFlows = c.runs.flatMap((r) => (r.flow ? [r.flow.steps] : []));
    if (!ref) {
      comparisons.push({
        caseId: c.caseId,
        target: c.target,
        status: 'new',
        passRate: { before: null, after: c.passRate },
        triggerRate: { before: null, after: c.triggerRate },
      });
      continue;
    }
    const status =
      ref.pass === true && c.pass === false ? 'regressed' : ref.pass === false && c.pass === true ? 'improved' : 'unchanged';
    const flowDiff =
      ref.flows.length && currentFlows.length ? diffFlows(majorityFlow(ref.flows), majorityFlow(currentFlows)) : undefined;
    comparisons.push({
      caseId: c.caseId,
      target: c.target,
      status,
      passRate: { before: ref.passRate, after: c.passRate },
      triggerRate: { before: ref.triggerRate, after: c.triggerRate },
      ...(flowDiff ? { flowDiff } : {}),
    });
  }
  for (const ref of options.filtered ? [] : before.values()) {
    comparisons.push({
      caseId: ref.caseId,
      target: ref.target,
      status: 'removed',
      passRate: { before: ref.passRate, after: null },
      triggerRate: { before: ref.triggerRate, after: null },
    });
  }
  return comparisons;
}

function majorityFlow(flows: FlowStep[][]): FlowStep[] {
  const { majority } = findOddRuns(flows);
  return flows[majority[0] ?? 0] ?? [];
}

/**
 * Promotes a run (the latest by default) to the committed baseline. Returns the approved run id.
 * A full run replaces the baseline; a filtered run only replaces the entries it covered.
 */
export async function approveRun(options: { resultsDir: string; baselineFile: string; runId?: string; now?: () => Date }) {
  const runId = options.runId ?? (await listRunIds(options.resultsDir)).at(-1);
  if (!runId) throw new Error(`No runs found in ${options.resultsDir}`);
  const report = await readJson<RunReport>(path.join(options.resultsDir, runId, SUMMARY_FILE));
  if (!report) throw new Error(`Run ${runId} has no ${SUMMARY_FILE}`);

  let entries = toBaselineEntries(report);
  if (isFiltered(report.options)) {
    const covered = new Set(entries.map((e) => `${e.caseId}|${e.target}`));
    const existing = (await readJson<BaselineFile>(options.baselineFile))?.entries ?? [];
    entries = [...existing.filter((e) => !covered.has(`${e.caseId}|${e.target}`)), ...entries];
  }
  const baseline: BaselineFile = {
    version: 1,
    runId,
    approvedAt: (options.now?.() ?? new Date()).toISOString(),
    entries,
  };
  await mkdir(path.dirname(options.baselineFile), { recursive: true });
  await writeFile(options.baselineFile, JSON.stringify(baseline, null, 2) + '\n');
  return runId;
}

export function isFiltered(options: { kind?: string; caseId?: string; target?: string }): boolean {
  return !!(options.kind || options.caseId || options.target);
}

export async function listRunIds(resultsDir: string): Promise<string[]> {
  const entries = await readdir(resultsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}
