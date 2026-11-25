import { compileMatcher } from "./matcher.js";
import { SKILL_PREFIX } from "../flow/normalize.js";
import type { Evals } from "../shared/contracts.js";

export function checkAnswerText(
  c: Evals.Cases.AnswerCase,
  finalMessage: string,
): Evals.Checks.Result[] {
  const { mustInclude, mustNotInclude } = c.output.deterministic;
  return [
    ...mustInclude.map((m) => {
      const pass = compileMatcher(m)(finalMessage);
      return {
        name: `mustInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "not found in the final message" }),
      };
    }),
    ...mustNotInclude.map((m) => {
      const pass = !compileMatcher(m)(finalMessage);
      return {
        name: `mustNotInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "found in the final message" }),
      };
    }),
  ];
}

// Commands that download a page, so a docs page read through the shell counts as a fetch.
const DOWNLOAD_COMMAND =
  /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b/i;

/**
 * Checks the run's flow. Pass `missingSkillFiles` for a run without the skill: checks whose
 * matcher points at one of those files (a skill reference read, a skill script run) are skipped,
 * since such a run can't read or run them and the comparison should rest on the other checks.
 */
export function checkFlow(
  c: Evals.Cases.Case,
  steps: readonly Evals.Flow.Step[],
  missingSkillFiles: readonly string[] = [],
): Evals.Checks.Result[] {
  const flow = c.output.deterministic.flow;
  if (!flow) return [];
  const onSkill = skillFileMatcher(missingSkillFiles);
  const reads = steps.flatMap((s) => (s.kind === "read" ? [s.path] : []));
  const runs = steps.flatMap((s) =>
    s.kind === "command"
      ? [s.command]
      : s.kind === "script"
        ? [[s.name, ...s.args].join(" ")]
        : [],
  );
  const fetches = steps.flatMap((s) =>
    s.kind === "fetch"
      ? [s.url]
      : s.kind === "command" && DOWNLOAD_COMMAND.test(s.command)
        ? [s.command]
        : [],
  );
  const any = (items: string[], m: string) => items.some(compileMatcher(m));
  // Fetches are URLs, never skill files, so mustFetch always runs.
  const check = (
    kind: "mustRead" | "mustNotRead" | "mustRun" | "mustFetch",
    m: string,
    pass: boolean,
  ): Evals.Checks.Result => {
    const name = `flow.${kind} ${m}`;
    if (kind !== "mustFetch" && onSkill(m))
      return {
        name,
        pass: true,
        skipped: true,
        detail:
          "not checked: it points at the skill's own files, and this run has no skill",
      };
    return pass
      ? { name, pass }
      : { name, pass, detail: "violated by the run flow" };
  };
  return [
    ...flow.mustRead.map((m) => check("mustRead", m, any(reads, m))),
    ...flow.mustNotRead.map((m) => check("mustNotRead", m, !any(reads, m))),
    ...flow.mustRun.map((m) => check("mustRun", m, any(runs, m))),
    ...flow.mustFetch.map((m) => check("mustFetch", m, any(fetches, m))),
  ];
}

/**
 * Whether a flow matcher points at the skill: it matches a skill file as the flow shows it
 * ("<skill>/references/core.md"), or a skill script as a script step names it ("materialize-template").
 */
function skillFileMatcher(files: readonly string[]): (m: string) => boolean {
  const targets = files.flatMap((f) => {
    const script = /^scripts\/([^/]+?)(?:\.m?[jt]s)?$/.exec(f)?.[1];
    return script ? [`${SKILL_PREFIX}/${f}`, script] : [`${SKILL_PREFIX}/${f}`];
  });
  return (m) => targets.some(compileMatcher(m));
}

/** Structural task checks: expected files, then package.json dependencies. Stops at the first failing stage. */
export async function checkTaskStructure(
  c: Evals.Cases.TaskCase,
  box: Pick<Evals.Sandbox.Box, "resolve" | "exists" | "readFile">,
): Promise<Evals.Checks.Result[]> {
  const fileResults: Evals.Checks.Result[] = [];
  for (const file of c.output.deterministic.files) {
    // Always under the workdir, as before: "/src/a.ts" means <workdir>/src/a.ts.
    const exists = await box.exists(box.resolve(file.replace(/^[\\/]+/, "")));
    fileResults.push({
      name: `file ${file}`,
      pass: exists,
      ...(exists ? {} : { detail: "missing" }),
    });
  }
  if (fileResults.some((r) => !r.pass) || !c.output.deterministic.packageJson)
    return fileResults;

  let pkg: Record<string, Record<string, string> | undefined>;
  try {
    const text = await box.readFile(box.resolve("package.json"));
    if (text === undefined) throw new Error("package.json does not exist");
    pkg = JSON.parse(text);
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
  const depResults: Evals.Checks.Result[] = [];
  for (const field of ["dependencies", "devDependencies"] as const) {
    for (const [name, expected] of Object.entries(
      c.output.deterministic.packageJson[field] ?? {},
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
  c: Evals.Cases.TaskCase,
  workdir: string,
  runCommand: Evals.Commands.Runner,
  timeoutMs: number,
): Promise<Evals.Checks.Result[]> {
  const results: Evals.Checks.Result[] = [];
  for (const command of c.output.deterministic.commands) {
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
