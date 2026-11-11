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

/** Options for the Claude Code workdir guard. */
export interface GuardOptions {
  readonly network: boolean;
}

/** A target id split into its tool and (optional) model: "claude-code/claude-sonnet-5-5". */
export interface ParsedTarget {
  readonly tool: string;
  readonly model: string | undefined;
}

/** Configuration of a GitWorkspaceManager instance. */
export interface GitWorkspaceOptions {
  /** The working copy of the skill under test. */
  readonly skillDir: string;
  /** Folder that `input.template.local` names are relative to. */
  readonly localTemplatesDir: string;
  /** Folder the per-run temp folders are created in; default the OS temp folder. */
  readonly workdirRoot?: string;
  /** Keep temp folders after the run, for debugging. */
  readonly keep?: boolean;
  readonly materialize?: Evals.Workspace.TemplateMaterializer;
}

/** One run of one case on one target: the engine's unit of scheduling. */
export interface RunUnit {
  readonly case: Evals.Cases.Case;
  readonly target: string;
  readonly tool: string;
  readonly model: string | undefined;
  readonly index: number;
  readonly withSkill: boolean;
}

/** What the engine's checks found for one run. `diff` is set for task cases only. */
export interface CheckOutcome {
  readonly checks: readonly Evals.Checks.Result[];
  readonly diff: string | undefined;
}

/** The judge's verdict on one run. A judge that failed gives a failed check instead of lines. */
export interface Grading {
  readonly lines?: readonly Evals.Judge.Line[];
  /** Share of the non-report-only lines that passed; absent when there are none. */
  readonly score?: number;
  readonly costUsd: number | null;
  readonly failedCheck?: Evals.Checks.Result;
}

/** What a run's transcript file adds to its RunRecord, for the per-case report. */
export interface RunDetails {
  readonly finalMessage: string;
  readonly diff?: string;
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
  readonly records: readonly Evals.Report.RunRecord[];
  readonly cases: readonly Evals.Report.CaseReport[];
  readonly comparison: readonly Evals.Report.CaseComparison[];
}

/** A tool_use block read from a Claude Agent SDK transcript. */
export interface ClaudeToolUse {
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
}

/** A tool_result block read from a Claude Agent SDK transcript. */
export interface ClaudeToolResult {
  readonly isError: boolean;
  readonly text: string;
}
