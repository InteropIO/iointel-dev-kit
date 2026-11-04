import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { ClaudeCodeAdapter } from "./adapters/claude-code.js";
import { CaseValidationError } from "./cases/loader.js";
import { EvalEngine, EvalSetupError } from "./engine/index.js";
import { AnthropicJudge } from "./judge/anthropic-judge.js";
import { approveRun } from "./report/baseline.js";
import { renderConsoleSummary } from "./report/console.js";
import { TempWorkspaceManager } from "./workspace/workspace.js";

const evalsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const paths = {
  cases: path.join(evalsRoot, "cases"),
  results: path.join(evalsRoot, "results"),
  baseline: path.join(evalsRoot, "baseline.json"),
  skill: path.resolve(evalsRoot, "..", "skills", "io-intelligence"),
};

const USAGE = `Usage:
  npm run eval -- [options]          Run the eval suite
  npm run eval:approve -- [--run ID] Promote the latest (or given) run to baseline.json

Options:
  --case ID          Only this case
  --model ID         Claude model to run the cases on (default claude-sonnet-5-5)
  --concurrency N    Cases at once (default 4)`;

async function main(argv: string[]) {
  loadEnv({ path: path.join(evalsRoot, ".env"), quiet: true });
  const [command = "run", ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      case: { type: "string" },
      model: { type: "string" },
      concurrency: { type: "string" },
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

  const engine = new EvalEngine({
    adapter: ClaudeCodeAdapter.getInstance(),
    judge: AnthropicJudge.getInstance(),
    workspace: new TempWorkspaceManager({ skillDir: paths.skill }),
    log: (line) => console.log(line),
  });
  const report = await engine.run({
    casesDir: paths.cases,
    resultsDir: paths.results,
    baselineFile: paths.baseline,
    ...(values.case ? { caseId: values.case } : {}),
    ...(values.model ? { model: values.model } : {}),
    ...(values.concurrency
      ? { concurrency: positiveInteger("--concurrency", values.concurrency) }
      : {}),
  });
  console.log("\n" + renderConsoleSummary(report));
}

function positiveInteger(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new EvalSetupError(`${flag} must be a positive integer`);
  return n;
}

// Report-only: a completed run exits 0 whatever the results. Only a run that cannot start exits 1.
main(process.argv.slice(2)).catch((err: Error) => {
  const known =
    err instanceof EvalSetupError || err instanceof CaseValidationError;
  console.error(known ? err.message : err);
  process.exitCode = 1;
});
