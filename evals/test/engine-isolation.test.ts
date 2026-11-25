import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CaseValidationError } from "../src/cases/loader.js";
import { EvalSetupError } from "../src/engine/index.js";
import { approveRun } from "../src/report/baseline.js";
import { HostSandbox } from "../src/sandbox/host-sandbox.js";
import { GitWorkspaceManager } from "../src/workspace/workspace.js";
import { fakeAdapter, makeEnv, runEval, type TestEnv } from "./helpers.js";
import type { Evals } from "../src/shared/contracts.js";

/**
 * A sandbox that reports itself as a container but runs on the host, so engine behaviour that
 * depends on isolation can be tested without Docker. Its boxes return a scripted proxy log.
 */
function fakeContainerSandbox(
  log: readonly Evals.Sandbox.NetworkRequest[] = [],
  options: { keep?: boolean; failStart?: string } = {},
) {
  const host = new HostSandbox({ keep: !!options.keep });
  const calls = {
    opened: [] as Evals.Sandbox.OpenOptions[],
    started: [] as (readonly string[])[],
    stopped: 0,
  };
  const provider: Evals.Sandbox.Provider = {
    isolation: "container",
    async start(tools) {
      calls.started.push(tools);
      if (options.failStart) throw new Error(options.failStart);
    },
    async stop() {
      calls.stopped++;
    },
    async open(o) {
      calls.opened.push(o);
      const box = await host.open();
      return Object.assign(Object.create(Object.getPrototypeOf(box)), box, {
        isolation: "container",
        networkLog: async () => log,
      }) as Evals.Sandbox.Box;
    },
  };
  return { provider, calls };
}

function containerDeps(
  env: TestEnv,
  provider: Evals.Sandbox.Provider,
  adapter = fakeAdapter(),
) {
  return env.deps({
    adapters: { fake: adapter },
    workspace: new GitWorkspaceManager({
      skillDir: env.skillDir,
      localTemplatesDir: env.localTemplatesDir,
      sandbox: provider,
    }),
  });
}

const answer = (id: string, network?: unknown): Record<string, unknown> => ({
  id,
  kind: "answer",
  targets: ["fake/m"],
  input: { prompt: id },
  ...(network !== undefined ? { network } : {}),
});

describe("container isolation in the engine", () => {
  it("records the isolation, and hands each case's network setting to the sandbox", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("open"));
    await env.writeCase(answer("offline", false));
    await env.writeCase(answer("extra", { allow: ["example.com"] }));
    const { provider, calls } = fakeContainerSandbox();

    const report = await runEval(env.options(), containerDeps(env, provider));

    expect(report.options.isolation).toBe("container");
    expect(calls.started).toEqual([["fake"]]);
    expect(calls.stopped).toBe(1);
    expect(calls.opened.map((o) => o.network)).toEqual(
      expect.arrayContaining([true, false, { allow: ["example.com"] }]),
    );
    const summary = JSON.parse(
      await readFile(path.join(report.resultsPath, "summary.json"), "utf8"),
    );
    expect(summary.run.options.isolation).toBe("container");
  });

  it("records host for ordinary runs", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );
    expect(report.options.isolation).toBe("host");
  });

  it("puts the proxy log in the run record, the summary and the case report", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("net"));
    const log = [
      { host: "evil.example", allowed: false, count: 2 },
      { host: "github.com", allowed: true, count: 5 },
    ];
    const lines: string[] = [];
    const { provider } = fakeContainerSandbox(log);

    const report = await runEval(env.options(), {
      ...containerDeps(env, provider),
      log: (l) => lines.push(l),
    });

    expect(report.cases[0]!.runs[0]!.network).toEqual(log);
    expect(lines.join("\n")).toContain("blocked by the proxy: evil.example");
    const md = await readFile(
      path.join(report.resultsPath, "reports", "net.md"),
      "utf8",
    );
    expect(md).toContain("**Network** (2 hosts, 1 blocked):");
    expect(md).toContain("| `evil.example` | 2 | ❌ blocked |");
    const summary = JSON.parse(
      await readFile(path.join(report.resultsPath, "summary.json"), "utf8"),
    );
    expect(summary.cases[0].runs[0].network).toEqual(log);
  });

  it("prints how to reopen a kept container workspace", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("kept"));
    const { provider } = fakeContainerSandbox([], { keep: true });

    const report = await runEval(env.options(), containerDeps(env, provider));

    const run = report.cases[0]!.runs[0]!;
    expect(run.workdir).toBeDefined();
    expect(run.reopenCommand).toBe(`npm run eval:shell -- "${run.workdir}"`);
    const md = await readFile(
      path.join(report.resultsPath, "reports", "kept.md"),
      "utf8",
    );
    expect(md).toContain(
      `Reopen it in a runner container: \`${run.reopenCommand}\``,
    );
    await rm(path.dirname(run.workdir!), { recursive: true, force: true });
  });

  it("stops before running anything when the sandbox can't start", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const adapter = fakeAdapter();
    const { provider, calls } = fakeContainerSandbox([], {
      failStart: "Docker is not running",
    });

    await expect(
      runEval(env.options(), containerDeps(env, provider, adapter)),
    ).rejects.toThrow(EvalSetupError);
    expect(adapter.calls).toEqual([]);
    expect(calls.stopped).toBe(1);
  });

  it("rejects a network allow list with anything but host names", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("bad", { allow: ["https://example.com/x"] }));
    await expect(
      runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } })),
    ).rejects.toThrow(CaseValidationError);
  });
});

describe("host and container baselines stay apart", () => {
  it("doesn't compare a container run with a host baseline or host runs", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const lines: string[] = [];
    const hostRun = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });

    const first = await runEval(env.options(), {
      ...containerDeps(env, fakeContainerSandbox().provider),
      log: (l) => lines.push(l),
    });
    expect(first.reference).toEqual({ kind: "none" });
    expect(lines.join("\n")).toContain(
      "baseline.json was approved from a host run",
    );

    const second = await runEval(
      env.options(),
      containerDeps(env, fakeContainerSandbox().provider),
    );
    expect(second.reference).toEqual({
      kind: "previous-run",
      runId: first.runId,
    });

    const hostAgain = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );
    expect(hostAgain.reference).toEqual({
      kind: "baseline",
      runId: hostRun.runId,
    });
  });

  it("approves a container run as a container baseline", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await runEval(
      env.options(),
      containerDeps(env, fakeContainerSandbox().provider),
    );
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });
    const baseline = JSON.parse(await readFile(env.baselineFile, "utf8"));
    expect(baseline.isolation).toBe("container");

    const next = await runEval(
      env.options(),
      containerDeps(env, fakeContainerSandbox().provider),
    );
    expect(next.reference.kind).toBe("baseline");
  });
});

describe("review fixes", () => {
  it("fetches an official template in its own box with the global allowlist, whatever the case's network", async () => {
    const env = await makeEnv();
    await env.writeCase({
      id: "offline-template",
      kind: "task",
      targets: ["fake/m"],
      network: false,
      input: { prompt: "p", template: { official: "ai-web-vanilla" } },
      output: { deterministic: { files: ["/README.md"] } },
    });
    const { provider, calls } = fakeContainerSandbox();
    const workspace = new GitWorkspaceManager({
      skillDir: env.skillDir,
      localTemplatesDir: env.localTemplatesDir,
      sandbox: provider,
      materialize: async (id, target, box) => {
        await box!.writeFile(path.join(target, "README.md"), id);
      },
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() }, workspace }),
    );

    // The run's own box gets the case's network (false); the template box the global allowlist.
    expect(calls.opened.map((o) => o.network).sort()).toEqual([false, true]);
    // A leading slash still means "under the workdir".
    expect(report.cases[0]!.runs[0]!.checks).toContainEqual({
      name: "file /README.md",
      pass: true,
    });
  });

  it("keeps the report when cleanup after the run fails", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    const { provider } = fakeContainerSandbox();
    provider.stop = async () => {
      throw new Error("EBUSY: resource busy");
    };
    const lines: string[] = [];

    const report = await runEval(env.options(), {
      ...containerDeps(env, provider),
      log: (l) => lines.push(l),
    });

    expect(report.cases[0]!.pass).toBe(true);
    expect(lines.join("\n")).toContain(
      "Cleanup after the run failed: EBUSY: resource busy",
    );
  });

  it("refuses a filtered approve that would mix isolations in baseline.json", async () => {
    const env = await makeEnv();
    await env.writeCase(answer("a"));
    await env.writeCase(answer("b"));
    await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );
    await approveRun({
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
    });

    await runEval(
      env.options({ caseId: "a" }),
      containerDeps(env, fakeContainerSandbox().provider),
    );

    await expect(
      approveRun({
        resultsDir: env.resultsDir,
        baselineFile: env.baselineFile,
      }),
    ).rejects.toThrow(/filtered container run.*2 host entries/);
    const baseline = JSON.parse(await readFile(env.baselineFile, "utf8"));
    expect(baseline.entries).toHaveLength(2);
  });
});
