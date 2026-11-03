// Shared types for the eval engine. The engine talks to the outside world only through
// AgentAdapter, Judge, WorkspaceManager and CommandRunner, which are injected into runEval.

export type FlowStep =
  | {
      readonly kind: "skill-loaded";
      readonly skill: string;
      readonly via: TriggerDetection;
    }
  | { readonly kind: "read"; readonly path: string }
  | { readonly kind: "fetch"; readonly url: string }
  | {
      readonly kind: "script";
      readonly name: string;
      readonly args: readonly string[];
    }
  | {
      readonly kind: "command";
      readonly command: string;
      readonly exitCode: number | null;
    }
  | { readonly kind: "write"; readonly path: string };

export interface FlowSnapshot {
  readonly steps: readonly FlowStep[];
  readonly stopReason: StopReason;
  readonly turns: number;
  readonly costUsd: number | null;
}

export type TriggerDetection = "skill-tool" | "skill-md-read";
export type StopReason = "done" | "max-turns" | "timeout" | "error";

export interface AgentRunInput {
  readonly prompt: string;
  /** Model from the target; undefined means the adapter's default. */
  readonly model: string | undefined;
  readonly workdir: string;
  readonly network: boolean;
  readonly maxTurns: number;
  readonly timeoutMs: number;
}

export interface AgentRunResult {
  readonly finalMessage: string;
  /** Raw tool events, saved for debugging and given to the judge. */
  readonly transcript: readonly unknown[];
  readonly skillTriggered: boolean;
  readonly triggerDetection: TriggerDetection;
  /** Normalized key steps (see flow/normalize.ts). */
  readonly flow: readonly FlowStep[];
  readonly turns: number;
  /** null when the tool reports no cost and no prices are configured. */
  readonly costUsd: number | null;
  readonly stopReason: StopReason;
  readonly error?: string;
}

export interface AgentAdapter {
  /** The tool part of a target id, e.g. "claude-code" in "claude-code/claude-sonnet-5-5". */
  readonly tool: string;
  /** Where the skill folder is installed, relative to the workdir. */
  readonly skillInstallPath: string;
  /** Returns an error message when the adapter cannot run (e.g. a missing API key). */
  checkReady(): string | undefined;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}

export interface JudgeInput {
  readonly rubric: readonly string[];
  readonly finalMessage: string;
  readonly transcript: readonly unknown[];
  /** Workspace diff, for task cases. */
  readonly diff?: string;
}

export interface JudgeLine {
  readonly text: string;
  readonly pass: boolean;
  readonly reason: string;
}

export interface JudgeResult {
  readonly lines: readonly JudgeLine[];
  readonly costUsd: number | null;
}

export interface Judge {
  checkReady(): string | undefined;
  grade(input: JudgeInput): Promise<JudgeResult>;
}

export interface CommandResult {
  readonly exitCode: number | null;
  readonly output: string;
}

export type CommandRunner = (
  command: string,
  cwd: string,
  timeoutMs: number,
) => Promise<CommandResult>;
