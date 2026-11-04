// The deterministic checks of a run, in the order they run. A task case only goes on to the
// slower checks (structure, then commands) while everything before them has passed.
import {
  checkAnswerText,
  checkFlow,
  checkTaskStructure,
  runTaskCommands,
} from "../checks/checks.js";
import type { Evals } from "../shared/contracts.js";
import type { CheckOutcome, RunUnit } from "../shared/types.js";
import { COMMAND_TIMEOUT_MS } from "./defaults.js";

export async function runChecks(
  unit: RunUnit,
  agent: Evals.Agent.RunResult,
  workspace: Evals.Workspace.Prepared,
  runCommand: Evals.Commands.Runner,
): Promise<CheckOutcome> {
  const c = unit.case;
  const checks: Evals.Checks.Result[] = [
    ...agentFinished(agent),
    ...skillTriggered(unit, agent),
    ...(c.kind === "answer" ? checkAnswerText(c, agent.finalMessage) : []),
    ...checkFlow(c, agent.flow),
  ];
  if (c.kind !== "task") return { checks, diff: undefined };

  const allPass = () => checks.every((x) => x.pass);
  if (allPass())
    checks.push(...(await checkTaskStructure(c, workspace.workdir)));
  if (allPass())
    checks.push(
      ...(await runTaskCommands(
        c,
        workspace.workdir,
        runCommand,
        COMMAND_TIMEOUT_MS,
      )),
    );
  return { checks, diff: await workspace.diff() };
}

/** A run that errored, hit its turn limit or timed out fails, whatever it produced before stopping. */
function agentFinished(agent: Evals.Agent.RunResult): Evals.Checks.Result[] {
  if (!agent.error && agent.stopReason === "done") return [];
  return [
    {
      name: "agent finished",
      pass: false,
      detail: agent.error ?? `stopped: ${agent.stopReason}`,
    },
  ];
}

/**
 * Answer and task cases that expect the skill check it here. Trigger cases are scored on the
 * trigger itself instead (see records.ts), and skill-removed runs can't trigger it at all.
 */
function skillTriggered(
  unit: RunUnit,
  agent: Evals.Agent.RunResult,
): Evals.Checks.Result[] {
  const c = unit.case;
  if (c.kind === "trigger" || !unit.withSkill || !c.expectSkill) return [];
  return [{ name: "skill triggered", pass: agent.skillTriggered }];
}
