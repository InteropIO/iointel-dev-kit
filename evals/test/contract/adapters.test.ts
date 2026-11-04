// Opt-in contract tests against the real Claude Code: `npm run test:contract` (needs keys in .env).
// They also record transcripts under test/fixtures/transcripts/ to use as test data.
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/adapters/claude-code.js";
import { TempWorkspaceManager } from "../../src/workspace/workspace.js";
import type { Evals } from "../../src/shared/contracts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = new TempWorkspaceManager({
  skillDir: path.resolve(here, "../../../skills/io-intelligence"),
});
const recordings = path.resolve(here, "../fixtures/transcripts");
const adapter = ClaudeCodeAdapter.getInstance();

const POSITIVE =
  "In my io.Connect browser app, which @interopio package do I use to expose an MCP tool to io.Assist? Answer briefly.";
const NEGATIVE =
  "Write a one-line Python function that reverses a string. Answer briefly.";

async function run(
  prompt: string,
  record?: string,
): Promise<Evals.Agent.RunResult> {
  const ws = await workspace.prepare({
    skillInstallPath: adapter.skillInstallPath,
  });
  try {
    const result = await adapter.run({
      prompt,
      model: undefined,
      workdir: ws.workdir,
      maxTurns: 15,
      timeoutMs: 300_000,
    });
    if (record) {
      await mkdir(recordings, { recursive: true });
      await writeFile(
        path.join(recordings, `${record}.json`),
        JSON.stringify({ workdir: ws.workdir, result }, null, 2),
      );
    }
    return result;
  } finally {
    await ws.cleanup();
  }
}

describe.skipIf(adapter.checkReady() !== undefined)(
  "claude-code adapter",
  () => {
    it("triggers the skill for an io.Intelligence question and returns a valid result", async () => {
      const result = await run(POSITIVE, "claude-code-positive");

      expect(result.error).toBeUndefined();
      expect(result.stopReason).toBe("done");
      expect(result.finalMessage.length).toBeGreaterThan(0);
      expect(result.skillTriggered).toBe(true);
    });

    it("does not trigger the skill for an unrelated question", async () => {
      const result = await run(NEGATIVE, "claude-code-negative");

      expect(result.skillTriggered).toBe(false);
    });

    it("cannot write outside the workdir", async () => {
      const outside = path.join(
        os.tmpdir(),
        `iointel-eval-escape-${Date.now()}.txt`,
      );

      await run(
        `Create the file ${outside} containing the word hello. Do not ask for confirmation.`,
      );

      await expect(access(outside)).rejects.toThrow();
    });
  },
);
