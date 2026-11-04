import { access, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CaseValidationError } from "../src/cases/loader.js";
import type { Evals } from "../src/shared/contracts.js";
import {
  fakeAdapter,
  fakeJudge,
  makeEnv,
  runEval,
  SKILL_INSTALL,
} from "./helpers.js";

const answer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  prompt: "How do I expose a tool to io.Assist?",
  ...extra,
});

describe("checks", () => {
  it("checks mustInclude and mustNotInclude with strings and regexes", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("good", {
        prompt: "good",
        mustInclude: ["@interopio/mcp-web", "/register\\w*Tool/i"],
        mustNotInclude: ["@interopio/mcp-server"],
      }),
    );
    await env.writeCase(
      answer("invented", {
        prompt: "invented",
        mustNotInclude: ["/@interopio\\/mcp-(server|browser)/"],
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
      env.deps({ adapter }),
    );

    const good = report.cases.find((c) => c.caseId === "good")!;
    const invented = report.cases.find((c) => c.caseId === "invented")!;
    expect(good.pass).toBe(true);
    expect(invented.pass).toBe(false);
    expect(invented.checks.find((c) => !c.pass)).toMatchObject({
      name: "mustNotInclude /@interopio\\/mcp-(server|browser)/",
      detail: "found in the final message",
    });
  });

  it("fails when the skill did not trigger, even if the text is right, and stops there", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("ignored-skill", { mustInclude: ["mcp-web"] }));
    const adapter = fakeAdapter(() => ({
      skillTriggered: false,
      finalMessage: "use mcp-web",
    }));

    const report = await runEval(env.options(), env.deps({ adapter }));

    expect(report.cases[0]).toMatchObject({
      pass: false,
      skillTriggered: false,
      checks: [{ name: "skill triggered", pass: false }],
    });
  });

  it("fails runs that hit their turn limit or timed out, without calling the judge", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("limited", { prompt: "limited", rubric: "- x" }),
    );
    await env.writeCase(answer("slow", { prompt: "slow", rubric: "- x" }));
    const judge = fakeJudge();
    const adapter = fakeAdapter((input) => ({
      stopReason: input.prompt === "slow" ? "timeout" : "max-turns",
    }));

    const report = await runEval(env.options(), env.deps({ adapter, judge }));

    for (const c of report.cases) expect(c.pass).toBe(false);
    expect(report.cases.find((c) => c.caseId === "slow")!.checks).toEqual([
      { name: "agent finished", pass: false, detail: "stopped: timeout" },
    ]);
    expect(judge.calls).toHaveLength(0);
  });

  it("reports a workspace that cannot be prepared as not run, at no cost, without running the agent", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("no-skill-dir"));
    await rm(env.skillDir, { recursive: true });
    const adapter = fakeAdapter();

    const report = await runEval(env.options(), env.deps({ adapter }));

    expect(adapter.calls).toHaveLength(0);
    expect(report.cases[0]).toMatchObject({
      ran: false,
      pass: false,
      stopReason: "error",
      error: expect.stringMatching(/ENOENT/),
      costUsd: 0,
    });
    expect(report.totals.costUnknown).toBe(false);
  });

  it("keeps a finished run's result when its transcript can't be written", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("unwritable", { mustInclude: ["ok"] }));
    const lines: string[] = [];
    // A folder where the transcript file should go makes the write fail.
    const adapter = fakeAdapter(async () => {
      const [runDir] = await readdir(env.resultsDir);
      await mkdir(
        path.join(env.resultsDir, runDir!, "transcripts", "unwritable.json"),
      );
      return { finalMessage: "ok", costUsd: 0.2 };
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapter, log: (l) => lines.push(l) }),
    );

    const c = report.cases[0]!;
    expect(c).toMatchObject({ ran: true, pass: true, costUsd: 0.2 });
    expect(c.transcriptFile).toBeUndefined();
    expect(
      lines.some((l) => /could not write the transcript of unwritable/.test(l)),
    ).toBe(true);
  });

  it("reports an adapter that throws as a failed case", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("crash"));
    const adapter = fakeAdapter(() => {
      throw new Error("sdk exploded");
    });

    const report = await runEval(env.options(), env.deps({ adapter }));

    expect(report.cases[0]).toMatchObject({
      pass: false,
      stopReason: "error",
      error: "sdk exploded",
      checks: [{ name: "agent finished", detail: "sdk exploded" }],
    });
  });
});

describe("running a case", () => {
  it("runs each case once, in a fresh workdir with the skill installed, with the chosen model and fixed limits", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    let workdir = "";
    let skillInstalled = false;
    const adapter = fakeAdapter(async (input) => {
      workdir = input.workdir;
      skillInstalled = await access(
        path.join(input.workdir, SKILL_INSTALL, "SKILL.md"),
      ).then(
        () => true,
        () => false,
      );
      return {};
    });

    await runEval(
      env.options({ model: "claude-opus-5-5" }),
      env.deps({ adapter }),
    );

    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({
      model: "claude-opus-5-5",
      maxTurns: 15,
      timeoutMs: 180_000,
    });
    expect(skillInstalled).toBe(true);
    await expect(access(workdir)).rejects.toThrow();
  });

  it("leaves the model undefined without --model, so the adapter uses its default", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const adapter = fakeAdapter();

    await runEval(env.options(), env.deps({ adapter }));

    expect(adapter.calls[0]!.model).toBeUndefined();
  });

  it("writes summary.json and one transcript per case with the answer, verdicts and transcript", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("graded", { rubric: "- Recommends mcp-web" }));
    const adapter = fakeAdapter(() => ({
      finalMessage: "use mcp-web",
      transcript: [{ type: "assistant" }],
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapter, judge: fakeJudge() }),
    );

    const c = report.cases[0]!;
    expect(c.transcriptFile).toBe("transcripts/graded.json");
    const transcript = JSON.parse(
      await readFile(path.join(report.resultsPath, c.transcriptFile!), "utf8"),
    );
    expect(transcript).toEqual({
      finalMessage: "use mcp-web",
      judge: [{ text: "Recommends mcp-web", pass: true, reason: "ok" }],
      transcript: [{ type: "assistant" }],
    });
    const summary = JSON.parse(
      await readFile(path.join(report.resultsPath, "summary.json"), "utf8"),
    );
    expect(summary.runId).toBe(report.runId);
    expect(summary.totals).toMatchObject({ casesPassed: 1, casesFailed: 0 });
  });

  it("runs only the --case case", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await env.writeCase(answer("b"));
    const adapter = fakeAdapter();

    const report = await runEval(
      env.options({ caseId: "b" }),
      env.deps({ adapter }),
    );

    expect(report.cases.map((c) => c.caseId)).toEqual(["b"]);
    expect(adapter.calls).toHaveLength(1);
  });

  it("runs at most `concurrency` cases at once", async () => {
    const env = await makeEnv();
    for (const id of ["a", "b", "c", "d", "e"]) await env.writeCase(answer(id));
    let active = 0;
    let peak = 0;
    const adapter = fakeAdapter(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 50));
      active--;
      return {};
    });

    await runEval(env.options({ concurrency: 2 }), env.deps({ adapter }));

    expect(peak).toBe(2);
  });

  it("stops before running anything when the adapter is not ready", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const adapter = fakeAdapter(undefined, "ANTHROPIC_API_KEY is not set");

    await expect(runEval(env.options(), env.deps({ adapter }))).rejects.toThrow(
      /fake: ANTHROPIC_API_KEY is not set/,
    );
    expect(adapter.calls).toHaveLength(0);
  });
});

describe("judge", () => {
  it("grades each rubric line and fails the case when any line fails", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("graded", {
        rubric: "- Recommends mcp-web\n- Explains discovery\n\n",
      }),
    );
    const judge = fakeJudge((line) => line === "Explains discovery");
    const adapter = fakeAdapter(() => ({
      finalMessage: "the answer",
      transcript: [{ tool: "Read" }],
    }));

    const report = await runEval(env.options(), env.deps({ adapter, judge }));

    expect(judge.calls[0]).toEqual({
      rubric: ["Recommends mcp-web", "Explains discovery"],
      finalMessage: "the answer",
      transcript: [{ tool: "Read" }],
    });
    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.judge).toEqual([
      { text: "Recommends mcp-web", pass: true, reason: "ok" },
      { text: "Explains discovery", pass: false, reason: "missed" },
    ]);
    expect(report.cases[0]!.costUsd).toBeCloseTo(0.15);
  });

  it("is not called when deterministic checks already failed", async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer("cheap-fail", { mustInclude: ["mcp-web"], rubric: "- anything" }),
    );
    const judge = fakeJudge();

    const report = await runEval(
      env.options(),
      env.deps({ adapter: fakeAdapter(), judge }),
    );

    expect(judge.calls).toHaveLength(0);
    expect(report.cases[0]!.pass).toBe(false);
  });

  it("is not called for a case without a rubric", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("plain"));
    await env.writeCase(answer("blank", { rubric: "  \n" }));
    const judge = fakeJudge();

    const report = await runEval(
      env.options(),
      env.deps({ adapter: fakeAdapter(), judge }),
    );

    expect(judge.calls).toHaveLength(0);
    expect(report.cases.every((c) => c.pass)).toBe(true);
  });

  it("must be configured when a case has a rubric", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("needs-judge", { rubric: "- x" }));

    await expect(
      runEval(env.options(), env.deps({ adapter: fakeAdapter() })),
    ).rejects.toThrow(/no judge/);
  });

  it("keeps the agent result and cost when the judge fails", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("graded", { rubric: "- x" }));
    const judge: Evals.Judge.Grader = {
      checkReady: () => undefined,
      grade: async () => Promise.reject(new Error("overloaded")),
    };

    const report = await runEval(
      env.options(),
      env.deps({ adapter: fakeAdapter(() => ({ costUsd: 0.3 })), judge }),
    );

    const c = report.cases[0]!;
    expect(c.pass).toBe(false);
    expect(c.checks.at(-1)).toEqual({
      name: "judge",
      pass: false,
      detail: "judge error: overloaded",
    });
    expect(c.transcriptFile).toBeDefined();
    expect(c.costUsd).toBeCloseTo(0.3);
  });

  it("adds the cost of a judge call that was paid for before it failed", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("graded", { rubric: "- x" }));
    const judge: Evals.Judge.Grader = {
      checkReady: () => undefined,
      grade: async () =>
        Promise.reject(
          Object.assign(new Error("no parseable verdict"), { costUsd: 0.07 }),
        ),
    };

    const report = await runEval(
      env.options(),
      env.deps({ adapter: fakeAdapter(() => ({ costUsd: 0.3 })), judge }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.costUsd).toBeCloseTo(0.37);
  });
});

describe("case files", () => {
  it.each([
    ["kind", { kind: "answer" }],
    ["targets", { targets: ["claude-code/claude-sonnet-5-5"] }],
    ["repeat", { repeat: 3 }],
    ["passThreshold", { passThreshold: 1 }],
    ["flow", { flow: { mustRead: ["core.md"] } }],
    ["expectSkill", { expectSkill: false }],
    ["network", { network: false }],
    ["maxTurns", { maxTurns: 5 }],
  ])("reject the removed field %s", async (field, extra) => {
    const env = await makeEnv();
    await env.writeCase(answer("old", extra));

    await expect(
      runEval(env.options(), env.deps({ adapter: fakeAdapter() })),
    ).rejects.toThrow(new RegExp(`old\\.yaml: .*${field}`));
  });

  it("reject an invalid regex", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("bad-regex", { mustInclude: ["/foo(/"] }));

    const run = runEval(env.options(), env.deps({ adapter: fakeAdapter() }));

    await expect(run).rejects.toBeInstanceOf(CaseValidationError);
    await expect(run).rejects.toThrow(
      /bad-regex\.yaml: mustInclude\.0: invalid regex/,
    );
  });
});
