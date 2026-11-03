import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../src/adapters/claude-code.js";
import { CodexAdapter } from "../src/adapters/codex.js";
import { AnthropicJudge } from "../src/judge/anthropic-judge.js";

describe("process-wide services", () => {
  it("each have exactly one instance", () => {
    expect(ClaudeCodeAdapter.getInstance()).toBe(
      ClaudeCodeAdapter.getInstance(),
    );
    expect(CodexAdapter.getInstance()).toBe(CodexAdapter.getInstance());
    expect(AnthropicJudge.getInstance()).toBe(AnthropicJudge.getInstance());
  });
});
