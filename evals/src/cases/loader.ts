import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { caseSchema } from "./schema.js";
import type { Evals } from "../shared/contracts.js";

export class CaseValidationError extends Error {
  public override readonly name = "CaseValidationError";

  public constructor(public readonly problems: readonly string[]) {
    super(`Invalid case files:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

/** Loads and validates every case file. Any invalid file fails the whole load. */
export async function loadCases(
  casesDir: string,
): Promise<Evals.Cases.Loaded[]> {
  const files = await findJsonFiles(casesDir);
  const problems: string[] = [];
  const loaded: Evals.Cases.Loaded[] = [];

  for (const file of files) {
    const rel = path.relative(casesDir, file).replaceAll("\\", "/");
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      problems.push(`${rel}: JSON parse error: ${(err as Error).message}`);
      continue;
    }
    const result = caseSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const where = issue.path.length ? issue.path.join(".") : "(root)";
        problems.push(`${rel}: ${where}: ${issue.message}`);
      }
      continue;
    }
    loaded.push({ file: rel, case: result.data });
  }

  const seen = new Map<string, string>();
  for (const { file, case: c } of loaded) {
    const other = seen.get(c.id);
    if (other)
      problems.push(`${file}: duplicate case id "${c.id}" (also in ${other})`);
    else seen.set(c.id, file);
  }

  if (problems.length) throw new CaseValidationError(problems);
  return loaded.sort((a, b) => a.case.id.localeCompare(b.case.id));
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT")
        throw new CaseValidationError([`cases folder not found: ${dir}`]);
      throw err;
    },
  );
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findJsonFiles(full)));
    else if (/\.json$/i.test(entry.name)) files.push(full);
  }
  return files;
}
