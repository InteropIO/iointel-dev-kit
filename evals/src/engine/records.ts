// Builds the RunRecord for each way a run can end: completed, failed outside the agent, or skipped.
import type { Evals } from "../shared/contracts.js";
import type { CheckOutcome, Grading, RunUnit } from "../shared/types.js";
import { meetsRubric } from "./grading.js";

/** The agent ran (possibly with an error), and its checks and grading are in. */
export function completedRecord(
  unit: RunUnit,
  agent: Evals.Agent.RunResult,
  outcome: CheckOutcome,
  grading: Grading,
  transcriptFile: string,
): Evals.Report.RunRecord {
  const checks = grading.failedCheck
    ? [...outcome.checks, grading.failedCheck]
    : outcome.checks;
  const pass =
    meetsTriggerExpectation(unit, agent) &&
    checks.every((x) => x.pass) &&
    meetsRubric(unit.case, grading);

  return {
    ...identity(unit),
    skipped: false,
    pass,
    triggered: agent.skillTriggered,
    triggerDetection: agent.triggerDetection,
    checks,
    ...(grading.lines ? { judge: grading.lines } : {}),
    ...(grading.score !== undefined ? { rubricScore: grading.score } : {}),
    stopReason: agent.stopReason,
    ...(agent.error ? { error: agent.error } : {}),
    costUsd:
      agent.costUsd === null || grading.costUsd === null
        ? null
        : agent.costUsd + grading.costUsd,
    flow: flowSnapshot(agent),
    transcriptFile,
  };
}

/** The run failed outside the agent, e.g. the workspace could not be prepared. */
export function failedRecord(
  unit: RunUnit,
  error: string,
): Evals.Report.RunRecord {
  return {
    ...identity(unit),
    ...notRun(),
    skipped: false,
    error,
    stopReason: "error",
    costUsd: null,
  };
}

/** The run never started, e.g. the cost cap was reached. */
export function skippedRecord(
  unit: RunUnit,
  reason: string,
): Evals.Report.RunRecord {
  return {
    ...identity(unit),
    ...notRun(),
    skipped: true,
    skipReason: reason,
    costUsd: 0,
  };
}

/** The agent's path through the run, as stored in the record and the transcript file. */
export function flowSnapshot(
  agent: Evals.Agent.RunResult,
): Evals.Flow.Snapshot {
  return {
    steps: agent.flow,
    stopReason: agent.stopReason,
    turns: agent.turns,
    costUsd: agent.costUsd,
  };
}

/** Skill-removed runs can't trigger the skill, so their trigger expectation is ignored. */
function meetsTriggerExpectation(
  unit: RunUnit,
  agent: Evals.Agent.RunResult,
): boolean {
  return !unit.withSkill || agent.skillTriggered === unit.case.expectSkill;
}

function identity(unit: RunUnit) {
  return {
    caseId: unit.case.id,
    target: unit.target,
    index: unit.index,
    withSkill: unit.withSkill,
  };
}

function notRun() {
  return { pass: false, triggered: false, checks: [] };
}
