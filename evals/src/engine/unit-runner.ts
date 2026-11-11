import { runShellCommand } from "../checks/command-runner.js";
import type { Evals } from "../shared/contracts.js";
import type { Grading, RunUnit } from "../shared/types.js";
import { AGENT_LIMITS } from "./defaults.js";
import { gradeRun, judgeOf } from "./grading.js";
import { completedRecord, failedRecord } from "./records.js";
import type { ResultsWriter } from "./results-writer.js";
import { runChecks } from "./run-checks.js";

/**
 * Runs one unit (one case, on one target, once) in its own temp workspace:
 * prepare workspace → run agent → checks → judge → save transcript → record → clean up.
 */
export class UnitRunner {
  private static readonly NOT_GRADED: Grading = { costUsd: 0 };

  private readonly runCommand: Evals.Commands.Runner;

  public constructor(
    private readonly deps: Evals.Engine.Deps,
    private readonly results: ResultsWriter,
  ) {
    this.runCommand = deps.runCommand ?? runShellCommand;
  }

  /** Never throws: a run that fails outside the agent comes back as a failed record. */
  public async run(unit: RunUnit): Promise<Evals.Report.RunRecord> {
    return this.attempt(unit).catch((err: Error) =>
      failedRecord(unit, err.message),
    );
  }

  private async attempt(unit: RunUnit): Promise<Evals.Report.RunRecord> {
    const adapter = this.deps.adapters[unit.tool]!;
    const skillInstallPath = `${adapter.skillsDir}/${this.deps.skillName}`;
    const workspace = await this.deps.workspace.prepare({
      ...(unit.case.input.template
        ? { template: unit.case.input.template }
        : {}),
      skillInstallPath,
      withSkill: unit.withSkill,
    });

    try {
      const agent = await UnitRunner.runAgent(
        adapter,
        unit,
        workspace.workdir,
        skillInstallPath,
      );
      const outcome = await runChecks(unit, agent, workspace, this.runCommand);
      const grading = outcome.checks.every((x) => x.pass)
        ? await this.grade(unit, agent, outcome.diff)
        : UnitRunner.NOT_GRADED;
      const transcriptFile = await this.results.writeTranscript(
        unit,
        agent,
        outcome.diff,
      );
      const record = completedRecord(
        unit,
        agent,
        outcome,
        grading,
        transcriptFile,
      );
      return workspace.kept
        ? { ...record, workdir: workspace.workdir }
        : record;
    } finally {
      await workspace.cleanup();
    }
  }

  /** Only cases with a rubric are graded, and only when the deterministic checks passed. */
  private async grade(
    unit: RunUnit,
    agent: Evals.Agent.RunResult,
    diff: string | undefined,
  ): Promise<Grading> {
    const judge = judgeOf(unit.case);
    if (!judge || !this.deps.judge) return UnitRunner.NOT_GRADED;
    return gradeRun(this.deps.judge, judge.rubric, agent, diff);
  }

  /** An adapter that throws is turned into an errored result, so the run is still recorded. */
  private static async runAgent(
    adapter: Evals.Agent.Adapter,
    unit: RunUnit,
    workdir: string,
    skillInstallPath: string,
  ): Promise<Evals.Agent.RunResult> {
    const c = unit.case;
    const limits = c.kind === "task" ? AGENT_LIMITS.task : AGENT_LIMITS.other;
    try {
      return await adapter.run({
        prompt: c.input.prompt,
        ...(c.input.reply ? { reply: c.input.reply } : {}),
        model: unit.model,
        workdir,
        skillInstallPath,
        network: c.network,
        maxTurns: c.maxTurns ?? limits.maxTurns,
        timeoutMs: c.timeoutMs ?? limits.timeoutMs,
      });
    } catch (err) {
      return {
        finalMessage: "",
        transcript: [],
        skillTriggered: false,
        triggerDetection: "skill-tool",
        flow: [],
        turns: 0,
        costUsd: null,
        stopReason: "error",
        error: (err as Error).message,
      };
    }
  }
}
