import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { ClaudeCodeAdapter } from "./adapters/claude-code.js";
import { CodexAdapter } from "./adapters/codex.js";
import { CaseValidationError } from "./cases/loader.js";
import { EvalSetupError, runEval } from "./engine/index.js";
import { AnthropicJudge } from "./judge/anthropic-judge.js";
import { approveRun } from "./report/baseline.js";
import { renderConsoleSummary } from "./report/console.js";
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
  fixtures: path.join(evalsRoot, "fixtures"),
  skill: path.resolve(evalsRoot, "..", "skills", "io-intelligence"),
};

const USAGE = `Usage:
  npm run eval -- [options]          Run the eval suite
  npm run eval:approve -- [--run ID] Promote the latest (or given) run to baseline.json

Options:
  --kind trigger|answer|task   Only cases of this kind
  --case ID                    Only this case
  --target ID                  Only this target ("claude-code/claude-sonnet-5-5") or tool ("codex")
  --repeat N                   Runs per case (default 3; a case's own repeat wins)
  --concurrency N              Runs at once (default 4)
  --max-cost USD               Stop starting new runs once this much has been spent
  --baseline                   Also run every case with the skill removed, to show what it adds
  --keep-workdirs              Keep temp workspaces for debugging`;

async function main(argv: string[]) {
  loadEnv({ path: path.join(evalsRoot, ".env"), quiet: true });
  const [command = "run", ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      kind: { type: "string" },
      case: { type: "string" },
      target: { type: "string" },
      repeat: { type: "string" },
      concurrency: { type: "string" },
      "max-cost": { type: "string" },
      baseline: { type: "boolean" },
      "keep-workdirs": { type: "boolean" },
      run: { type: "string" },
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
  if (command !== "run")
    throw new EvalSetupError(`Unknown command "${command}".\n\n${USAGE}`);

  if (values.kind && !["trigger", "answer", "task"].includes(values.kind))
    throw new EvalSetupError(`--kind must be trigger, answer or task`);
  const report = await runEval(
    {
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
      withoutSkill: !!values.baseline,
    },
    {
      adapters: {
        "claude-code": ClaudeCodeAdapter.getInstance(),
        codex: CodexAdapter.getInstance(),
      },
      judge: AnthropicJudge.getInstance(),
      workspace: new GitWorkspaceManager({
        skillDir: paths.skill,
        fixturesDir: paths.fixtures,
        keep: !!values["keep-workdirs"],
      }),
      log: (line) => console.log(line),
    },
  );
  console.log("\n" + renderConsoleSummary(report));
}

function positiveNumber(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new EvalSetupError(`${flag} must be a positive number`);
  return n;
}

// Report-only: a completed run exits 0 whatever the results. Only a run that cannot start exits 1.
main(process.argv.slice(2)).catch((err: Error) => {
  const known =
    err instanceof EvalSetupError || err instanceof CaseValidationError;
  console.error(known ? err.message : err);
  process.exitCode = 1;
});
