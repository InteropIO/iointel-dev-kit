import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUMMARY_FILE } from "../report/baseline.js";
import type { Evals } from "../shared/contracts.js";
import type { Grading } from "../shared/types.js";

/**
 * Owns one run's results folder, `<resultsDir>/<runId>/`:
 *   transcripts/<case>.json   one per case, written as each case finishes
 *   summary.json              the RunReport
 */
export class ResultsWriter {
  public readonly runId: string;
  public readonly runDir: string;

  public constructor(resultsDir: string, startedAt: Date) {
    this.runId = startedAt.toISOString().replace(/[:.]/g, "-");
    this.runDir = path.join(resultsDir, this.runId);
  }

  /** Creates the folder. Called only once the run is known to be able to start. */
  public async prepare(): Promise<void> {
    await mkdir(path.join(this.runDir, "transcripts"), { recursive: true });
  }

  /** Writes one case's transcript and returns its path relative to the run folder. */
  public async writeTranscript(
    c: Evals.Cases.Case,
    agent: Evals.Agent.RunResult,
    grading: Grading,
  ): Promise<string> {
    const file = path.posix.join("transcripts", `${c.id}.json`);
    const content = {
      finalMessage: agent.finalMessage,
      judge: grading.lines ?? null,
      transcript: agent.transcript,
    };
    await writeFile(
      path.join(this.runDir, file),
      JSON.stringify(content, null, 2),
    );
    return file;
  }

  public async writeReport(report: Evals.Report.RunReport): Promise<void> {
    await writeFile(
      path.join(this.runDir, SUMMARY_FILE),
      JSON.stringify(report, null, 2),
    );
  }
}
