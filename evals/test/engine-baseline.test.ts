import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EvalSetupError } from "../src/engine/index.js";
import { approveRun } from "../src/report/baseline.js";
import { fakeAdapter, makeEnv, runEval } from "./helpers.js";

const answer = (id: string) => ({ id, prompt: id, mustInclude: ["ok"] });

describe("baseline safety", () => {
  it("rejects a baseline from the older engine before running anything", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await writeFile(
      env.baselineFile,
      JSON.stringify({ version: 1, runId: "old", entries: [] }),
    );
    const adapter = fakeAdapter();

    const run = runEval(env.options(), env.deps({ adapter }));

    await expect(run).rejects.toBeInstanceOf(EvalSetupError);
    await expect(run).rejects.toThrow(/version 1.*delete it/);
    expect(adapter.calls).toHaveLength(0);
  });

  it("refuses to merge a --case run into a baseline from the older engine", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await runEval(
      env.options({ caseId: "a" }),
      env.deps({ adapter: fakeAdapter() }),
    );
    await writeFile(
      env.baselineFile,
      JSON.stringify({ version: 1, runId: "old", entries: [] }),
    );

    await expect(
      approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).rejects.toThrow(/version 1/);
  });

  it("refuses to approve a run where a case never reached the agent", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await env.writeCase(answer("b"));
    await rm(env.skillDir, { recursive: true });
    await runEval(env.options(), env.deps({ adapter: fakeAdapter() }));

    await expect(
      approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).rejects.toThrow(/never reached the agent \(a, b\)/);
    await expect(readFile(env.baselineFile, "utf8")).rejects.toThrow();
  });
});

describe("comparison and approve", () => {
  it("has no reference without a baseline, even when earlier runs exist", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const deps = env.deps({
      adapter: fakeAdapter(() => ({ finalMessage: "ok" })),
    });

    await runEval(env.options(), deps);
    const second = await runEval(env.options(), deps);

    expect(second.reference).toEqual({ kind: "none" });
    expect(second.comparison).toEqual([]);
  });

  it("compares with the approved baseline: regressions, improvements, new and removed cases", async () => {
    const env = await makeEnv();
    for (const id of ["keeps", "breaks", "heals", "goes-away"])
      await env.writeCase(answer(id));
    let round = 0;
    const adapter = fakeAdapter((input) => ({
      finalMessage:
        input.prompt === "keeps" ||
        (round === 0 ? input.prompt !== "heals" : input.prompt !== "breaks")
          ? "ok"
          : "nope",
    }));
    const deps = env.deps({ adapter });

    const first = await runEval(env.options(), deps);
    expect(
      await approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).toBe(first.runId);

    round = 1;
    await env.writeCase(answer("brand-new"));
    await rm(path.join(env.casesDir, "goes-away.yaml"));
    const second = await runEval(env.options(), deps);

    expect(second.reference).toEqual({ kind: "baseline", runId: first.runId });
    expect(
      Object.fromEntries(second.comparison.map((c) => [c.caseId, c.status])),
    ).toEqual({
      keeps: "unchanged",
      breaks: "regressed",
      heals: "improved",
      "brand-new": "new",
      "goes-away": "removed",
    });
    expect(second.comparison.find((c) => c.caseId === "breaks")!.pass).toEqual({
      before: true,
      after: false,
    });
  });

  it("stores only case id, pass and cost in the baseline", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await runEval(
      env.options(),
      env.deps({
        adapter: fakeAdapter(() => ({ finalMessage: "ok", costUsd: 0.2 })),
      }),
    );

    const runId = await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
      now: () => new Date("2026-11-03T00:00:00.000Z"),
    });

    expect(JSON.parse(await readFile(env.baselineFile, "utf8"))).toEqual({
      version: 2,
      runId,
      approvedAt: "2026-11-03T00:00:00.000Z",
      entries: [{ caseId: "a", pass: true, costUsd: 0.2 }],
    });
  });

  it("refuses to approve a run with no cases, keeping the existing baseline", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const deps = env.deps({ adapter: fakeAdapter() });
    await runEval(env.options(), deps);
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });
    const before = await readFile(env.baselineFile, "utf8");

    await rm(path.join(env.casesDir, "a.yaml"));
    await runEval(env.options(), deps);

    await expect(
      approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).rejects.toThrow(/ran no cases/);
    expect(await readFile(env.baselineFile, "utf8")).toBe(before);
  });

  it("approves a specific run by id", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const deps = env.deps({ adapter: fakeAdapter() });
    const first = await runEval(env.options(), deps);
    await runEval(env.options(), deps);

    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
      runId: first.runId,
    });

    expect(JSON.parse(await readFile(env.baselineFile, "utf8")).runId).toBe(
      first.runId,
    );
  });

  it("a --case run does not report other baseline cases as removed, and approving it merges", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await env.writeCase(answer("b"));
    const deps = env.deps({
      adapter: fakeAdapter(() => ({ finalMessage: "ok" })),
    });
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
    expect(baseline.runId).toBe(filtered.runId);
  });
});
