import os from "node:os";
import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { claudeAuthProblem, claudeEnv } from "../adapters/claude-auth.js";
import type { Evals } from "../shared/contracts.js";

/**
 * Grades rubric lines with a fixed Opus 5.5 model, so scores stay comparable across runs and targets.
 * Runs through Claude Code (the Agent SDK) with no tools, so it uses the same credentials as the
 * Claude Code adapter: an API key when set, otherwise the local Claude Code login.
 * Stateless, so the process shares one instance: use AnthropicJudge.getInstance().
 */
export class AnthropicJudge implements Evals.Judge.Grader {
  private static instance: AnthropicJudge | undefined;
  private static readonly MODEL = "claude-opus-5-5";
  // Structured output is returned through a tool call, which can take a retry.
  private static readonly MAX_TURNS = 3;
  // Keeps a pathological transcript from exceeding the context window; the judge is told when it happens.
  private static readonly MAX_TRANSCRIPT_CHARS = 1_500_000;
  private static readonly VERDICT_SCHEMA = z.object({
    lines: z.array(
      z.object({
        index: z.number().int(),
        pass: z.boolean(),
        reason: z.string(),
      }),
    ),
  });
  // The CLI validates --json-schema with a validator that doesn't know zod's default draft 2020-12
  // meta-schema, so emit draft-07 and leave out the "$schema" reference.
  private static readonly VERDICT_JSON_SCHEMA = AnthropicJudge.toCliSchema(
    AnthropicJudge.VERDICT_SCHEMA,
  );
  private static readonly SYSTEM = `You grade the output of an AI coding agent against a rubric.
Grade each rubric line independently as pass or fail, using the agent's final message, the workspace diff when given, and the transcript as evidence of what it actually did.
A line passes only if the evidence clearly satisfies it. Do not give credit for intent, for claims the transcript or diff contradicts, or for things the rubric does not ask for.
Give a one-line reason for every verdict, citing the evidence.`;

  private constructor() {}

  public static getInstance(): AnthropicJudge {
    return (AnthropicJudge.instance ??= new AnthropicJudge());
  }

  public checkReady(): string | undefined {
    const problem = claudeAuthProblem();
    return problem && `${problem} (the judge uses Claude Opus 5.5)`;
  }

  public async grade(input: Evals.Judge.Input): Promise<Evals.Judge.Result> {
    const stream = query({
      prompt: AnthropicJudge.buildPrompt(input),
      options: {
        model: AnthropicJudge.MODEL,
        effort: "medium",
        systemPrompt: AnthropicJudge.SYSTEM,
        outputFormat: {
          type: "json_schema",
          schema: AnthropicJudge.VERDICT_JSON_SCHEMA,
        },
        maxTurns: AnthropicJudge.MAX_TURNS,
        // A pure grading call: no tools, settings, MCP servers or saved session.
        tools: [],
        settingSources: [],
        mcpServers: {},
        strictMcpConfig: true,
        persistSession: false,
        cwd: os.tmpdir(),
        env: claudeEnv(),
      },
    });
    let result: SDKResultMessage | undefined;
    for await (const message of stream)
      if (message.type === "result") result = message;

    if (!result) throw new Error("judge ended without a result");
    if (result.subtype !== "success" || result.is_error)
      throw new Error(
        `judge failed (${result.subtype}, stop_reason: ${result.stop_reason})`,
      );
    if (result.stop_reason === "refusal")
      throw new Error("judge refused to grade this output");
    const parsed = AnthropicJudge.VERDICT_SCHEMA.safeParse(
      result.structured_output,
    );
    if (!parsed.success)
      throw new Error(
        `judge returned no parseable verdict (stop_reason: ${result.stop_reason})`,
      );

    const byIndex = new Map(parsed.data.lines.map((l) => [l.index, l]));
    const lines: Evals.Judge.Line[] = input.rubric.map((text, i) => {
      const v = byIndex.get(i);
      return v
        ? { text, pass: v.pass, reason: v.reason }
        : {
            text,
            pass: false,
            reason: "judge returned no verdict for this line",
          };
    });
    return { lines, costUsd: result.total_cost_usd };
  }

  private static toCliSchema(schema: z.ZodType): Record<string, unknown> {
    const { $schema: _metaSchema, ...rest } = z.toJSONSchema(schema, {
      target: "draft-7",
    });
    return rest;
  }

  private static buildPrompt(input: Evals.Judge.Input): string {
    let transcript = JSON.stringify(input.transcript);
    const truncated = transcript.length > AnthropicJudge.MAX_TRANSCRIPT_CHARS;
    if (truncated)
      transcript = transcript.slice(0, AnthropicJudge.MAX_TRANSCRIPT_CHARS);
    return [
      `<rubric>\n${input.rubric.map((line, i) => `${i}. ${line}`).join("\n")}\n</rubric>`,
      `<final_message>\n${input.finalMessage || "(empty)"}\n</final_message>`,
      ...(input.diff !== undefined
        ? [
            `<workspace_diff>\n${input.diff || "(no changes)"}\n</workspace_diff>`,
          ]
        : []),
      `<transcript${truncated ? ' truncated="true"' : ""}>\n${transcript}\n</transcript>`,
      `Return one verdict per rubric line, using the line numbers above as "index".`,
    ].join("\n\n");
  }
}
