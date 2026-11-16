// Opt-in contract test for the real judge: `npm run test:contract` (needs Claude credentials: a key in .env or a local Claude Code login).
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

  it("with a workdir, verifies lines about unchanged code by reading the workspace", async () => {
    // The diff is empty, so only the files can settle these lines.
    const workdir = await mkdtemp(path.join(os.tmpdir(), "judge-ws-"));
    try {
      await mkdir(path.join(workdir, "mcp-server"), { recursive: true });
      await writeFile(
        path.join(workdir, "mcp-server", "submit-payment.ts"),
        [
          "export function submitPayment(input: { amount: number }) {",
          '  if (!(input.amount > 0)) throw new Error("amount must be positive");',
          "  return { ok: true };",
          "}",
          "",
        ].join("\n"),
      );

      const result = await judge.grade({
        rubric: [
          "submit_payment in mcp-server still rejects payments whose amount is not positive",
          "mcp-server contains a file named refunds.ts",
        ],
        finalMessage: "Done; I left the payment server alone.",
        transcript: [],
        diff: "",
        workdir,
      });

      expect(result.lines.map((l) => l.pass)).toEqual([true, false]);
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  });
});
