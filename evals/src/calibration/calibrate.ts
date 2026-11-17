// Grades the calibration set: against the verdicts recorded in the original runs (free), or by
// replaying the current judge on each item's frozen evidence (--replay N, costs judge calls).
import { stat } from "node:fs/promises";
import path from "node:path";
import { runPool } from "../engine/pool.js";
import type { Evals } from "../shared/contracts.js";
import { writeEvidenceMarkdown } from "./evidence-markdown.js";
import { FILES, loadItems } from "./store.js";
import { scoreCalibration } from "./score.js";

type Item = Evals.Calibration.Item;
type Grading = Evals.Calibration.Grading;

export async function calibrate(
  options: Evals.Calibration.Options,
): Promise<Evals.Calibration.Run> {
  const items = await loadItems(options.calibrationDir, options.filter);
  // Kept in step with evidence.json, which seeded items are made by editing.
  for (const item of items)
    await writeEvidenceMarkdown(item.dir, item.evidence);
  const replay = options.replay ?? 0;
  let costUsd = 0;

  const inputs = await runPool(
    items,
    options.concurrency ?? 4,
    async (item): Promise<Evals.Calibration.ItemGradings> => {
      const base = {
        id: item.id,
        rubric: item.evidence.rubric,
        reportOnly: item.evidence.reportOnly,
        critical: item.evidence.critical,
        labels: item.labels.labels,
      };
      if (!replay)
        return item.recorded
          ? { ...base, gradings: [recordedGrading(item)] }
          : {
              ...base,
              gradings: [],
              skipped: "no recorded verdicts (seeded item): use --replay",
            };

      const workdir = await workspaceOf(item);
      if (workdir === null)
        return {
          ...base,
          gradings: [],
          skipped: `case uses workspaceAccess but ${FILES.workspace}/ is missing: replay would grade without the files`,
        };
      const gradings: Grading[] = [];
      for (let n = 1; n <= replay; n++) {
        options.log?.(`  ${item.id}: replay ${n}/${replay}`);
        gradings.push(
          await replayOnce(
            options.judge!,
            item,
            workdir,
            `replay ${n}`,
            (c) => {
              costUsd += c;
            },
          ),
        );
      }
      return { ...base, gradings };
    },
  );

  return {
    score: scoreCalibration(inputs),
    mode: replay ? "replay" : "recorded",
    costUsd,
  };
}

function recordedGrading(item: Item): Grading {
  return {
    source: `run ${item.evidence.source.run} (${item.recorded!.runId})`,
    lines: new Map(
      item.recorded!.lines.map((l) => [
        l.line,
        { pass: l.pass, reason: l.reason },
      ]),
    ),
  };
}

async function replayOnce(
  judge: Evals.Judge.Grader,
  item: Item,
  workdir: string | undefined,
  source: string,
  addCost: (usd: number) => void,
): Promise<Grading> {
  const e = item.evidence;
  try {
    const result = await judge.grade({
      rubric: e.rubric,
      finalMessage: e.finalMessage,
      transcript: e.transcript,
      ...(e.diff !== undefined ? { diff: e.diff } : {}),
      ...(workdir ? { workdir } : {}),
    });
    addCost(result.costUsd ?? 0);
    return {
      source,
      lines: new Map(
        result.lines.map((l) => [l.text, { pass: l.pass, reason: l.reason }]),
      ),
    };
  } catch (err) {
    return { source, lines: new Map(), error: (err as Error).message };
  }
}

/** The saved workspace for a workspaceAccess item; undefined when not needed, null when missing. */
async function workspaceOf(item: Item): Promise<string | undefined | null> {
  if (!item.evidence.workspaceAccess) return undefined;
  const dir = path.join(item.dir, FILES.workspace);
  return (await stat(dir).then(
    (s) => s.isDirectory(),
    () => false,
  ))
    ? dir
    : null;
}
