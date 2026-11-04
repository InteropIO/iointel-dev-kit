// Engine defaults.

export const DEFAULT_CONCURRENCY = 4;

/** Limits for every agent run. */
export const AGENT_LIMITS = { maxTurns: 15, timeoutMs: 3 * 60_000 } as const;
