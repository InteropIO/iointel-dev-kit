/** The suite cannot start: bad options, a missing adapter, or a tool or judge that is not ready. */
export class EvalSetupError extends Error {
  public override readonly name = "EvalSetupError";

  public constructor(message: string) {
    super(message);
  }
}
