import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Codex, type ThreadEvent, type ThreadItem, type Usage } from '@openai/codex-sdk';
import { extractCodexFlow } from '../flow/codex-flow.js';
import type { AgentAdapter, AgentRunInput, AgentRunResult, StopReason } from '../types.js';

const TOOL_ITEMS = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search']);

/**
 * Runs Codex through its SDK in a workspace-write sandbox limited to the workdir.
 * Codex reports tokens but not cost, and has no turn limit, so maxTurns is not enforced
 * (the timeout still is) and cost comes from CODEX_PRICE_* when set.
 */
export class CodexAdapter implements AgentAdapter {
  readonly tool = 'codex';
  readonly skillInstallPath = '.agents/skills/io-intelligence';

  checkReady() {
    return process.env.OPENAI_API_KEY ? undefined : 'OPENAI_API_KEY is not set (add it to evals/.env)';
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    // Codex reads user-level config and skills from the home folder; give it an empty one so
    // nothing from this machine leaks in. The workdir's parent is the run's own temp root.
    const home = path.join(path.dirname(input.workdir), 'home');
    await mkdir(home, { recursive: true });
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
    Object.assign(env, { CODEX_HOME: path.join(home, '.codex'), HOME: home, USERPROFILE: home });

    const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY!, env });
    const thread = codex.startThread({
      ...(input.model ? { model: input.model } : {}),
      workingDirectory: input.workdir,
      skipGitRepoCheck: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      networkAccessEnabled: input.network,
      webSearchMode: input.network ? 'live' : 'disabled',
    });

    const abort = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, input.timeoutMs);

    const events: ThreadEvent[] = [];
    const items: ThreadItem[] = [];
    let usage: Usage | null = null;
    let finalMessage = '';
    let stopReason: StopReason = 'done';
    let error: string | undefined;

    try {
      const { events: stream } = await thread.runStreamed(input.prompt, { signal: abort.signal });
      for await (const event of stream) {
        events.push(event);
        if (event.type === 'item.completed') {
          items.push(event.item);
          if (event.item.type === 'agent_message') finalMessage = event.item.text;
        } else if (event.type === 'turn.completed') usage = event.usage;
        else if (event.type === 'turn.failed') {
          stopReason = 'error';
          error = event.error.message;
        } else if (event.type === 'error') {
          stopReason = 'error';
          error = event.message;
        }
      }
    } catch (err) {
      if (!timedOut) {
        stopReason = 'error';
        error = (err as Error).message;
      }
    } finally {
      clearTimeout(timer);
    }
    // An abort may end the stream quietly instead of throwing.
    if (timedOut) stopReason = 'timeout';

    const flow = extractCodexFlow(items, input.workdir, this.skillInstallPath);
    return {
      finalMessage,
      transcript: events,
      skillTriggered: flow.skillTriggered,
      triggerDetection: 'skill-md-read',
      flow: flow.steps,
      turns: items.filter((i) => TOOL_ITEMS.has(i.type)).length,
      costUsd: usage ? codexCost(usage) : null,
      stopReason,
      ...(error ? { error } : {}),
    };
  }
}

/** USD from token usage and CODEX_PRICE_* (per million tokens); null when prices are not configured. */
export function codexCost(usage: Usage, env: NodeJS.ProcessEnv = process.env): number | null {
  const price = (name: string) => (env[name] ? Number(env[name]) : undefined);
  const input = price('CODEX_PRICE_INPUT_PER_MTOK');
  const output = price('CODEX_PRICE_OUTPUT_PER_MTOK');
  if (input === undefined || output === undefined || Number.isNaN(input) || Number.isNaN(output)) return null;
  const cached = price('CODEX_PRICE_CACHED_INPUT_PER_MTOK') ?? input;
  const uncachedInput = usage.input_tokens - usage.cached_input_tokens;
  return (uncachedInput * input + usage.cached_input_tokens * cached + usage.output_tokens * output) / 1_000_000;
}
