import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../src/adapters/claude-code.js";
import { AnthropicJudge } from "../src/judge/anthropic-judge.js";

describe("process-wide services", () => {
  it("each have exactly one instance", () => {
    expect(ClaudeCodeAdapter.getInstance()).toBe(
      ClaudeCodeAdapter.getInstance(),
    );
    expect(AnthropicJudge.getInstance()).toBe(AnthropicJudge.getInstance());
  });
});
