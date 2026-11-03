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
  /** Folder that `setup.fixture` paths are relative to. */
  readonly fixturesDir: string;
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
