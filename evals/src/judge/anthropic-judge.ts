import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Judge, JudgeInput, JudgeResult } from '../types.js';

export const JUDGE_MODEL = 'claude-opus-5-5';
// USD per million tokens for claude-opus-5-5.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
// Keeps a pathological transcript from exceeding the context window; the judge is told when it happens.
const MAX_TRANSCRIPT_CHARS = 1_500_000;

const verdictSchema = z.object({
  lines: z.array(z.object({ index: z.number().int(), pass: z.boolean(), reason: z.string() })),
});

const SYSTEM = `You grade the output of an AI coding agent against a rubric.
Grade each rubric line independently as pass or fail, using the agent's final message, the workspace diff when given, and the transcript as evidence of what it actually did.
A line passes only if the evidence clearly satisfies it. Do not give credit for intent, for claims the transcript or diff contradicts, or for things the rubric does not ask for.
Give a one-line reason for every verdict, citing the evidence.`;

/** Grades rubric lines with a fixed Opus 5.5 model, so scores stay comparable across runs and targets. */
export class AnthropicJudge implements Judge {
  private client: Anthropic | undefined;

  checkReady() {
    return process.env.ANTHROPIC_API_KEY ? undefined : 'ANTHROPIC_API_KEY is not set (the judge uses Claude Opus 5.5)';
  }

  async grade(input: JudgeInput): Promise<JudgeResult> {
    this.client ??= new Anthropic();
    let transcript = JSON.stringify(input.transcript);
    const truncated = transcript.length > MAX_TRANSCRIPT_CHARS;
    if (truncated) transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS);

    const sections = [
      `<rubric>\n${input.rubric.map((line, i) => `${i}. ${line}`).join('\n')}\n</rubric>`,
      `<final_message>\n${input.finalMessage || '(empty)'}\n</final_message>`,
      ...(input.diff !== undefined ? [`<workspace_diff>\n${input.diff || '(no changes)'}\n</workspace_diff>`] : []),
      `<transcript${truncated ? ' truncated="true"' : ''}>\n${transcript}\n</transcript>`,
      `Return one verdict per rubric line, using the line numbers above as "index".`,
    ];

    const response = await this.client.messages.parse({
      model: JUDGE_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: zodOutputFormat(verdictSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: sections.join('\n\n') }],
    });

    if (response.stop_reason === 'refusal') throw new Error('judge refused to grade this output');
    const verdict = response.parsed_output;
    if (!verdict) throw new Error(`judge returned no parseable verdict (stop_reason: ${response.stop_reason})`);

    const byIndex = new Map(verdict.lines.map((l) => [l.index, l]));
    const u = response.usage;
    return {
      lines: input.rubric.map((text, i) => {
        const v = byIndex.get(i);
        return v ? { text, pass: v.pass, reason: v.reason } : { text, pass: false, reason: 'judge returned no verdict for this line' };
      }),
      costUsd:
        (u.input_tokens * PRICE.input +
          u.output_tokens * PRICE.output +
          (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
          (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
        1_000_000,
    };
  }
}
