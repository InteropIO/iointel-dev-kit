// Public entry point of the engine: the runEval seam, its options and dependencies, and the report shape.
export {
  EvalSetupError,
  runEval,
  type RunEvalDeps,
  type RunEvalOptions,
} from "./run-eval.js";
export type {
  CaseComparison,
  CaseReport,
  ComparisonStatus,
  RunRecord,
  RunReport,
} from "./report-types.js";
