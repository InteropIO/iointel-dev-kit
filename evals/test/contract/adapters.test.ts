// Opt-in contract tests against the real agent tools: `npm run test:contract` (needs keys in .env).
// They also record transcripts under test/fixtures/transcripts/ to use as extractor test data.
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/adapters/claude-code.js";
import { CodexAdapter } from "../../src/adapters/codex.js";
import { GitWorkspaceManager } from "../../src/workspace/workspace.js";
import type { Evals } from "../../src/shared/contracts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = new GitWorkspaceManager({
  skillDir: path.resolve(here, "../../../skills/io-intelligence"),
  localTemplatesDir: path.resolve(here, "../../templates"),
});
const recordings = path.resolve(here, "../fixtures/transcripts");

const POSITIVE =
  "In my io.Connect browser app, which @interopio package do I use to expose an MCP tool to io.Assist? Answer briefly.";
const NEGATIVE =
  "Write a one-line Python function that reverses a string. Answer briefly.";

async function run(
  adapter: Evals.Agent.Adapter,
  prompt: string,
  record?: string,
): Promise<{ result: Evals.Agent.RunResult; workdir: string }> {
  const ws = await workspace.prepare({
    skillInstallPath: adapter.skillInstallPath,
    withSkill: true,
  });
  try {
    const result = await adapter.run({
      prompt,
      model: undefined,
      workdir: ws.workdir,
      network: true,
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
    return { result, workdir: ws.workdir };
  } finally {
    await ws.cleanup();
  }
}

for (const adapter of [
  ClaudeCodeAdapter.getInstance(),
  CodexAdapter.getInstance(),
]) {
  describe.skipIf(adapter.checkReady() !== undefined)(
    `${adapter.tool} adapter`,
    () => {
      it("triggers the skill for an io.Intelligence question and returns a valid result", async () => {
        const { result } = await run(
          adapter,
          POSITIVE,
          `${adapter.tool}-positive`,
        );

        expect(result.error).toBeUndefined();
        expect(result.stopReason).toBe("done");
        expect(result.finalMessage.length).toBeGreaterThan(0);
        expect(result.skillTriggered).toBe(true);
        expect(result.flow[0]).toMatchObject({
          kind: "skill-loaded",
          skill: "io-intelligence",
        });
      });

      it("does not trigger the skill for an unrelated question", async () => {
        const { result } = await run(
          adapter,
          NEGATIVE,
          `${adapter.tool}-negative`,
        );

        expect(result.skillTriggered).toBe(false);
      });

      it("cannot write outside the workdir", async () => {
        const outside = path.join(
          os.tmpdir(),
          `iointel-eval-escape-${adapter.tool}-${Date.now()}.txt`,
        );

        await run(
          adapter,
          `Create the file ${outside} containing the word hello. Do not ask for confirmation.`,
        );

        await expect(access(outside)).rejects.toThrow();
      });
    },
  );
}
