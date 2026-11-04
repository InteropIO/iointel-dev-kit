// Engine defaults. A case's own setting (repeat, maxTurns, timeoutMs, passThreshold) always wins.

export const DEFAULT_REPEAT = 3;
export const DEFAULT_CONCURRENCY = 4;

/** Trigger cases pass when at least 2 of 3 runs behave as expected; other kinds need every run. */
export const TRIGGER_THRESHOLD = 2 / 3;

export const AGENT_LIMITS = {
  task: { maxTurns: 40, timeoutMs: 10 * 60_000 },
  other: { maxTurns: 15, timeoutMs: 3 * 60_000 },
} as const;

/** Timeout for each of a task case's commands (install, build, test). */
export const COMMAND_TIMEOUT_MS = 10 * 60_000;
