import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  fakeAdapter,
  fakeJudge,
  makeEnv,
  runEval,
  SKILL_INSTALL,
} from "./helpers.js";

describe("--without-skill (skill removed)", () => {
  it("adds a skill-removed run per unit, without the skill installed, and reports it apart", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "uplift",
      kind: "answer",
      targets: ["fake/m"],
      input: { prompt: "p" },
      output: { deterministic: { mustInclude: ["mcp-web"] } },
    });
    const adapter = fakeAdapter(async (input) => {
      const installed = await access(
        path.join(input.workdir, SKILL_INSTALL),
      ).then(
        () => true,
        () => false,
      );
      return {
        skillTriggered: installed,
        finalMessage: installed ? "use mcp-web" : "use some MCP package",
      };
    });

    const report = await runEval(
      env.options({ repeat: 2, withoutSkill: true }),
      env.deps({ adapters: { fake: adapter } }),
    );

    const c = report.cases[0]!;
    expect(adapter.calls).toHaveLength(4);
    expect(c).toMatchObject({ ran: 2, pass: true, passRate: 1 });
    expect(c.runs.every((r) => r.withSkill)).toBe(true);
    expect(c.withoutSkill).toMatchObject({
      ran: 2,
      passRate: 0,
      triggerRate: 0,
    });
    expect(c.withoutSkill!.runs.every((r) => !r.withSkill)).toBe(true);
    // Skill-removed runs are counted apart, so passed + failed + withoutSkill = ran.
    expect(report.totals).toMatchObject({
      runs: 4,
      runsPassed: 2,
      runsFailed: 0,
      runsWithoutSkill: 2,
    });
  });

  it("reports mean turns, failed agent commands and cost on both sides", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "effort",
      kind: "answer",
      targets: ["fake/m"],
      input: { prompt: "p" },
      output: {},
    });
    const adapter = fakeAdapter(async (input, n) => {
      const installed = await access(
        path.join(input.workdir, SKILL_INSTALL),
      ).then(
        () => true,
        () => false,
      );
      if (installed) return { turns: 2, costUsd: 0.1 };
      return {
        skillTriggered: false,
        turns: 8 + n,
        costUsd: 0.4,
        flow: [
          { kind: "command", command: "npm i x", exitCode: 1 },
          { kind: "command", command: "npm i y", exitCode: 0 },
          { kind: "command", command: "slow", exitCode: null },
        ],
      };
    });

    const report = await runEval(
      env.options({ repeat: 2, withoutSkill: true }),
      env.deps({ adapters: { fake: adapter } }),
    );

    const c = report.cases[0]!;
    expect(c.effort).toEqual({ turns: 2, failedCommands: 0, costUsd: 0.1 });
    expect(c.withoutSkill!.effort.failedCommands).toBe(1);
    expect(c.withoutSkill!.effort.costUsd).toBeCloseTo(0.4);
    // Repeats are interleaved with and without the skill, so only the mean range is fixed.
    expect(c.withoutSkill!.effort.turns).toBeGreaterThan(8);
  });

  it("ignores the trigger expectation for skill-removed runs", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "facts",
      kind: "answer",
      targets: ["fake/m"],
      input: { prompt: "p" },
      output: { deterministic: { mustInclude: ["mcp-web"] } },
    });
    const adapter = fakeAdapter(() => ({
      skillTriggered: false,
      finalMessage: "mcp-web",
    }));

    const report = await runEval(
      env.options({ withoutSkill: true }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.withoutSkill!.passRate).toBe(1);
  });

  it("skips flow checks on the skill's own files in skill-removed runs, and keeps the rest", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "flowy",
      kind: "answer",
      targets: ["fake/m"],
      input: { prompt: "p" },
      output: {
        deterministic: {
          mustInclude: ["mcp-web"],
          flow: {
            mustRead: ["references/code-mode.md", "package.json"],
            mustNotRead: ["/custom-ai-web\\.md$/"],
            mustRun: ["materialize-template"],
            mustFetch: ["docs-ai.interop.io"],
          },
        },
      },
    });
    // Without the skill the agent reads package.json and fetches the docs, and nothing from the skill.
    const adapter = fakeAdapter(() => ({
      skillTriggered: false,
      finalMessage: "mcp-web",
      flow: [
        { kind: "read", path: "package.json" },
        { kind: "fetch", url: "https://docs-ai.interop.io/x" },
      ],
    }));

    const report = await runEval(
      env.options({ withoutSkill: true }),
      env.deps({
        adapters: { fake: adapter },
        skillFiles: [
          "SKILL.md",
          "references/code-mode.md",
          "references/custom-ai-web.md",
          "scripts/materialize-template.mjs",
        ],
      }),
    );

    const run = report.cases[0]!.withoutSkill!.runs[0]!;
    expect(run.pass).toBe(true);
    const skipped = run.checks.filter((c) => c.skipped).map((c) => c.name);
    expect(skipped).toEqual([
      "flow.mustRead references/code-mode.md",
      "flow.mustNotRead /custom-ai-web\\.md$/",
      "flow.mustRun materialize-template",
    ]);
    expect(run.checks.find((c) => c.name === "flow.mustRead package.json"))
      .toMatchObject({ pass: true });
    expect(
      run.checks.find((c) => c.name === "flow.mustFetch docs-ai.interop.io"),
    ).toMatchObject({ pass: true });
    expect(run.checks.some((c) => c.skipped && !c.pass)).toBe(false);
    // The with-skill run still has to read the skill file.
    expect(report.cases[0]!.runs[0]!.checks).toContainEqual(
      expect.objectContaining({
        name: "flow.mustRead references/code-mode.md",
        pass: false,
      }),
    );
  });
});

describe("cost cap, concurrency and cost reporting", () => {
  it("stops starting new runs once the cap is reached and marks them skipped", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "p" },
    });
    const adapter = fakeAdapter(() => ({ costUsd: 0.4 }));

    const report = await runEval(
      env.options({ repeat: 5, concurrency: 1, maxCostUsd: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(adapter.calls).toHaveLength(3);
    expect(report.cases[0]).toMatchObject({ ran: 3, skipped: 2, pass: true });
    expect(report.cases[0]!.runs.filter((r) => r.skipped)[0]!.skipReason).toBe(
      "cost cap of $1 reached",
    );
    expect(report.totals).toMatchObject({ runs: 3, skipped: 2 });
    expect(report.totals.costUsd).toBeCloseTo(1.2);
  });

  it("reports a case as skipped (pass null) when every run was skipped", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "a" },
    });
    await env.writeCase({
      id: "b",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "b" },
    });
    const adapter = fakeAdapter(() => ({ costUsd: 5 }));

    const report = await runEval(
      env.options({ concurrency: 1, maxCostUsd: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases.find((c) => c.caseId === "b")!.pass).toBeNull();
  });

  it("runs at most `concurrency` units at once", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "p" },
    });
    let active = 0;
    let peak = 0;
    const adapter = fakeAdapter(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 50));
      active--;
      return {};
    });

    await runEval(
      env.options({ repeat: 6, concurrency: 2 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(peak).toBe(2);
  });

  it("totals agent and judge cost per case, per target and overall, and flags unknown cost", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "answer",
      targets: ["fake/m", "nocost/m"],
      input: { prompt: "p" },
      output: { judge: { rubric: [{ assertion: "line" }] } },
    });
    const fake = fakeAdapter(() => ({ costUsd: 0.25 }));
    const nocost = fakeAdapter(() => ({ costUsd: null }), "nocost");

    const report = await runEval(
      env.options({ repeat: 2 }),
      env.deps({
        adapters: { fake, nocost },
        judge: fakeJudge(() => false, 0.05),
      }),
    );

    expect(report.cases.find((c) => c.target === "fake/m")).toMatchObject({
      costUnknown: false,
    });
    expect(
      report.cases.find((c) => c.target === "fake/m")!.costUsd,
    ).toBeCloseTo(0.6);
    expect(report.cases.find((c) => c.target === "nocost/m")).toMatchObject({
      costUnknown: true,
    });
    expect(report.totals.costByTarget["fake/m"]).toBeCloseTo(0.6);
    expect(report.totals.costUnknown).toBe(true);
  });
});
