import { describe, expect, it } from "vitest";
import {
  compactTranscript,
  DEFAULT_COMPACT_OPTIONS,
  shorten,
} from "../src/judge/compact-transcript.js";

// Shapes as the Claude Agent SDK emits them, including the duplicate and bookkeeping fields.
const claudeTranscript = (resultText: string) => [
  { type: "system", subtype: "init", session_id: "s", tools: ["Read"] },
  { type: "rate_limit_event", rate_limit_info: { status: "ok" } },
  {
    type: "assistant",
    uuid: "u1",
    session_id: "s",
    message: {
      id: "m1",
      usage: { input_tokens: 10 },
      content: [
        { type: "thinking", thinking: "I should read the config." },
        {
          type: "tool_use",
          id: "toolu_1",
          name: "Read",
          input: { file_path: "app/src/App.tsx" },
        },
      ],
    },
    wire_tool_inputs: { file_path: "app/src/App.tsx" },
  },
  {
    type: "user",
    uuid: "u2",
    message: {
      content: [
        { type: "tool_result", tool_use_id: "toolu_1", content: resultText },
      ],
    },
    tool_use_result: { file: { content: resultText } },
  },
  {
    type: "user",
    isSynthetic: true,
    message: { content: [{ type: "text", text: "Skill body injected" }] },
  },
  {
    type: "assistant",
    message: { content: [{ type: "text", text: "Code Mode is enabled." }] },
  },
  { type: "result", subtype: "success", result: "Code Mode is enabled." },
];

describe("compactTranscript", () => {
  it("keeps the evidence in order and drops duplicates and bookkeeping", () => {
    const { text, stats } = compactTranscript(claudeTranscript("FILE BODY"));

    expect(text).toBe(
      [
        "[#1] thinking\nI should read the config.",
        '[#2] tool call Read (toolu_1)\n{"file_path":"app/src/App.tsx"}',
        "[#3] tool result (toolu_1)\nFILE BODY",
        "[#4] user (injected)\nSkill body injected",
        "[#5] assistant\nCode Mode is enabled.",
      ].join("\n\n"),
    );
    // The duplicate copy of the result (tool_use_result) is gone: the body appears once.
    expect(text.match(/FILE BODY/g)).toHaveLength(1);
    expect(stats).toMatchObject({
      entries: 5,
      entriesShortened: 0,
      entriesTrimmed: 0,
      trimmed: false,
    });
    expect(stats.sentChars).toBeLessThan(stats.rawChars);
  });

  it("marks tool results that failed", () => {
    const { text } = compactTranscript([
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_9",
              is_error: true,
              content: [{ type: "text", text: "exit 1" }],
            },
          ],
        },
      },
    ]);
    expect(text).toBe("[#1] tool result (toolu_9, error)\nexit 1");
  });

  it("caps one huge tool result to its start and end without touching the agent's own text", () => {
    const big = "A".repeat(5_000) + "B".repeat(10_000) + "C".repeat(3_000);
    const { text, stats } = compactTranscript(claudeTranscript(big));

    const result = text.split("\n\n").find((e) => e.includes("tool result"))!;
    expect(result).toContain("A".repeat(4_000));
    expect(result).toContain("C".repeat(2_000));
    expect(result).toContain("[… 12,000 chars cut …]");
    expect(result).not.toContain("B");
    expect(text).toContain("Code Mode is enabled.");
    expect(stats).toMatchObject({ entriesShortened: 1, trimmed: false });
  });

  it("over budget, trims the oldest results first and keeps the end of the run intact", () => {
    const result = (id: string, body: string) => ({
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: id, content: body }],
      },
    });
    const events = [
      result("old", "o".repeat(3_000)),
      result("mid", "m".repeat(3_000)),
      result("new", "n".repeat(3_000)),
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Done." }] },
      },
    ];

    const { text, stats } = compactTranscript(events, {
      ...DEFAULT_COMPACT_OPTIONS,
      budget: 6_500,
      minHead: 100,
      minTail: 50,
    });

    expect(text).toContain(
      "[#1] tool result (old)\n" + "o".repeat(100) + "\n[…",
    );
    expect(text).toContain("n".repeat(3_000)); // newest result untouched
    expect(text.endsWith("[#4] assistant\nDone.")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(6_500);
    expect(stats).toMatchObject({ trimmed: true });
    expect(stats.entriesTrimmed).toBeGreaterThanOrEqual(1);
  });

  it("reads Codex events: commands with their output and exit code, messages, file changes", () => {
    const { text } = compactTranscript([
      { type: "thread.started", thread_id: "t" },
      {
        type: "item.completed",
        item: {
          id: "i1",
          type: "command_execution",
          command: "npm run build",
          aggregated_output: "built",
          exit_code: 0,
        },
      },
      {
        type: "item.completed",
        item: {
          id: "i2",
          type: "file_change",
          changes: [{ path: "src/a.ts", kind: "add" }],
        },
      },
      {
        type: "item.completed",
        item: { id: "i3", type: "agent_message", text: "All done." },
      },
      { type: "turn.completed", usage: { input_tokens: 1 } },
    ]);

    expect(text).toBe(
      [
        "[#1] tool call shell\nnpm run build",
        "[#2] tool result (shell, exit 0)\nbuilt",
        '[#3] tool call file_change\n[{"path":"src/a.ts","kind":"add"}]',
        "[#4] assistant\nAll done.",
      ].join("\n\n"),
    );
  });

  it("keeps events it doesn't recognise, without their noise fields", () => {
    const { text } = compactTranscript([
      { type: "custom", uuid: "x", timestamp: "t", detail: "kept" },
    ]);
    expect(text).toBe('[#1] event custom\n{"type":"custom","detail":"kept"}');
  });
});

describe("shorten", () => {
  it("leaves text that fits alone", () => {
    expect(shorten("short", 10, 10)).toBe("short");
  });

  it("keeps the head and tail and says how much was cut", () => {
    expect(shorten("x".repeat(100) + "y".repeat(100), 10, 5)).toBe(
      "x".repeat(10) + "\n[… 185 chars cut …]\n" + "y".repeat(5),
    );
  });
});
