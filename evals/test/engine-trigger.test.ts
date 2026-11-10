import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CaseValidationError } from "../src/cases/loader.js";
import { EvalSetupError } from "../src/engine/index.js";
import { fakeAdapter, makeEnv, runEval, SKILL_INSTALL } from "./helpers.js";

const trigger = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "trigger",
  targets: ["fake/model-a"],
  input: { prompt: `prompt for ${id}` },
  ...extra,
});

describe("trigger cases", () => {
  it("passes when the skill triggers as expected and records the run", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("mcp-tool"));
    const adapter = fakeAdapter();

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases).toHaveLength(1);
    expect(report.cases[0]).toMatchObject({
      caseId: "mcp-tool",
      target: "fake/model-a",
      pass: true,
      passRate: 1,
      triggerRate: 1,
    });
    expect(adapter.calls[0]).toMatchObject({
      prompt: "prompt for mcp-tool",
      model: "model-a",
      network: true,
      maxTurns: 15,
      timeoutMs: 180_000,
    });
    const summary = JSON.parse(
      await readFile(path.join(report.resultsPath, "summary.json"), "utf8"),
    );
    expect(summary.version).toBe(2);
    expect(summary.cases[0].id).toBe("mcp-tool");
    await access(
      path.join(report.resultsPath, report.cases[0]!.runs[0]!.transcriptFile!),
    );
  });

  it("installs the working copy of the skill in each run workdir", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("installed"));
    let skillMd = "";
    const adapter = fakeAdapter(async (input) => {
      skillMd = await readFile(
        path.join(input.workdir, SKILL_INSTALL, "SKILL.md"),
        "utf8",
      );
      return {};
    });

    await runEval(env.options(), env.deps({ adapters: { fake: adapter } }));

    expect(skillMd).toContain("name: io-intelligence");
  });

  it("negative cases pass only when the skill does not trigger", async () => {
    const env = await makeEnv();
    await env.writeCase(
      trigger("unrelated", {
        output: { deterministic: { expectSkill: false } },
      }),
    );
    await env.writeCase(
      trigger("unrelated-but-fires", {
        output: { deterministic: { expectSkill: false } },
      }),
    );
    const adapter = fakeAdapter((input) => ({
      skillTriggered: input.prompt.includes("fires"),
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases.find((c) => c.caseId === "unrelated")!.pass).toBe(true);
    expect(
      report.cases.find((c) => c.caseId === "unrelated-but-fires")!.pass,
    ).toBe(false);
  });

  it("expands cases into targets × repeats and passes at 2 of 3 by default", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("flaky", { targets: ["fake/a", "fake/b"] }));
    // Fails the 2nd call of each target: a → calls 0,1,2 ; b → calls 3,4,5 (sequential).
    const adapter = fakeAdapter((_, call) => ({
      skillTriggered: call % 3 !== 1,
    }));

    const report = await runEval(
      env.options({ repeat: 3, concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(adapter.calls).toHaveLength(6);
    for (const c of report.cases)
      expect(c).toMatchObject({ ran: 3, pass: true, triggerRate: 2 / 3 });
  });

  it("fails below the threshold, and a per-case threshold and repeat override the defaults", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("strict", { repeat: 2, passThreshold: 1 }));
    const adapter = fakeAdapter((_, call) => ({ skillTriggered: call === 0 }));

    const report = await runEval(
      env.options({ repeat: 5, concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(adapter.calls).toHaveLength(2);
    expect(report.cases[0]).toMatchObject({
      pass: false,
      passRate: 0.5,
      threshold: 1,
    });
  });

  it("filters by kind, case id and target (exact id or tool name)", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("one", { targets: ["fake/a", "other/b"] }));
    await env.writeCase(trigger("two"));
    await env.writeCase({
      id: "three",
      kind: "answer",
      targets: ["fake/a"],
      input: { prompt: "p" },
    });
    const fake = fakeAdapter();
    const other = fakeAdapter(() => ({}), "other");
    const deps = env.deps({ adapters: { fake, other } });

    const byKind = await runEval(env.options({ kind: "answer" }), deps);
    const byCase = await runEval(env.options({ caseId: "one" }), deps);
    const byTool = await runEval(env.options({ target: "other" }), deps);
    const byTarget = await runEval(env.options({ target: "fake/a" }), deps);

    expect(byKind.cases.map((c) => c.caseId)).toEqual(["three"]);
    expect(byCase.cases.map((c) => `${c.caseId} ${c.target}`)).toEqual([
      "one fake/a",
      "one other/b",
    ]);
    expect(byTool.cases.map((c) => `${c.caseId} ${c.target}`)).toEqual([
      "one other/b",
    ]);
    expect(byTarget.cases.map((c) => c.caseId).sort()).toEqual([
      "one",
      "three",
    ]);
  });

  it("rejects invalid case files before running anything", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("fine"));
    await env.writeCase({
      id: "no-targets",
      kind: "trigger",
      input: { prompt: "p" },
    });
    await env.writeCase({
      id: "typo",
      kind: "trigger",
      targets: ["fake/a"],
      input: { prompt: "p" },
      mustInclud: ["x"],
    });
    const adapter = fakeAdapter();

    const run = runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    await expect(run).rejects.toBeInstanceOf(CaseValidationError);
    await expect(run).rejects.toThrow(/no-targets.json: targets/);
    await expect(run).rejects.toThrow(/typo.json/);
    expect(adapter.calls).toHaveLength(0);
  });

  it("fails fast when an adapter is missing or not ready", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("a", { targets: ["fake/a", "codex/gpt"] }));

    await expect(
      runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } })),
    ).rejects.toThrow(/no adapter for tool "codex"/);
    await expect(
      runEval(
        env.options({ target: "fake" }),
        env.deps({
          adapters: {
            fake: fakeAdapter(
              () => ({}),
              "fake",
              "ANTHROPIC_API_KEY is not set",
            ),
          },
        }),
      ),
    ).rejects.toThrow(EvalSetupError);
  });

  it("records agent errors as failed runs instead of crashing the run", async () => {
    const env = await makeEnv();
    await env.writeCase(trigger("boom"));
    const adapter = fakeAdapter(() => {
      throw new Error("sdk exploded");
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]).toMatchObject({
      error: "sdk exploded",
      stopReason: "error",
    });
  });
});
