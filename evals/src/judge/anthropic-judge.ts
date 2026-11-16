import os from "node:os";
import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { claudeAuthProblem, claudeEnv } from "../adapters/claude-auth.js";
import { createWorkdirGuard } from "../adapters/claude-guard.js";
import { compactTranscript } from "./compact-transcript.js";
import { JudgeError } from "./judge-error.js";
import type { Evals } from "../shared/contracts.js";

/**
 * Grades rubric lines with a fixed Opus 5.5 model, so scores stay comparable across runs and targets.
 * Runs through Claude Code (the Agent SDK), so it uses the same credentials as the Claude Code
 * adapter: an API key when set, otherwise the local Claude Code login. By default it has no tools.
 * When the input has a workdir (the case set judge.workspaceAccess), it gets read-only file tools
 * scoped to that folder, to verify lines the diff alone can't show.
 * Stateless, so the process shares one instance: use AnthropicJudge.getInstance().
 */
export class AnthropicJudge implements Evals.Judge.Grader {
  private static instance: AnthropicJudge | undefined;
  private static readonly MODEL = "claude-opus-5-5";
  // Structured output is returned through a tool call, which can take a retry.
  private static readonly MAX_TURNS = 3;
  // With workspace access, each file lookup is a turn of its own.
  private static readonly MAX_TURNS_WITH_WORKSPACE = 20;
  // Read-only: the judge may look, never run or change anything.
  private static readonly WORKSPACE_TOOLS = ["Read", "Grep", "Glob"];
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
Give a one-line reason for every verdict, citing the evidence.
The transcript is a compacted log of numbered entries (#n) in the order they happened: the agent's messages and thinking, its tool calls, and their results. Long entries are shortened to their start and end with a "[… N chars cut …]" marker; don't assume what a cut part contained.`;
  private static readonly WORKSPACE_NOTE = `
You can also read the agent's finished workspace (your working directory) with Read, Grep and Glob.
The diff is what the agent changed; the workspace is the whole project after the run, including code it left alone and installed packages.
Use the files only to verify a rubric line the diff, final message and transcript can't settle, such as code that must still exist, something that must appear exactly once, or what an installed package's types declare.
Look up what you need and stop; don't review the project beyond the rubric.`;

  private constructor() {}

  public static getInstance(): AnthropicJudge {
    return (AnthropicJudge.instance ??= new AnthropicJudge());
  }

  public checkReady(): string | undefined {
    const problem = claudeAuthProblem();
    return problem && `${problem} (the judge uses Claude Opus 5.5)`;
  }

  public async grade(input: Evals.Judge.Input): Promise<Evals.Judge.Result> {
    const request = AnthropicJudge.buildRequest(input);
    try {
      const { lines, costUsd } = await this.send(input, request);
      return { lines, costUsd, request };
    } catch (err) {
      throw new JudgeError((err as Error).message, request);
    }
  }

  /** Exactly what the judge is sent for this input: saved as the run's judge-input file. */
  public static buildRequest(input: Evals.Judge.Input): Evals.Judge.Request {
    const workdir = input.workdir;
    const transcript = compactTranscript(input.transcript);
    const s = transcript.stats;
    const attrs = [
      `entries="${s.entries}"`,
      ...(s.entriesShortened ? [`shortened="${s.entriesShortened}"`] : []),
      ...(s.trimmed ? ['trimmed="true"'] : []),
    ].join(" ");
    const prompt = [
      `<rubric>\n${input.rubric.map((line, i) => `${i}. ${line}`).join("\n")}\n</rubric>`,
      `<final_message>\n${input.finalMessage || "(empty)"}\n</final_message>`,
      ...(input.diff !== undefined
        ? [
            `<workspace_diff>\n${input.diff || "(no changes)"}\n</workspace_diff>`,
          ]
        : []),
      `<transcript ${attrs}>\n${transcript.text}\n</transcript>`,
      ...(workdir
        ? [
            "The agent's workspace is your working directory. Read files there only when a line needs it.",
          ]
        : []),
      `Return one verdict per rubric line, using the line numbers above as "index".`,
    ].join("\n\n");
    return {
      model: AnthropicJudge.MODEL,
      system: workdir
        ? AnthropicJudge.SYSTEM + AnthropicJudge.WORKSPACE_NOTE
        : AnthropicJudge.SYSTEM,
      prompt,
      tools: workdir ? AnthropicJudge.WORKSPACE_TOOLS : [],
      ...(workdir ? { workdir } : {}),
      transcript: s,
    };
  }

  private async send(
    input: Evals.Judge.Input,
    request: Evals.Judge.Request,
  ): Promise<Omit<Evals.Judge.Result, "request">> {
    const workdir = input.workdir;
    // Keeps file lookups inside the workspace; tools other than the read-only ones aren't loaded at all.
    const guard = workdir && createWorkdirGuard(workdir, { network: false });
    const stream = query({
      prompt: request.prompt,
      options: {
        model: request.model,
        effort: "medium",
        systemPrompt: request.system,
        outputFormat: {
          type: "json_schema",
          schema: AnthropicJudge.VERDICT_JSON_SCHEMA,
        },
        maxTurns: workdir
          ? AnthropicJudge.MAX_TURNS_WITH_WORKSPACE
          : AnthropicJudge.MAX_TURNS,
        // A pure grading call: no settings, MCP servers or saved session, and no tools beyond
        // read-only file access to the workspace when the case opted in.
        tools: [...request.tools],
        ...(guard
          ? {
              permissionMode: "default" as const,
              canUseTool: async (
                toolName: string,
                toolInput: Record<string, unknown>,
              ) =>
                AnthropicJudge.WORKSPACE_TOOLS.includes(toolName)
                  ? guard(toolName, toolInput)
                  : {
                      behavior: "deny" as const,
                      message: "the judge may only read files",
                    },
            }
          : {}),
        settingSources: [],
        mcpServers: {},
        strictMcpConfig: true,
        persistSession: false,
        cwd: workdir ?? os.tmpdir(),
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
}
