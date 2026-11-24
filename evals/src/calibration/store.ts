// The calibration set on disk: one folder per item under evals/calibration/, each a graded run
// frozen with a human's verdicts for its rubric lines (docs/judge-governance.md §5.1). Items are
// grouped by case, then by the results run they came from; an item's id is that relative path.
//
//   calibration/<case-id>/<results-run-id>/
//     reports/          calibration-<time>.md, one per eval:calibrate that scored this group
//     <target>__<n>/    one item: run n of the case on that target
//       evidence.json   what the judge grades: rubric, final message, diff, raw transcript
//       evidence.md     the same as the judge reads it, for labelling (regenerated, never edit)
//       labels.json     the human verdict per line (pass: true/false, null while unlabelled)
//       verdicts.json   the judge's verdicts from the original run (absent for seeded items)
//       workspace/      the run's workspace minus node_modules and .git, for workspaceAccess cases
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Evals } from "../shared/contracts.js";
import type { Mutable, Same } from "../shared/types.js";

const evidenceSchema = z.object({
  version: z.literal(1),
  source: z.object({
    runId: z.string(),
    caseId: z.string(),
    target: z.string(),
    run: z.number().int(),
  }),
  /** Why the item exists, e.g. what was changed in a seeded copy. */
  note: z.string().optional(),
  rubric: z.array(z.string().min(1)).min(1),
  /** Lines of type "report" in the case when the item was added. */
  reportOnly: z.array(z.string()).default([]),
  critical: z.array(z.string()).default([]),
  finalMessage: z.string(),
  diff: z.string().optional(),
  transcript: z.array(z.unknown()),
  workspaceAccess: z.boolean(),
});

const labelsSchema = z.object({
  labelledBy: z.string().default(""),
  labels: z.array(
    z.object({
      line: z.string(),
      pass: z.boolean().nullable(),
      evidence: z.string().default(""),
    }),
  ),
});

const verdictsSchema = z.object({
  runId: z.string(),
  lines: z.array(
    z.object({ line: z.string(), pass: z.boolean(), reason: z.string() }),
  ),
});

// Compile-time checks that each schema produces exactly its Evals.Calibration contract.
const schemasMatchContracts: [
  Same<z.infer<typeof evidenceSchema>, Mutable<Evals.Calibration.Evidence>>,
  Same<z.infer<typeof labelsSchema>, Mutable<Evals.Calibration.Labels>>,
  Same<
    z.infer<typeof verdictsSchema>,
    Mutable<Evals.Calibration.RecordedVerdicts>
  >,
] = [true, true, true];
void schemasMatchContracts;

export const FILES = {
  evidence: "evidence.json",
  evidenceMarkdown: "evidence.md",
  labels: "labels.json",
  verdicts: "verdicts.json",
  workspace: "workspace",
  reports: "reports",
} as const;

/** An item's id: its folder relative to the calibration folder, always with "/" separators. */
export function itemId(
  caseId: string,
  runId: string,
  target: string,
  run: number,
): string {
  return `${caseId}/${runId}/${target.replace(/[^\w.-]+/g, "_")}__${run}`;
}

/** The group an item belongs to, "<case-id>/<results-run-id>": where its reports go. */
export function groupOf(id: string): string {
  return id.split("/").slice(0, 2).join("/");
}

export class CalibrationError extends Error {
  public override readonly name = "CalibrationError";
}

/** Every item in the calibration folder whose id contains `filter`, sorted by id. */
export async function loadItems(
  calibrationDir: string,
  filter?: string,
): Promise<Evals.Calibration.Item[]> {
  const ids: string[] = [];
  for (const caseId of await subdirs(calibrationDir))
    for (const runId of await subdirs(path.join(calibrationDir, caseId)))
      for (const name of await subdirs(
        path.join(calibrationDir, caseId, runId),
      ))
        if (name !== FILES.reports) ids.push(`${caseId}/${runId}/${name}`);
  const items: Evals.Calibration.Item[] = [];
  for (const id of ids.filter((i) => !filter || i.includes(filter)).sort()) {
    const dir = path.join(calibrationDir, id);
    const evidence = await readFileWith(dir, FILES.evidence, evidenceSchema);
    if (!evidence) continue; // not an item folder
    const labels = await readFileWith(dir, FILES.labels, labelsSchema);
    if (!labels) throw new CalibrationError(`${id}: missing ${FILES.labels}`);
    const recorded = await readFileWith(dir, FILES.verdicts, verdictsSchema);
    items.push({
      id,
      dir,
      evidence,
      labels,
      ...(recorded ? { recorded } : {}),
    });
  }
  return items;
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

async function readFileWith<T>(
  dir: string,
  name: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  let raw: string;
  try {
    raw = await readFile(path.join(dir, name), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
  const where = path.relative(process.cwd(), path.join(dir, name));
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new CalibrationError(`${where}: ${(err as Error).message}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new CalibrationError(
      `${where}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`,
    );
  return parsed.data;
}
