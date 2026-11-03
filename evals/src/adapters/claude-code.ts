import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { extractClaudeFlow } from "../flow/claude-flow.js";
import type {
  AgentAdapter,
  AgentRunInput,
  AgentRunResult,
  StopReason,
} from "../types.js";
import { createWorkdirGuard } from "./claude-guard.js";

/**
 * Runs Claude Code through the Agent SDK, isolated to the workdir's project settings and skills.
 * Stateless between runs, so the process shares one instance: use ClaudeCodeAdapter.getInstance().
 */
export class ClaudeCodeAdapter implements AgentAdapter {
  private static instance: ClaudeCodeAdapter | undefined;
  private static readonly DEFAULT_MODEL = "claude-sonnet-5-5";

  public readonly tool = "claude-code";
  public readonly skillInstallPath = ".claude/skills/io-intelligence";

  private constructor() {}

  public static getInstance(): ClaudeCodeAdapter {
    return (ClaudeCodeAdapter.instance ??= new ClaudeCodeAdapter());
  }

  public checkReady(): string | undefined {
    return process.env.ANTHROPIC_API_KEY
      ? undefined
      : "ANTHROPIC_API_KEY is not set (add it to evals/.env)";
  }

  public async run(input: AgentRunInput): Promise<AgentRunResult> {
    const abort = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, input.timeoutMs);
    const guard = createWorkdirGuard(input.workdir, { network: input.network });

    const messages: SDKMessage[] = [];
    let finalMessage = "";
    let turns = 0;
    let costUsd: number | null = null;
    let stopReason: StopReason = "done";
    let error: string | undefined;

    try {
      const stream = query({
        prompt: input.prompt,
        options: {
          cwd: input.workdir,
          model: input.model ?? ClaudeCodeAdapter.DEFAULT_MODEL,
          maxTurns: input.maxTurns,
          // Only the workdir's own settings and skills: nothing from the user's machine leaks in.
          settingSources: ["project"],
          skills: "all",
          mcpServers: {},
          strictMcpConfig: true,
          permissionMode: "default",
          disallowedTools: input.network ? [] : ["WebFetch", "WebSearch"],
          canUseTool: async (toolName, toolInput) => guard(toolName, toolInput),
          abortController: abort,
          env: {
            ...process.env,
            CLAUDE_AGENT_SDK_CLIENT_APP: "io-intelligence-evals/0.1.0",
          },
        },
      });
      for await (const message of stream) {
        messages.push(message);
        if (message.type === "result") {
          turns = message.num_turns;
          costUsd = message.total_cost_usd;
          if (message.subtype === "success") finalMessage = message.result;
          else
            stopReason =
              message.subtype === "error_max_turns" ? "max-turns" : "error";
        }
      }
    } catch (err) {
      if (!timedOut) {
        stopReason = "error";
        error = (err as Error).message;
      }
    } finally {
      clearTimeout(timer);
    }
    // An abort may end the stream quietly instead of throwing.
    if (timedOut) stopReason = "timeout";

    const flow = extractClaudeFlow(
      messages,
      input.workdir,
      this.skillInstallPath,
    );
    return {
      finalMessage,
      transcript: messages,
      skillTriggered: flow.skillTriggered,
      triggerDetection: "skill-tool",
      flow: flow.steps,
      turns,
      costUsd,
      stopReason,
      ...(error ? { error } : {}),
    };
  }
}
