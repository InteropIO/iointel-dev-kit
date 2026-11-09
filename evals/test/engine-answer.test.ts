import { describe, expect, it } from "vitest";
import { fakeAdapter, fakeJudge, makeEnv, runEval } from "./helpers.js";

// `input` is merged over the default input; other overrides (including `output`) replace top-level fields.
const answer = (
  id: string,
  { input, ...extra }: { input?: object } & Record<string, unknown> = {},
) => ({
  id,
  kind: "answer",
  targets: ["fake/m"],
  ...extra,
  input: { prompt: "How do I expose a tool to io.Assist?", ...input },
});

describe("answer cases", () => {
  it("checks mustInclude and mustNotInclude with strings and regexes", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("good", {
        input: { prompt: "good" },
        output: {
          deterministic: {
            mustInclude: ["@interopio/mcp-web", "/register\\w*Tool/i"],
            mustNotInclude: ["@interopio/mcp-server"],
          },
        },
      }),
    );
    await env.writeCase(
      answer("invented", {
        input: { prompt: "invented" },
        output: {
          deterministic: {
            mustNotInclude: ["/@interopio\\/mcp-(server|browser)/"],
          },
        },
      }),
    );
    const adapter = fakeAdapter((input) => ({
      finalMessage:
        input.prompt === "invented"
          ? "Use @interopio/mcp-browser and call registerTool."
          : "Install @interopio/mcp-web, then RegisterTool at startup.",
    }));

    const report = await runEval(
      env.options({ concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    const good = report.cases.find((c) => c.caseId === "good")!;
    const invented = report.cases.find((c) => c.caseId === "invented")!;
    expect(good.pass).toBe(true);
    expect(invented.pass).toBe(false);
    expect(invented.runs[0]!.checks.find((c) => !c.pass)).toMatchObject({
      name: "mustNotInclude /@interopio\\/mcp-(server|browser)/",
      detail: "found in the final message",
    });
  });

  it("fails a run when the skill did not trigger, even if the text is right", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("ignored-skill", {
        output: { deterministic: { mustInclude: ["mcp-web"] } },
      }),
    );
    const adapter = fakeAdapter(() => ({
      skillTriggered: false,
      finalMessage: "use mcp-web",
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]!.checks[0]).toEqual({
      name: "skill triggered",
      pass: false,
    });
  });

  it("requires every run to pass", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("mostly", {
        output: { deterministic: { mustInclude: ["mcp-web"] } },
      }),
    );
    const adapter = fakeAdapter((_, call) => ({
      finalMessage: call === 2 ? "no idea" : "mcp-web",
    }));

    const report = await runEval(
      env.options({ repeat: 3, concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases[0]).toMatchObject({
      pass: false,
      passRate: 2 / 3,
      threshold: 1,
    });
  });

  it("passes the network flag to the adapter (default on)", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("online"));
    await env.writeCase(answer("offline", { network: false }));
    const adapter = fakeAdapter();

    const report = await runEval(
      env.options({ concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(adapter.calls.map((c) => c.network).sort()).toEqual([false, true]);
    expect(report.cases.find((c) => c.caseId === "offline")!.network).toBe(
      false,
    );
  });
});

describe("judge", () => {
  it("grades each rubric line and fails the run when any line fails", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("graded", {
        output: {
          judge: { rubric: ["Recommends mcp-web", "Explains discovery"] },
        },
      }),
    );
    const judge = fakeJudge((line) => line === "Explains discovery");
    const adapter = fakeAdapter(() => ({
      finalMessage: "the answer",
      transcript: [{ tool: "Read" }],
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter }, judge }),
    );

    expect(judge.calls[0]).toMatchObject({
      rubric: ["Recommends mcp-web", "Explains discovery"],
      finalMessage: "the answer",
      transcript: [{ tool: "Read" }],
      // Answer cases get the workspace diff too; this agent changed nothing.
      diff: "",
    });
    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]!.judge).toEqual([
      { text: "Recommends mcp-web", pass: true, reason: "ok" },
      { text: "Explains discovery", pass: false, reason: "missed" },
    ]);
    expect(report.cases[0]!.costUsd).toBeCloseTo(0.15);
  });

  it("is not called when deterministic checks already failed", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("cheap-fail", {
        output: {
          deterministic: { mustInclude: ["mcp-web"] },
          judge: { rubric: ["anything"] },
        },
      }),
    );
    const judge = fakeJudge();

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() }, judge }),
    );

    expect(judge.calls).toHaveLength(0);
    expect(report.cases[0]!.pass).toBe(false);
  });

  it("scores each run as the share of rubric lines passed, and averages it per case", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("scored", {
        output: { judge: { rubric: ["one", "two", "three", "four"] } },
      }),
    );
    // Run 1 misses "four", run 2 misses "three" and "four".
    const judge = fakeJudge((line) =>
      judge.calls.length === 1
        ? line === "four"
        : line === "three" || line === "four",
    );

    const report = await runEval(
      env.options({ repeat: 2, concurrency: 1 }),
      env.deps({ adapters: { fake: fakeAdapter() }, judge }),
    );

    const c = report.cases[0]!;
    expect(c.runs.map((r) => r.rubricScore)).toEqual([0.75, 0.5]);
    expect(c.rubricScore).toBeCloseTo(0.625);
    expect(c.pass).toBe(false);
  });

  it("passes a run whose score meets the judge threshold", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("lenient", {
        output: {
          judge: { rubric: ["one", "two", "three"], threshold: 0.6667 },
        },
      }),
    );
    const judge = fakeJudge((line) => line === "three");

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() }, judge }),
    );

    expect(report.cases[0]!.runs[0]!.rubricScore).toBeCloseTo(2 / 3);
    expect(report.cases[0]!.pass).toBe(true);
  });

  it("grades report-only lines without counting them", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("tuning", {
        output: {
          judge: {
            rubric: ["Recommends mcp-web", "[report-only] Mentions Angular"],
          },
        },
      }),
    );
    const judge = fakeJudge((line) => line === "Mentions Angular");

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() }, judge }),
    );

    expect(judge.calls[0]!.rubric).toEqual([
      "Recommends mcp-web",
      "Mentions Angular",
    ]);
    const run = report.cases[0]!.runs[0]!;
    expect(run.judge).toEqual([
      { text: "Recommends mcp-web", pass: true, reason: "ok" },
      {
        text: "Mentions Angular",
        pass: false,
        reason: "missed",
        reportOnly: true,
      },
    ]);
    expect(run.rubricScore).toBe(1);
    expect(report.cases[0]!.pass).toBe(true);
  });

  it("has no score when every line is report-only", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("all-info", {
        output: { judge: { rubric: ["[report-only] anything"] } },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({
        adapters: { fake: fakeAdapter() },
        judge: fakeJudge(() => true),
      }),
    );

    expect(report.cases[0]!.runs[0]!.rubricScore).toBeUndefined();
    expect(report.cases[0]!.rubricScore).toBeNull();
    expect(report.cases[0]!.pass).toBe(true);
  });

  it("rejects a judge threshold outside (0, 1]", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("bad-threshold", {
        output: { judge: { rubric: ["x"], threshold: 1.5 } },
      }),
    );

    await expect(
      runEval(
        env.options(),
        env.deps({ adapters: { fake: fakeAdapter() }, judge: fakeJudge() }),
      ),
    ).rejects.toThrow(/output\.judge\.threshold/);
  });

  it("must be configured when a case has a rubric", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("needs-judge", { output: { judge: { rubric: ["x"] } } }),
    );

    await expect(
      runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } })),
    ).rejects.toThrow(/no judge/);
  });
});
