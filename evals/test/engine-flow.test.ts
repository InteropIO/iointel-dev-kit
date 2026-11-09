import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fakeAdapter, makeEnv, runEval } from "./helpers.js";
import type { Evals } from "../src/shared/contracts.js";

const loaded: Evals.Flow.Step = {
  kind: "skill-loaded",
  skill: "io-intelligence",
  via: "skill-tool",
};
const read = (p: string): Evals.Flow.Step => ({ kind: "read", path: p });

describe("flow snapshots", () => {
  it("records each run flow, flags odd repeats without changing pass/fail, and writes a markdown file", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "routing",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "p" },
    });
    const usual = [
      loaded,
      read("<skill>/references/core.md"),
      read("<skill>/references/mcp-integration.md"),
    ];
    const odd = [
      loaded,
      read("<skill>/references/core.md"),
      read("<skill>/references/custom-ai-web.md"),
    ];
    const adapter = fakeAdapter((_, call) => ({
      flow: call === 1 ? odd : usual,
    }));

    const report = await runEval(
      env.options({ repeat: 3, concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    const c = report.cases[0]!;
    expect(c.pass).toBe(true);
    expect(c.oddRuns).toEqual([1]);
    expect(c.runs[0]!.flow).toEqual({
      steps: usual,
      stopReason: "done",
      turns: 1,
      costUsd: 0.1,
    });
    const md = await readFile(
      path.join(report.resultsPath, "flows", "routing.md"),
      "utf8",
    );
    expect(md).toContain("### Run 2 ✅ ⚠️ odd flow");
    expect(md).toContain("3. read <skill>/references/custom-ai-web.md");
  });

  it("does not flag anything when all repeats took the same route", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "stable",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "p" },
    });

    const report = await runEval(
      env.options({ repeat: 3 }),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    expect(report.cases[0]!.oddRuns).toEqual([]);
  });
});

describe("flow checks", () => {
  it("fails a run when mustRead, mustNotRead or mustRun is violated", async () => {
    const env = await makeEnv();
    const flow = {
      mustRead: ["<skill>/references/core.md", "/mcp-integration\\.md$/"],
      mustNotRead: ["custom-ai-web.md"],
      mustRun: ["/^npm (i|install)\\b/"],
    };
    await env.writeCase({
      id: "ok",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "ok" },
      output: { deterministic: { flow } },
    });
    await env.writeCase({
      id: "bad",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "bad" },
      output: { deterministic: { flow } },
    });
    const good: Evals.Flow.Step[] = [
      loaded,
      read("<skill>/references/core.md"),
      read("<skill>/references/mcp-integration.md"),
      { kind: "command", command: "npm install", exitCode: 0 },
    ];
    const bad: Evals.Flow.Step[] = [
      loaded,
      read("<skill>/references/core.md"),
      read("<skill>/references/custom-ai-web.md"),
    ];
    const adapter = fakeAdapter((input) => ({
      flow: input.prompt === "ok" ? good : bad,
    }));

    const report = await runEval(
      env.options({ concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases.find((c) => c.caseId === "ok")!.pass).toBe(true);
    const failedChecks = report.cases
      .find((c) => c.caseId === "bad")!
      .runs[0]!.checks.filter((c) => !c.pass);
    expect(failedChecks.map((c) => c.name)).toEqual([
      "flow.mustRead /mcp-integration\\.md$/",
      "flow.mustNotRead custom-ai-web.md",
      "flow.mustRun /^npm (i|install)\\b/",
    ]);
  });

  it("matches mustFetch against fetched URLs and download commands only", async () => {
    const env = await makeEnv();
    for (const id of ["webfetch", "curl", "grep-only"])
      await env.writeCase({
        id,
        kind: "trigger",
        targets: ["fake/m"],
        input: { prompt: id },
        output: {
          deterministic: { flow: { mustFetch: ["docs-ai.interop.io"] } },
        },
      });
    const steps: Record<string, Evals.Flow.Step> = {
      webfetch: {
        kind: "fetch",
        url: "https://docs-ai.interop.io/modules/code-mode/overview.md",
      },
      curl: {
        kind: "command",
        command: "curl -s https://docs-ai.interop.io/llms.txt",
        exitCode: 0,
      },
      "grep-only": {
        kind: "command",
        command: "grep -r docs-ai.interop.io .",
        exitCode: 0,
      },
    };
    const adapter = fakeAdapter((input) => ({
      flow: [loaded, steps[input.prompt]!],
    }));

    const report = await runEval(
      env.options({ concurrency: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    const pass = (id: string) =>
      report.cases.find((c) => c.caseId === id)!.pass;
    expect([pass("webfetch"), pass("curl"), pass("grep-only")]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("matches mustRun against skill script steps", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "scaffold",
      kind: "trigger",
      targets: ["fake/m"],
      input: { prompt: "p" },
      output: {
        deterministic: {
          flow: {
            mustRun: [
              "materialize-template --template io-assist-react-packaged",
            ],
          },
        },
      },
    });
    const adapter = fakeAdapter(() => ({
      flow: [
        loaded,
        {
          kind: "script",
          name: "materialize-template",
          args: ["--template", "io-assist-react-packaged", "--target", "."],
        },
      ],
    }));

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(report.cases[0]!.pass).toBe(true);
  });
});
