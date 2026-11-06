// Opt-in contract test for the real judge: `npm run test:contract` (needs Claude credentials: a key in .env or a local Claude Code login).
import { describe, expect, it } from "vitest";
import { AnthropicJudge } from "../../src/judge/anthropic-judge.js";

const judge = AnthropicJudge.getInstance();

describe.skipIf(judge.checkReady() !== undefined)("Anthropic judge", () => {
  it("passes a satisfied rubric line and fails an unsatisfied one", async () => {
    const result = await judge.grade({
      rubric: [
        "Recommends the @interopio/mcp-web package",
        "Explains how to configure an Angular router",
      ],
      finalMessage:
        "Install @interopio/mcp-web in your browser app and register the tool at startup; io.Assist discovers it.",
      transcript: [],
    });

    expect(result.lines.map((l) => l.pass)).toEqual([true, false]);
    expect(result.lines.every((l) => l.reason.length > 0)).toBe(true);
    expect(result.costUsd).toBeGreaterThan(0);
  });
});
