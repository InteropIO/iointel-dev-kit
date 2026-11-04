// The deterministic checks of a run, in order. Each stage only runs while everything before it passed:
// agent finished → skill triggered → mustInclude / mustNotInclude.
import { checkAnswerText } from "../checks/checks.js";
import type { Evals } from "../shared/contracts.js";

export function runChecks(
  c: Evals.Cases.Case,
  agent: Evals.Agent.RunResult,
): Evals.Checks.Result[] {
  const stages = [
    () => agentFinished(agent),
    () => [{ name: "skill triggered", pass: agent.skillTriggered }],
    () => checkAnswerText(c, agent.finalMessage),
  ];
  const checks: Evals.Checks.Result[] = [];
  for (const stage of stages) {
    checks.push(...stage());
    if (!checks.every((x) => x.pass)) break;
  }
  return checks;
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
