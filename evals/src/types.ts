// Shared types for the eval engine. The engine talks to the outside world only through
// AgentAdapter, Judge, WorkspaceManager and CommandRunner, which are injected into runEval.

export type FlowStep =
  | { kind: 'skill-loaded'; skill: string; via: TriggerDetection }
  | { kind: 'read'; path: string }
  | { kind: 'fetch'; url: string }
  | { kind: 'script'; name: string; args: string[] }
  | { kind: 'command'; command: string; exitCode: number | null }
  | { kind: 'write'; path: string };

export interface FlowSnapshot {
  steps: FlowStep[];
  stopReason: StopReason;
  turns: number;
  costUsd: number | null;
}

export type TriggerDetection = 'skill-tool' | 'skill-md-read';
export type StopReason = 'done' | 'max-turns' | 'timeout' | 'error';

export interface AgentRunInput {
  prompt: string;
  /** Model from the target; undefined means the adapter's default. */
  model: string | undefined;
  workdir: string;
  network: boolean;
  maxTurns: number;
  timeoutMs: number;
}

export interface AgentRunResult {
  finalMessage: string;
  /** Raw tool events, saved for debugging and given to the judge. */
  transcript: unknown[];
  skillTriggered: boolean;
  triggerDetection: TriggerDetection;
  /** Normalized key steps (see flow/normalize.ts). */
  flow: FlowStep[];
  turns: number;
  /** null when the tool reports no cost and no prices are configured. */
  costUsd: number | null;
  stopReason: StopReason;
  error?: string;
}

export interface AgentAdapter {
  /** The tool part of a target id, e.g. "claude-code" in "claude-code/claude-sonnet-5-5". */
  tool: string;
  /** Where the skill folder is installed, relative to the workdir. */
  skillInstallPath: string;
  /** Returns an error message when the adapter cannot run (e.g. a missing API key). */
  checkReady(): string | undefined;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}

export interface JudgeInput {
  rubric: string[];
  finalMessage: string;
  transcript: unknown[];
  /** Workspace diff, for task cases. */
  diff?: string;
}

export interface JudgeLine {
  text: string;
  pass: boolean;
  reason: string;
}

export interface JudgeResult {
  lines: JudgeLine[];
  costUsd: number | null;
}

export interface Judge {
  checkReady(): string | undefined;
  grade(input: JudgeInput): Promise<JudgeResult>;
}

export interface CommandResult {
  exitCode: number | null;
  output: string;
}

export type CommandRunner = (command: string, cwd: string, timeoutMs: number) => Promise<CommandResult>;
