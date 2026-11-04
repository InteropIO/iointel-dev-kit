// Types that are not shared contracts: each is used by one module (or a module and its helper).
// Shared contracts live in the Evals namespace in shared/contracts.d.ts.
import type { Evals } from "./contracts.js";

/** T with readonly removed at every level, to compare a contract with a mutable inferred type. */
export type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

/**
 * true only when A and B are the identical type: no missing or extra keys, optional ones included.
 * Used for compile-time contract checks.
 */
export type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Decision returned by the Claude Code workdir guard for one tool call. */
export type GuardDecision =
  | { readonly behavior: "allow" }
  | { readonly behavior: "deny"; readonly message: string };

/** Configuration of a TempWorkspaceManager instance. */
export interface TempWorkspaceOptions {
  /** The working copy of the skill under test. */
  readonly skillDir: string;
}

/** The judge's verdict on one run. A judge that failed gives a failed check instead of lines. */
export interface Grading {
  readonly lines?: readonly Evals.Judge.Line[];
  readonly costUsd: number | null;
  readonly failedCheck?: Evals.Checks.Result;
}

/** Everything the engine has gathered by the end of a run, for building the RunReport. */
export interface ReportParts {
  readonly runId: string;
  readonly runDir: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly options: Evals.Engine.Options;
  readonly concurrency: number;
  readonly reference: Evals.Baseline.Reference;
  readonly cases: readonly Evals.Report.CaseReport[];
  readonly comparison: readonly Evals.Report.CaseComparison[];
}
