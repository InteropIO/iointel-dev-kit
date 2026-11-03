import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkdirGuard } from "../src/adapters/claude-guard.js";
import { CaseValidationError } from "../src/cases/loader.js";
import { compileMatcher } from "../src/checks/matcher.js";
import { extractCodexFlow, unwrapShell } from "../src/flow/codex-flow.js";
import { approveRun } from "../src/report/baseline.js";
import type { Judge } from "../src/types.js";
import { fakeAdapter, fakeJudge, makeEnv, runEval } from "./helpers.js";

describe("run outcome", () => {
  it("keeps the agent result and cost when the judge fails", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "graded",
      kind: "answer",
      targets: ["fake/m"],
      prompt: "p",
      rubric: "- x",
    });
    const judge: Judge = {
      checkReady: () => undefined,
      grade: async () => Promise.reject(new Error("overloaded")),
    };

    const report = await runEval(
      env.options(),
      env.deps({
        adapters: { fake: fakeAdapter(() => ({ costUsd: 0.3 })) },
        judge,
      }),
    );

    const run = report.cases[0]!.runs[0]!;
    expect(run.pass).toBe(false);
    expect(run.checks.at(-1)).toEqual({
      name: "judge",
      pass: false,
      detail: "judge error: overloaded",
    });
    expect(run.flow).toBeDefined();
    expect(run.transcriptFile).toBeDefined();
    expect(run.costUsd).toBeCloseTo(0.3);
  });

  it("fails runs that hit their turn limit or timed out, without calling the judge", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "limited",
      kind: "answer",
      targets: ["fake/m"],
      prompt: "p",
      rubric: "- x",
    });
    await env.writeCase({
      id: "slow",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "slow",
    });
    const judge = fakeJudge();
    const adapter = fakeAdapter((input) => ({
      stopReason: input.prompt === "slow" ? "timeout" : "max-turns",
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter }, judge }),
    );

    for (const c of report.cases) expect(c.pass).toBe(false);
    expect(
      report.cases.find((c) => c.caseId === "slow")!.runs[0]!.checks[0],
    ).toMatchObject({
      name: "agent finished",
      detail: "stopped: timeout",
    });
    expect(judge.calls).toHaveLength(0);
  });
});

describe("matchers", () => {
  it("give the same answer on repeated calls even with the g flag", () => {
    const m = compileMatcher("/core/g");
    expect(["references/core.md", "core.md", "x/core"].map(m)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("reject an invalid regex when cases load", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "bad-regex",
      kind: "answer",
      targets: ["fake/m"],
      prompt: "p",
      mustInclude: ["/foo(/"],
    });

    await expect(
      runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } })),
    ).rejects.toThrow(/bad-regex\.yaml: mustInclude\.0: invalid regex/);
    await expect(
      runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } })),
    ).rejects.toBeInstanceOf(CaseValidationError);
  });
});

describe("filtered runs and the baseline", () => {
  it("do not report uncovered baseline entries as removed, and approve merges instead of replacing", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "a",
    });
    await env.writeCase({
      id: "b",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "b",
    });
    const deps = env.deps({ adapters: { fake: fakeAdapter() } });
    await runEval(env.options(), deps);
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });

    const filtered = await runEval(env.options({ caseId: "a" }), deps);
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });

    expect(filtered.comparison.map((c) => `${c.caseId} ${c.status}`)).toEqual([
      "a unchanged",
    ]);
    const baseline = JSON.parse(await readFile(env.baselineFile, "utf8"));
    expect(
      baseline.entries.map((e: { caseId: string }) => e.caseId).sort(),
    ).toEqual(["a", "b"]);
  });
});

describe("Codex flow edge cases", () => {
  const workdir = path.join(os.tmpdir(), "iointel-eval-edge", "work");
  const cmd = (command: string) => ({
    type: "command_execution",
    command,
    exit_code: 0,
  });

  it("treats heredoc and redirect writes as commands, not reads", () => {
    const flow = extractCodexFlow(
      [
        cmd(
          "bash -lc \"cat > .agents/skills/io-intelligence/SKILL.md <<'EOF'\nhello\nEOF\"",
        ),
      ],
      workdir,
      ".agents/skills/io-intelligence",
    );

    expect(flow.skillTriggered).toBe(false);
    expect(flow.steps[0]!.kind).toBe("command");
  });

  it("unwraps a quoted shell path containing spaces and detects the skill load", () => {
    const command =
      '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -Command "Get-Content .agents/skills/io-intelligence/SKILL.md"';

    expect(unwrapShell(command)).toBe(
      "Get-Content .agents/skills/io-intelligence/SKILL.md",
    );
    expect(
      extractCodexFlow(
        [cmd(command)],
        workdir,
        ".agents/skills/io-intelligence",
      ).skillTriggered,
    ).toBe(true);
  });
});

describe("workdir guard false positives", () => {
  const guard = createWorkdirGuard(
    path.join(os.tmpdir(), "iointel-eval-g", "work"),
    { network: true },
  );

  it("allows slash-prefixed arguments that are not filesystem paths", () => {
    expect(
      guard("Bash", { command: 'grep -rn "/api/users" src' }).behavior,
    ).toBe("allow");
    expect(
      guard("Bash", { command: "sed -i '/debug/d' app.ts" }).behavior,
    ).toBe("allow");
    expect(guard("Bash", { command: "npx vite build --base /" }).behavior).toBe(
      "allow",
    );
  });
});
