import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveRun } from "../src/report/baseline.js";
import type { FlowStep } from "../src/types.js";
import { fakeAdapter, makeEnv, runEval } from "./helpers.js";

const loaded: FlowStep = {
  kind: "skill-loaded",
  skill: "io-intelligence",
  via: "skill-tool",
};
const read = (p: string): FlowStep => ({ kind: "read", path: p });

describe("comparison and approve", () => {
  it("has no reference on the very first run", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "p",
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    expect(report.reference).toEqual({ kind: "none" });
    expect(report.comparison).toEqual([]);
  });

  it("falls back to the previous local run when no baseline is committed", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "p",
    });
    const deps = env.deps({
      adapters: {
        fake: fakeAdapter((_, call) => ({ skillTriggered: call === 0 })),
      },
    });

    const first = await runEval(env.options(), deps);
    const second = await runEval(env.options(), deps);

    expect(second.reference).toEqual({
      kind: "previous-run",
      runId: first.runId,
    });
    expect(second.comparison).toEqual([
      expect.objectContaining({
        caseId: "a",
        status: "regressed",
        triggerRate: { before: 1, after: 0 },
      }),
    ]);
  });

  it("compares against the approved baseline: regressions, improvements, new and removed cases", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "keeps",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "keeps",
    });
    await env.writeCase({
      id: "breaks",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "breaks",
    });
    await env.writeCase({
      id: "heals",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "heals",
    });
    await env.writeCase({
      id: "goes-away",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "goes-away",
    });
    let round = 0;
    const adapter = fakeAdapter((input) => ({
      skillTriggered:
        input.prompt === "keeps" ||
        (round === 0 ? input.prompt !== "heals" : input.prompt !== "breaks"),
    }));
    const deps = env.deps({ adapters: { fake: adapter } });

    const first = await runEval(env.options(), deps);
    expect(
      await approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).toBe(first.runId);

    round = 1;
    await env.writeCase({
      id: "brand-new",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "brand-new",
    });
    const { rm } = await import("node:fs/promises");
    await rm(path.join(env.casesDir, "goes-away.yaml"));
    const second = await runEval(env.options(), deps);

    expect(second.reference).toEqual({ kind: "baseline", runId: first.runId });
    const status = Object.fromEntries(
      second.comparison.map((c) => [c.caseId, c.status]),
    );
    expect(status).toEqual({
      keeps: "unchanged",
      breaks: "regressed",
      heals: "improved",
      "brand-new": "new",
      "goes-away": "removed",
    });
  });

  it("approve stores flows in the baseline, and later runs report flow changes without failing", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "routing",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "p",
    });
    let flow: FlowStep[] = [
      loaded,
      read("<skill>/references/core.md"),
      read("<skill>/references/mcp-integration.md"),
    ];
    const deps = env.deps({
      adapters: { fake: fakeAdapter(() => ({ flow })) },
    });

    await runEval(env.options(), deps);
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });
    const baseline = JSON.parse(await readFile(env.baselineFile, "utf8"));
    expect(baseline.entries[0].flows).toEqual([flow]);

    flow = [
      loaded,
      read("<skill>/references/mcp-integration.md"),
      { kind: "command", command: "npm run build", exitCode: 1 },
    ];
    const second = await runEval(env.options(), deps);

    expect(second.cases[0]!.pass).toBe(true);
    expect(second.comparison[0]).toMatchObject({
      status: "unchanged",
      flowDiff: {
        removed: ["read <skill>/references/core.md"],
        added: ["command npm run build → exit 1"],
      },
    });
    const md = await readFile(
      path.join(second.resultsPath, "flows", "routing.md"),
      "utf8",
    );
    expect(md).toContain("**Flow changed from the reference:**");
    expect(md).toContain("`- read <skill>/references/core.md`");
  });

  it("approves a specific run by id", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "a",
      kind: "trigger",
      targets: ["fake/m"],
      prompt: "p",
    });
    const deps = env.deps({ adapters: { fake: fakeAdapter() } });
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
});
