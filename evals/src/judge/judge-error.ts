import type { Evals } from "../shared/contracts.js";

/**
 * A grading failure that still knows what was sent to the judge, so the run's judge-input
 * file can be saved even when the judge refused, errored or returned nothing usable.
 */
export class JudgeError extends Error {
  public constructor(
    message: string,
    public readonly request: Evals.Judge.Request,
  ) {
    super(message);
    this.name = "JudgeError";
  }
}
