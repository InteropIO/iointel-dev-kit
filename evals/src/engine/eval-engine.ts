import {
  compareWithReference,
  isFiltered,
  loadReference,
} from "../report/baseline.js";
import type { Evals } from "../shared/contracts.js";
import type { RunUnit } from "../shared/types.js";
import { aggregateCases } from "./aggregate.js";
import { DEFAULT_CONCURRENCY } from "./defaults.js";
import { planRuns, selectCases } from "./planning.js";
import { runPool } from "./pool.js";
import { EvalSetupError } from "./errors.js";
import { checkSetup } from "./preflight.js";
import { skippedRecord } from "./records.js";
import { ResultsWriter } from "./results-writer.js";
import { buildRunReport } from "./run-report.js";
import { UnitRunner } from "./unit-runner.js";

/**
 * Runs the eval suite. Everything that talks to the outside world (agent tools, the judge,
 * workspaces, shell commands) comes in through `deps`, so one engine can be tested with fakes.
 *
 *   plan → preflight → run every unit → aggregate → compare with baseline → write results
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
    const units = planRuns(cases, options);
    checkSetup(units, this.deps);
    await this.startWorkspace(units);

    // 2. Run it.
    let records: Evals.Report.RunRecord[];
    try {
      await results.prepare();
      this.log(
        `Running ${units.length} run(s) across ${cases.length} case(s), concurrency ${concurrency}${this.isolationNote()}.`,
      );
      records = await this.runUnits(units, options, concurrency, results);
    } finally {
      // Cleanup trouble must not cost the results of runs that already finished.
      await this.deps.workspace
        .stop?.()
        .catch((err: Error) =>
          this.log(`Cleanup after the run failed: ${err.message}`),
        );
    }

    // 3. Score it, compare it with the baseline, and write it down.
    const caseReports = aggregateCases(cases, units, records, options);
    const isolation = this.deps.workspace.isolation ?? "host";
    const reference = await loadReference(
      options.baselineFile,
      options.resultsDir,
      results.runId,
      isolation,
    );
    if (reference.skippedBaseline)
      this.log(
        `baseline.json was approved from a ${reference.skippedBaseline} run, so this ${isolation} run is compared with ${reference.kind === "none" ? "nothing" : `run ${reference.runId}`} instead.`,
      );
    const report = buildRunReport({
      runId: results.runId,
      runDir: results.runDir,
      startedAt,
      finishedAt: this.now(),
      options,
      concurrency,
      isolation,
      reference,
      records,
      cases: caseReports,
      comparison: compareWithReference(caseReports, reference, {
        filtered: isFiltered(options),
      }),
    });
    await results.writeReport(report, cases);
    return report;
  }

  /** Lets the workspace set up what every run shares (e.g. a container proxy); its failure stops the run. */
  private async startWorkspace(units: RunUnit[]): Promise<void> {
    if (!units.length || !this.deps.workspace.start) return;
    try {
      await this.deps.workspace.start([...new Set(units.map((u) => u.tool))]);
    } catch (err) {
      await this.deps.workspace.stop?.().catch(() => {});
      throw err instanceof EvalSetupError
        ? err
        : new EvalSetupError((err as Error).message);
    }
  }

  private isolationNote(): string {
    const isolation = this.deps.workspace.isolation ?? "host";
    return isolation === "host" ? "" : `, isolation ${isolation}`;
  }

  /** Runs units in parallel. Once --max-cost is spent, the remaining units are skipped. */
  private async runUnits(
    units: RunUnit[],
    options: Evals.Engine.Options,
    concurrency: number,
    results: ResultsWriter,
  ): Promise<Evals.Report.RunRecord[]> {
    const runner = new UnitRunner(this.deps, results);
    let spent = 0;

    return runPool(units, concurrency, async (unit) => {
      if (options.maxCostUsd !== undefined && spent >= options.maxCostUsd)
        return skippedRecord(
          unit,
          `cost cap of $${options.maxCostUsd} reached`,
        );

      const record = await runner.run(unit);
      spent += record.costUsd ?? 0;
      this.log(EvalEngine.progressLine(unit, record));
      return record;
    });
  }

  private static progressLine(
    unit: RunUnit,
    record: Evals.Report.RunRecord,
  ): string {
    const verdict = record.pass ? "pass" : "FAIL";
    const skill = unit.withSkill ? "" : " (without skill)";
    const kept = record.workdir
      ? `\n      workspace kept: ${record.workdir}${record.reopenCommand ? `\n      reopen it with: ${record.reopenCommand}` : ""}`
      : "";
    const blocked = record.network?.filter((r) => !r.allowed) ?? [];
    const network = blocked.length
      ? `\n      blocked by the proxy: ${blocked.map((r) => r.host).join(", ")}`
      : "";
    return `${verdict}  ${unit.case.id} [${unit.target}] run ${unit.index + 1}${skill}${network}${kept}`;
  }
}
