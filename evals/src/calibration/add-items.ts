// Freezes graded runs from evals/results/ into calibration items, with blank labels for a human to fill.
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadCases } from "../cases/loader.js";
import { judgeOf } from "../engine/grading.js";
import { listRunIds } from "../report/baseline.js";
import { SUMMARY_FILE } from "../report/summary-file.js";
import type { Evals } from "../shared/contracts.js";
import { writeEvidenceMarkdown } from "./evidence-markdown.js";
import { CalibrationError, FILES, writeJson } from "./store.js";

// Left out of a saved workspace: large, rebuilt by npm install, or not the project's own files.
const WORKSPACE_SKIP = new Set(["node_modules", ".git"]);

export async function addItems(
  options: Evals.Calibration.AddOptions,
): Promise<Evals.Calibration.Added[]> {
  const runId = options.runId ?? (await listRunIds(options.resultsDir)).at(-1);
  if (!runId) throw new CalibrationError(`No runs in ${options.resultsDir}`);
  const runDir = path.join(options.resultsDir, runId);
  const summary = await readJson<Evals.Summary.File>(
    path.join(runDir, SUMMARY_FILE),
  );
  if (summary?.version !== 2)
    throw new CalibrationError(`Run ${runId} has no version 2 ${SUMMARY_FILE}`);

  const loaded = (await loadCases(options.casesDir)).find(
    (l) => l.case.id === options.caseId,
  );
  if (!loaded)
    throw new CalibrationError(`No case "${options.caseId}" in cases/`);
  const workspaceAccess = !!judgeOf(loaded.case)?.workspaceAccess;

  const runs = summary.cases
    .filter(
      (c) =>
        c.id === options.caseId &&
        (!options.target || c.target === options.target),
    )
    .flatMap((c) => c.runs.map((r) => ({ target: c.target, r })))
    .filter(({ r }) => !options.run || r.run === options.run);
  const graded = runs.filter(({ r }) => r.judge && r.files.transcript);
  if (!graded.length)
    throw new CalibrationError(
      `Run ${runId} has no judge-graded runs for ${options.caseId}${options.run ? ` run ${options.run}` : ""}` +
        (runs.length
          ? " (runs that fail before grading have no verdicts)"
          : ""),
    );

  await mkdir(options.calibrationDir, { recursive: true });
  const added: Evals.Calibration.Added[] = [];
  for (const { target, r } of graded) {
    const id = `${options.caseId}__${target.replace(/[^\w.-]+/g, "_")}__${r.run}__${runId}`;
    const dir = path.join(options.calibrationDir, id);
    if (await exists(dir)) {
      added.push({ id, created: false });
      continue;
    }
    const saved = await readJson<{
      finalMessage: string;
      diff?: string;
      transcript: unknown[];
    }>(path.join(runDir, r.files.transcript!));
    if (!saved)
      throw new CalibrationError(`Missing ${r.files.transcript} in ${runId}`);

    const results = r.judge!.results;
    const evidence: Evals.Calibration.Evidence = {
      version: 1,
      source: { runId, caseId: options.caseId, target, run: r.run },
      rubric: results.map((l) => l.criterion),
      reportOnly: results
        .filter((l) => lineType(l) === "report")
        .map((l) => l.criterion),
      critical: results
        .filter((l) => lineType(l) === "critical")
        .map((l) => l.criterion),
      finalMessage: saved.finalMessage,
      ...(saved.diff !== undefined ? { diff: saved.diff } : {}),
      transcript: saved.transcript,
      workspaceAccess,
    };
    const labels: Evals.Calibration.Labels = {
      labelledBy: "",
      labels: results.map((l) => ({
        line: l.criterion,
        pass: null,
        evidence: "",
      })),
    };
    const verdicts: Evals.Calibration.RecordedVerdicts = {
      runId,
      lines: results.map((l) => ({
        line: l.criterion,
        pass: l.pass,
        reason: l.reason,
      })),
    };
    await mkdir(dir);
    await writeJson(path.join(dir, FILES.evidence), evidence);
    await writeEvidenceMarkdown(dir, evidence);
    await writeJson(path.join(dir, FILES.labels), labels);
    await writeJson(path.join(dir, FILES.verdicts), verdicts);

    let workspaceMissing = false;
    if (workspaceAccess) {
      const workdir = r.files.workdir;
      if (workdir && (await exists(workdir)))
        await cp(workdir, path.join(dir, FILES.workspace), {
          recursive: true,
          filter: (src) => !WORKSPACE_SKIP.has(path.basename(src)),
        });
      else workspaceMissing = true;
    }
    added.push({
      id,
      created: true,
      ...(workspaceMissing ? { workspaceMissing: true as const } : {}),
    });
  }
  return added;
}

/** A result's rubric type; summaries written before typed rubrics marked report lines "reportOnly". */
function lineType(l: {
  type?: Evals.Cases.RubricType;
}): Evals.Cases.RubricType | undefined {
  return l.type ?? ((l as { reportOnly?: true }).reportOnly && "report");
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  );
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}
