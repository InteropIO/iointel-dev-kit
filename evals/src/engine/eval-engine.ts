import {
  compareWithReference,
  isFiltered,
  loadReference,
} from "../report/baseline.js";
import type { Evals } from "../shared/contracts.js";
import { CaseRunner } from "./case-runner.js";
import { DEFAULT_CONCURRENCY } from "./defaults.js";
import { selectCases } from "./planning.js";
import { runPool } from "./pool.js";
import { checkSetup } from "./preflight.js";
import { ResultsWriter } from "./results-writer.js";
import { buildRunReport } from "./run-report.js";

/**
 * Runs the eval suite. Everything that talks to the outside world (the agent tool, the judge,
 * workspaces) comes in through `deps`, so one engine can be tested with fakes.
 *
 *   select cases → preflight → run every case once → compare with baseline → write results
 */
export class EvalEngine {
  private readonly now: () => Date;
  private readonly log: (line: string) => void;

  public constructor(private readonly deps: Evals.Engine.Deps) {
    this.now = deps.now ?? (() => new Date());
    this.log = deps.log ?? (() => {});
  }

  public async run(
    options: Evals.Engine.Options,
  ): Promise<Evals.Report.RunReport> {
    const startedAt = this.now();
    const results = new ResultsWriter(options.resultsDir, startedAt);
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

    // 1. Decide what to run, and fail before anything runs if it can't.
    const cases = await selectCases(options);
    checkSetup(cases, this.deps);
    const reference = await loadReference(options.baselineFile);

    // 2. Run it.
    await results.prepare();
    this.log(`Running ${cases.length} case(s), concurrency ${concurrency}.`);
    const runner = new CaseRunner(this.deps, results, options.model, this.log);
    const caseReports = await runPool(cases, concurrency, async (c) => {
      const report = await runner.run(c);
      this.log(`${report.pass ? "pass" : "FAIL"}  ${c.id}`);
      return report;
    });

    // 3. Compare it with the baseline, and write it down.
    const report = buildRunReport({
      runId: results.runId,
      runDir: results.runDir,
      startedAt,
      finishedAt: this.now(),
      options,
      concurrency,
      reference,
      cases: caseReports,
      comparison: compareWithReference(caseReports, reference, {
        filtered: isFiltered(options),
      }),
    });
    await results.writeReport(report);
    return report;
  }
}
