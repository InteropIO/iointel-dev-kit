import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Judge, JudgeInput, JudgeLine, JudgeResult } from "../types.js";

/**
 * Grades rubric lines with a fixed Opus 5.5 model, so scores stay comparable across runs and targets.
 * Holds one API client for the process: use AnthropicJudge.getInstance().
 */
export class AnthropicJudge implements Judge {
  private static instance: AnthropicJudge | undefined;
  private static readonly MODEL = "claude-opus-5-5";
  // USD per million tokens for claude-opus-5-5.
  private static readonly PRICE = {
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
  } as const;
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
  private static readonly SYSTEM = `You grade the output of an AI coding agent against a rubric.
Grade each rubric line independently as pass or fail, using the agent's final message, the workspace diff when given, and the transcript as evidence of what it actually did.
A line passes only if the evidence clearly satisfies it. Do not give credit for intent, for claims the transcript or diff contradicts, or for things the rubric does not ask for.
Give a one-line reason for every verdict, citing the evidence.`;

  private client: Anthropic | undefined;

  private constructor() {}

  public static getInstance(): AnthropicJudge {
    return (AnthropicJudge.instance ??= new AnthropicJudge());
  }

  public checkReady(): string | undefined {
    return process.env.ANTHROPIC_API_KEY
      ? undefined
      : "ANTHROPIC_API_KEY is not set (the judge uses Claude Opus 5.5)";
  }

  public async grade(input: JudgeInput): Promise<JudgeResult> {
    // Created on first use, after the CLI has loaded .env.
    this.client ??= new Anthropic();
    const response = await this.client.messages.parse({
      model: AnthropicJudge.MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(AnthropicJudge.VERDICT_SCHEMA),
      },
      system: AnthropicJudge.SYSTEM,
      messages: [{ role: "user", content: AnthropicJudge.buildPrompt(input) }],
    });

    if (response.stop_reason === "refusal")
      throw new Error("judge refused to grade this output");
    const verdict = response.parsed_output;
    if (!verdict)
      throw new Error(
        `judge returned no parseable verdict (stop_reason: ${response.stop_reason})`,
      );

    const byIndex = new Map(verdict.lines.map((l) => [l.index, l]));
    const lines: JudgeLine[] = input.rubric.map((text, i) => {
      const v = byIndex.get(i);
      return v
        ? { text, pass: v.pass, reason: v.reason }
        : {
            text,
            pass: false,
            reason: "judge returned no verdict for this line",
          };
    });
    return { lines, costUsd: AnthropicJudge.cost(response.usage) };
  }

  private static buildPrompt(input: JudgeInput): string {
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

  private static cost(usage: Anthropic.Usage): number {
    const p = AnthropicJudge.PRICE;
    return (
      (usage.input_tokens * p.input +
        usage.output_tokens * p.output +
        (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
        (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
      1_000_000
    );
  }
}
