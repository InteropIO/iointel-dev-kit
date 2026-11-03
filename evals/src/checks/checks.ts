import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { AnswerCase, EvalCase, TaskCase } from "../cases/schema.js";
import type { CommandRunner, FlowStep } from "../types.js";
import { compileMatcher } from "./matcher.js";

export interface CheckResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail?: string;
}

export function checkAnswerText(
  c: AnswerCase,
  finalMessage: string,
): CheckResult[] {
  return [
    ...c.mustInclude.map((m) => {
      const pass = compileMatcher(m)(finalMessage);
      return {
        name: `mustInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "not found in the final message" }),
      };
    }),
    ...c.mustNotInclude.map((m) => {
      const pass = !compileMatcher(m)(finalMessage);
      return {
        name: `mustNotInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "found in the final message" }),
      };
    }),
  ];
}

export function checkFlow(
  c: EvalCase,
  steps: readonly FlowStep[],
): CheckResult[] {
  if (!c.flow) return [];
  const reads = steps.flatMap((s) => (s.kind === "read" ? [s.path] : []));
  const runs = steps.flatMap((s) =>
    s.kind === "command"
      ? [s.command]
      : s.kind === "script"
        ? [[s.name, ...s.args].join(" ")]
        : [],
  );
  const any = (items: string[], m: string) => items.some(compileMatcher(m));
  return [
    ...c.flow.mustRead.map((m) => ({
      name: `flow.mustRead ${m}`,
      pass: any(reads, m),
    })),
    ...c.flow.mustNotRead.map((m) => ({
      name: `flow.mustNotRead ${m}`,
      pass: !any(reads, m),
    })),
    ...c.flow.mustRun.map((m) => ({
      name: `flow.mustRun ${m}`,
      pass: any(runs, m),
    })),
  ].map((r) => (r.pass ? r : { ...r, detail: "violated by the run flow" }));
}

/** Structural task checks: expected files, then package.json dependencies. Stops at the first failing stage. */
export async function checkTaskStructure(
  c: TaskCase,
  workdir: string,
): Promise<CheckResult[]> {
  const fileResults: CheckResult[] = [];
  for (const file of c.checks.files) {
    const exists = await access(path.join(workdir, file)).then(
      () => true,
      () => false,
    );
    fileResults.push({
      name: `file ${file}`,
      pass: exists,
      ...(exists ? {} : { detail: "missing" }),
    });
  }
  if (fileResults.some((r) => !r.pass) || !c.checks.packageJson)
    return fileResults;

  let pkg: Record<string, Record<string, string> | undefined>;
  try {
    pkg = JSON.parse(
      await readFile(path.join(workdir, "package.json"), "utf8"),
    );
  } catch (err) {
    return [
      ...fileResults,
      {
        name: "package.json",
        pass: false,
        detail: `cannot read: ${(err as Error).message}`,
      },
    ];
  }
  const depResults: CheckResult[] = [];
  for (const field of ["dependencies", "devDependencies"] as const) {
    for (const [name, expected] of Object.entries(
      c.checks.packageJson[field] ?? {},
    )) {
      const actual = pkg[field]?.[name];
      // "*" accepts any declared version; anything else must equal the declared range exactly.
      const pass =
        actual !== undefined && (expected === "*" || actual === expected);
      depResults.push({
        name: `${field} ${name}@${expected}`,
        pass,
        ...(pass
          ? {}
          : {
              detail:
                actual === undefined ? "not declared" : `declared as ${actual}`,
            }),
      });
    }
  }
  return [...fileResults, ...depResults];
}

const OUTPUT_TAIL_CHARS = 4000;

/** Runs the case's commands in order, stopping at the first non-zero exit. */
export async function runTaskCommands(
  c: TaskCase,
  workdir: string,
  runCommand: CommandRunner,
  timeoutMs: number,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const command of c.checks.commands) {
    const { exitCode, output } = await runCommand(command, workdir, timeoutMs);
    const pass = exitCode === 0;
    results.push({
      name: `command ${command}`,
      pass,
      ...(pass
        ? {}
        : {
            detail: `exit ${exitCode ?? "timeout"}\n${output.slice(-OUTPUT_TAIL_CHARS)}`,
          }),
    });
    if (!pass) break;
  }
  return results;
}
