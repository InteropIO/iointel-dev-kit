import type { Evals } from "../shared/contracts.js";
import type { Grading } from "../shared/types.js";
import { AGENT_LIMITS } from "./defaults.js";
import { gradeRun, rubricOf } from "./grading.js";
import { completedReport, notRunReport } from "./records.js";
import type { ResultsWriter } from "./results-writer.js";
import { runChecks } from "./run-checks.js";

/**
 * Runs one case, once, in its own temp workspace:
 * prepare workspace → run agent → checks → judge → save transcript → report → clean up.
 */
export class CaseRunner {
  private static readonly NOT_GRADED: Grading = { costUsd: 0 };

  public constructor(
    private readonly deps: Evals.Engine.Deps,
    private readonly results: ResultsWriter,
    private readonly model: string | undefined,
    private readonly log: (line: string) => void,
  ) {}

  /** Never throws: a run that can't start comes back as a not-run report. */
  public async run(c: Evals.Cases.Case): Promise<Evals.Report.CaseReport> {
    let workspace: Evals.Workspace.Prepared;
    try {
      workspace = await this.deps.workspace.prepare({
        skillInstallPath: this.deps.adapter.skillInstallPath,
      });
    } catch (err) {
      return notRunReport(c, (err as Error).message);
    }

    try {
      const agent = await this.runAgent(c, workspace.workdir);
      const checks = runChecks(c, agent);
      const grading = checks.every((x) => x.pass)
        ? await this.grade(c, agent)
        : CaseRunner.NOT_GRADED;
      const transcriptFile = await this.saveTranscript(c, agent, grading);
      return completedReport(c, agent, checks, grading, transcriptFile);
    } finally {
      await workspace
        .cleanup()
        .catch((err: Error) =>
          this.log(
            `warning: could not delete ${workspace.workdir}: ${err.message}`,
          ),
        );
    }
  }

  /** The run already happened and was paid for, so a failed write only loses the file, not the result. */
  private async saveTranscript(
    c: Evals.Cases.Case,
    agent: Evals.Agent.RunResult,
    grading: Grading,
  ): Promise<string | undefined> {
    try {
      return await this.results.writeTranscript(c, agent, grading);
    } catch (err) {
      this.log(
        `warning: could not write the transcript of ${c.id}: ${(err as Error).message}`,
      );
      return undefined;
    }
  }

  /** Only cases with a rubric are graded, and only when the deterministic checks passed. */
  private async grade(
    c: Evals.Cases.Case,
    agent: Evals.Agent.RunResult,
  ): Promise<Grading> {
    const rubric = rubricOf(c);
    if (!rubric || !this.deps.judge) return CaseRunner.NOT_GRADED;
    return gradeRun(this.deps.judge, rubric, agent);
  }

  /** An adapter that throws is turned into an errored result, so the run is still reported. */
  private async runAgent(
    c: Evals.Cases.Case,
    workdir: string,
  ): Promise<Evals.Agent.RunResult> {
    try {
      return await this.deps.adapter.run({
        prompt: c.prompt,
        model: this.model,
        workdir,
        maxTurns: AGENT_LIMITS.maxTurns,
        timeoutMs: AGENT_LIMITS.timeoutMs,
      });
    } catch (err) {
      return {
        finalMessage: "",
        transcript: [],
        skillTriggered: false,
        turns: 0,
        costUsd: null,
        stopReason: "error",
        error: (err as Error).message,
      };
    }
  }
}
