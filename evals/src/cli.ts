import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { ClaudeCodeAdapter } from "./adapters/claude-code.js";
import { CodexAdapter } from "./adapters/codex.js";
import { CaseValidationError } from "./cases/loader.js";
import { addItems } from "./calibration/add-items.js";
import { calibrate } from "./calibration/calibrate.js";
import {
  renderCalibrationConsole,
  renderCalibrationMarkdown,
} from "./calibration/calibration-report.js";
import { CalibrationError } from "./calibration/store.js";
import { EvalEngine, EvalSetupError } from "./engine/index.js";
import { AnthropicJudge } from "./judge/anthropic-judge.js";
import { approveRun } from "./report/baseline.js";
import { renderConsoleSummary } from "./report/console.js";
import { resolveSkill } from "./workspace/skill.js";
import { resolveWorkdirRoot } from "./workspace/workdir-root.js";
import { GitWorkspaceManager } from "./workspace/workspace.js";
import type { Evals } from "./shared/contracts.js";

const evalsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const paths = {
  cases: path.join(evalsRoot, "cases"),
  results: path.join(evalsRoot, "results"),
  baseline: path.join(evalsRoot, "baseline.json"),
  localTemplates: path.join(evalsRoot, "templates"),
  calibration: path.join(evalsRoot, "calibration"),
};

const USAGE = `Usage:
  npm run eval -- [options]          Run the eval suite
  npm run eval:approve -- [--run ID] Promote the latest (or given) run to baseline.json
  npm run eval:calibrate -- add --case ID [--run ID] [--target ID] [--number N]
                                     Freeze graded runs as calibration items to label
  npm run eval:calibrate -- [--item TEXT] [--replay N]
                                     Compare the judge with the labels (docs/judge-governance.md 5.1)

Options:
  --kind trigger|answer|task   Only cases of this kind
  --case ID                    Only this case
  --target ID                  Only this target ("claude-code/claude-sonnet-5-5") or tool ("codex")
  --repeat N                   Runs per case (default 3; a case's own repeat wins)
  --concurrency N              Runs at once (default 4)
  --max-cost USD               Stop starting new runs once this much has been spent
  --without-skill              Also run every case with the skill removed, to show what it adds
  --keep-workdirs              Keep temp workspaces for debugging (and for calibration
                               items of workspaceAccess cases)

Calibration options:
  --run ID                     The results run to take items from (default: the latest)
  --number N                   Only run N of the case (as numbered in summary.json)
  --item TEXT                  Only items whose folder name contains TEXT
  --replay N                   Grade each item N times with the current judge (costs judge
                               calls); without it, the verdicts recorded in the run are used`;

async function main(argv: string[]) {
  loadEnv({ path: path.join(evalsRoot, ".env"), quiet: true });
  const [command = "run", ...rest] = argv;
  if (rest.includes("--baseline"))
    throw new EvalSetupError(
      "--baseline was renamed to --without-skill (it runs every case with the skill removed). baseline.json is managed by eval:approve.",
    );
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      kind: { type: "string" },
      case: { type: "string" },
      target: { type: "string" },
      repeat: { type: "string" },
      concurrency: { type: "string" },
      "max-cost": { type: "string" },
      "without-skill": { type: "boolean" },
      "keep-workdirs": { type: "boolean" },
      run: { type: "string" },
      number: { type: "string" },
      item: { type: "string" },
      replay: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) return console.log(USAGE);

  if (command === "approve") {
    const runId = await approveRun({
      resultsDir: paths.results,
      baselineFile: paths.baseline,
      ...(values.run ? { runId: values.run } : {}),
    });
    return console.log(
      `Approved run ${runId} as the baseline (${path.relative(process.cwd(), paths.baseline)}). Commit it to share it.`,
    );
  }
  if (command === "calibrate") return runCalibrate(positionals, values);
  if (command !== "run")
    throw new EvalSetupError(`Unknown command "${command}".\n\n${USAGE}`);

  if (values.kind && !["trigger", "answer", "task"].includes(values.kind))
    throw new EvalSetupError(`--kind must be trigger, answer or task`);
  const skill = await resolveSkill(evalsRoot);
  console.log(
    `Skill under test: ${skill.name} (${path.relative(process.cwd(), skill.dir) || "."})`,
  );
  const workdirRoot = await resolveWorkdirRoot(
    evalsRoot,
    path.resolve(evalsRoot, ".."),
  );
  console.log(`Workspaces in: ${workdirRoot}`);
  const engine = new EvalEngine({
    adapters: {
      "claude-code": ClaudeCodeAdapter.getInstance(),
      codex: CodexAdapter.getInstance(),
    },
    skillName: skill.name,
    judge: AnthropicJudge.getInstance(),
    workspace: new GitWorkspaceManager({
      skillDir: skill.dir,
      localTemplatesDir: paths.localTemplates,
      workdirRoot,
      keep: !!values["keep-workdirs"],
    }),
    log: (line) => console.log(line),
  });
  const report = await engine.run({
    casesDir: paths.cases,
    resultsDir: paths.results,
    baselineFile: paths.baseline,
    ...(values.kind ? { kind: values.kind as Evals.Cases.Kind } : {}),
    ...(values.case ? { caseId: values.case } : {}),
    ...(values.target ? { target: values.target } : {}),
    ...(values.repeat
      ? { repeat: positiveNumber("--repeat", values.repeat) }
      : {}),
    ...(values.concurrency
      ? { concurrency: positiveNumber("--concurrency", values.concurrency) }
      : {}),
    ...(values["max-cost"]
      ? { maxCostUsd: positiveNumber("--max-cost", values["max-cost"]) }
      : {}),
    withoutSkill: !!values["without-skill"],
  });
  console.log("\n" + renderConsoleSummary(report));
}

async function runCalibrate(
  positionals: string[],
  values: Record<string, string | boolean | undefined>,
): Promise<void> {
  const str = (k: string) => values[k] as string | undefined;
  if (positionals[0] === "add") {
    if (!str("case"))
      throw new EvalSetupError(`add needs --case ID

${USAGE}`);
    const added = await addItems({
      resultsDir: paths.results,
      casesDir: paths.cases,
      calibrationDir: paths.calibration,
      caseId: str("case")!,
      ...(str("run") ? { runId: str("run")! } : {}),
      ...(str("target") ? { target: str("target")! } : {}),
      ...(str("number")
        ? { run: positiveNumber("--number", str("number")!) }
        : {}),
    });
    for (const a of added)
      console.log(
        a.created
          ? `Added calibration/${a.id}/${a.workspaceMissing ? " (workspace not kept: re-run with --keep-workdirs to replay this case with file access)" : ""}`
          : `Exists, left unchanged: calibration/${a.id}/`,
      );
    if (added.some((a) => a.created))
      console.log(
        "Next: fill in pass (true/false) and evidence for every line in labels.json. Decide from evidence.md (and workspace/ if present); don't open verdicts.json until you're done.",
      );
    return;
  }
  if (positionals.length)
    throw new EvalSetupError(
      `Unknown calibrate command "${positionals[0]}".

${USAGE}`,
    );
  const replay = str("replay")
    ? positiveNumber("--replay", str("replay")!)
    : undefined;
  const judge = AnthropicJudge.getInstance();
  if (replay) {
    const problem = judge.checkReady();
    if (problem) throw new EvalSetupError(problem);
  }
  const run = await calibrate({
    calibrationDir: paths.calibration,
    ...(str("item") ? { filter: str("item")! } : {}),
    ...(replay ? { replay, judge } : {}),
    log: (line) => console.log(line),
  });
  console.log(renderCalibrationConsole(run));
  if (run.score.items) {
    const at = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(paths.results, `calibration-${at}.md`);
    await mkdir(paths.results, { recursive: true });
    await writeFile(file, renderCalibrationMarkdown(run, at));
    console.log(`Report: ${path.relative(process.cwd(), file)}`);
  }
  // A gate, unlike eval runs: a judge below the targets exits 1.
  if (run.score.status === "fail") process.exitCode = 1;
}

function positiveNumber(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new EvalSetupError(`${flag} must be a positive number`);
  return n;
}

// Report-only: a completed eval run exits 0 whatever the results. Only a run that cannot start exits 1.
// Calibration is the exception: a judge below the targets exits 1 (see runCalibrate).
main(process.argv.slice(2)).catch((err: Error) => {
  const known =
    err instanceof EvalSetupError ||
    err instanceof CaseValidationError ||
    err instanceof CalibrationError;
  console.error(known ? err.message : err);
  process.exitCode = 1;
});
