import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUMMARY_FILE } from "../report/baseline.js";
import { renderCaseMarkdown } from "../report/case-markdown.js";
import { renderFlowMarkdown } from "../report/flow-markdown.js";
import type { Evals } from "../shared/contracts.js";
import type { RunDetails, RunUnit } from "../shared/types.js";
import { flowSnapshot } from "./records.js";

/**
 * Owns one run's results folder, `<resultsDir>/<runId>/`:
 *   transcripts/<case>__<target>__<n>.json   one per run, written as each run finishes
 *   summary.json                             the RunReport
 *   flows/<case>.md                          flow snapshots per case, for reading and diffing
 *   reports/<case>.md                        everything per case: prompt, checks, judge, flow, final message, diff
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

  /** Writes one run's transcript and returns its path relative to the run folder. */
  public async writeTranscript(
    unit: RunUnit,
    agent: Evals.Agent.RunResult,
    diff: string | undefined,
  ): Promise<string> {
    const file = ResultsWriter.transcriptFile(unit);
    const content = {
      finalMessage: agent.finalMessage,
      flow: flowSnapshot(agent),
      diff,
      transcript: agent.transcript,
    };
    await writeFile(
      path.join(this.runDir, file),
      JSON.stringify(content, null, 2),
    );
    return file;
  }

  public async writeReport(
    report: Evals.Report.RunReport,
    cases: Evals.Cases.Case[],
  ): Promise<void> {
    await writeFile(
      path.join(this.runDir, SUMMARY_FILE),
      JSON.stringify(report, null, 2),
    );
    await this.writeFlows(report, cases);
    await this.writeCaseReports(report, cases);
  }

  private async writeCaseReports(
    report: Evals.Report.RunReport,
    cases: Evals.Cases.Case[],
  ): Promise<void> {
    await mkdir(path.join(this.runDir, "reports"), { recursive: true });
    for (const c of cases) {
      const reports = report.cases.filter((r) => r.caseId === c.id);
      if (!reports.length) continue;
      const details = new Map<string, RunDetails>();
      for (const r of reports)
        for (const run of [...r.runs, ...(r.withoutSkill?.runs ?? [])])
          if (run.transcriptFile)
            details.set(
              run.transcriptFile,
              await this.readDetails(run.transcriptFile),
            );
      const md = renderCaseMarkdown(c, reports, (run) =>
        run.transcriptFile ? details.get(run.transcriptFile) : undefined,
      );
      await writeFile(path.join(this.runDir, "reports", `${c.id}.md`), md);
    }
  }

  /** The final message and diff saved in a run's transcript file. */
  private async readDetails(file: string): Promise<RunDetails> {
    const saved = JSON.parse(
      await readFile(path.join(this.runDir, file), "utf8"),
    ) as RunDetails;
    return {
      finalMessage: saved.finalMessage,
      ...(saved.diff !== undefined ? { diff: saved.diff } : {}),
    };
  }

  private async writeFlows(
    report: Evals.Report.RunReport,
    cases: Evals.Cases.Case[],
  ): Promise<void> {
    await mkdir(path.join(this.runDir, "flows"), { recursive: true });
    for (const c of cases) {
      const reports = report.cases.filter((r) => r.caseId === c.id);
      if (!reports.length) continue;
      const md = renderFlowMarkdown(
        c.id,
        reports,
        report.comparison.filter((x) => x.caseId === c.id),
      );
      await writeFile(path.join(this.runDir, "flows", `${c.id}.md`), md);
    }
  }

  private static transcriptFile(unit: RunUnit): string {
    const target = unit.target.replace(/[^\w.-]+/g, "_");
    const skill = unit.withSkill ? "" : "noskill-";
    return path.posix.join(
      "transcripts",
      `${unit.case.id}__${target}__${skill}${unit.index + 1}.json`,
    );
  }
}
