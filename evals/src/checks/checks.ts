import { compileMatcher } from "./matcher.js";
import type { Evals } from "../shared/contracts.js";

/** mustInclude / mustNotInclude, checked against the agent's final message. */
export function checkAnswerText(
  c: Evals.Cases.Case,
  finalMessage: string,
): Evals.Checks.Result[] {
  return [
    ...c.mustInclude.map((m) => {
      const pass = compileMatcher(m)(finalMessage);
      return {
        name: `mustInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "not found in the final message" }),
      };
    }),
    ...c.mustNotInclude.map((m) => {
      const pass = !compileMatcher(m)(finalMessage);
      return {
        name: `mustNotInclude ${m}`,
        pass,
        ...(pass ? {} : { detail: "found in the final message" }),
      };
    }),
  ];
}
