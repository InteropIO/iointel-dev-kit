import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GitWorkspaceManager } from "../src/workspace/workspace.js";
import {
  fakeAdapter,
  fakeJudge,
  makeEnv,
  runEval,
  SKILL_INSTALL,
} from "./helpers.js";
import type { Evals } from "../src/shared/contracts.js";

const PACKAGE_JSON = JSON.stringify({
  name: "fixture-app",
  scripts: {
    build:
      "node -e \"process.exit(require('fs').existsSync('src/tool.ts') ? 0 : 3)\"",
  },
  dependencies: { react: "^19.0.0" },
});

// `input` is merged over the default input (`template: undefined` starts from an empty folder);
// other overrides (including `output`) replace top-level fields.
const task = (
  id: string,
  { input, ...extra }: { input?: object } & Record<string, unknown> = {},
) => ({
  id,
  kind: "task",
  targets: ["fake/m"],
  ...extra,
  input: {
    prompt: "Add an MCP tool",
    template: { local: "react-app" },
    ...input,
  },
});

/** The fake agent "implements" the task by writing a file and adding a dependency. */
const implementTask = fakeAdapter(async (input) => {
  await mkdir(path.join(input.workdir, "src"), { recursive: true });
  await writeFile(
    path.join(input.workdir, "src", "tool.ts"),
    "export const tool = 1;\n",
  );
  const pkg = JSON.parse(PACKAGE_JSON);
  pkg.dependencies["@interopio/mcp-web"] = "^1.0.0";
  await writeFile(
    path.join(input.workdir, "package.json"),
    JSON.stringify(pkg),
  );
  return { finalMessage: "Added the tool." };
});

describe("task cases", () => {
  it("seeds from a local template, runs structural checks and commands, and gives the judge the diff", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("add-tool", {
        output: {
          deterministic: {
            files: ["src/tool.ts"],
            packageJson: {
              dependencies: { "@interopio/mcp-web": "*", react: "^19.0.0" },
            },
            commands: ["npm run build"],
          },
          judge: { rubric: ["Registers the tool"] },
        },
      }),
    );
    const judge = fakeJudge();
    implementTask.calls.length = 0;

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: implementTask }, judge }),
    );

    const run = report.cases[0]!.runs[0]!;
    expect(
      run.checks.map((c) => `${c.pass ? "ok" : "FAIL"} ${c.name}`),
    ).toEqual([
      "ok skill triggered",
      "ok file src/tool.ts",
      "ok dependencies @interopio/mcp-web@*",
      "ok dependencies react@^19.0.0",
      "ok command npm run build",
    ]);
    expect(report.cases[0]!.pass).toBe(true);
    expect(implementTask.calls[0]).toMatchObject({
      maxTurns: 40,
      timeoutMs: 600_000,
    });
    expect(judge.calls[0]!.diff).toContain("+export const tool = 1;");
    expect(judge.calls[0]!.diff).toContain('"@interopio/mcp-web"');
    expect(judge.calls[0]!.diff).not.toContain(SKILL_INSTALL);
  });

  it("writes a per-case report with checks, judge verdicts, flow, final message and diff", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("reported", {
        output: {
          deterministic: { files: ["src/tool.ts"] },
          judge: {
            rubric: ["Registers the tool", "[report-only] Reuses the client"],
          },
        },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({
        adapters: { fake: implementTask },
        judge: fakeJudge((line) => line === "Reuses the client"),
      }),
    );

    const md = await readFile(
      path.join(report.resultsPath, "reports", "reported.md"),
      "utf8",
    );
    expect(md).toContain("> Add an MCP tool");
    expect(md).toContain('**Template:** `{"local":"react-app"}`');
    expect(md).toContain("## fake/m: PASS");
    expect(md).toContain("- ✅ file src/tool.ts");
    expect(md).toContain("**Judge** (rubric score 100%)");
    expect(md).toContain("- ❌ _[report-only]_ Reuses the client");
    expect(md).toContain("  - missed");
    expect(md).toContain("1. skill-loaded io-intelligence");
    expect(md).toContain("> Added the tool.");
    expect(md).toContain("+export const tool = 1;");
    expect(md).toContain("(../transcripts/reported__fake_m__1.json)");
  });

  it("applies the judge threshold to the rubric score", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("half-review", {
        output: {
          deterministic: { files: ["src/tool.ts"] },
          judge: {
            rubric: ["Registers the tool", "Reuses the client"],
            threshold: 0.5,
          },
        },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({
        adapters: { fake: implementTask },
        judge: fakeJudge((line) => line === "Reuses the client"),
      }),
    );

    expect(report.cases[0]!.runs[0]!.rubricScore).toBe(0.5);
    expect(report.cases[0]!.pass).toBe(true);
  });

  it("stops at the first failing stage: no commands or judge after a missing file", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("missing-file", {
        output: {
          deterministic: {
            files: ["src/missing.ts"],
            commands: ["npm run build"],
          },
          judge: { rubric: ["x"] },
        },
      }),
    );
    const commands: string[] = [];
    const runCommand: Evals.Commands.Runner = async (command) => {
      commands.push(command);
      return { exitCode: 0, output: "" };
    };
    const judge = fakeJudge();

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: implementTask }, judge, runCommand }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(commands).toEqual([]);
    expect(judge.calls).toHaveLength(0);
  });

  it("fails on a non-zero command exit, keeps the output tail and skips the remaining commands", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("broken-build", {
        output: {
          deterministic: { commands: ["npm run build", "echo never"] },
        },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    const checks = report.cases[0]!.runs[0]!.checks;
    expect(checks.at(-1)).toMatchObject({
      name: "command npm run build",
      pass: false,
    });
    expect(checks.at(-1)!.detail).toMatch(/^exit 3/);
    expect(checks.some((c) => c.name === "command echo never")).toBe(false);
  });

  it("reports a package.json dependency with the wrong range", async () => {
    const env = await makeEnv();
    await env.writeLocalTemplate("react-app", { "package.json": PACKAGE_JSON });
    await env.writeCase(
      task("wrong-range", {
        output: {
          deterministic: {
            packageJson: { dependencies: { react: "^18.0.0" } },
          },
        },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    expect(report.cases[0]!.runs[0]!.checks.at(-1)).toMatchObject({
      pass: false,
      detail: "declared as ^19.0.0",
    });
  });

  it("seeds from an official template through the materializer", async () => {
    const env = await makeEnv();
    await env.writeCase(
      task("from-template", {
        input: { template: { official: "io-assist-react-packaged" } },
        output: { deterministic: { files: ["README.md"] } },
      }),
    );
    const materialized: string[] = [];
    const workspace = new GitWorkspaceManager({
      skillDir: env.skillDir,
      localTemplatesDir: env.localTemplatesDir,
      materialize: async (templateId, target) => {
        materialized.push(templateId);
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, "README.md"), templateId);
      },
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() }, workspace }),
    );

    expect(materialized).toEqual(["io-assist-react-packaged"]);
    expect(report.cases[0]!.pass).toBe(true);
  });

  it("starts from an empty folder when there is no template", async () => {
    const env = await makeEnv();
    await env.writeCase(
      task("empty", {
        input: { template: undefined },
        output: { deterministic: { files: ["package.json"] } },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    expect(report.cases[0]!.runs[0]!.checks.at(-1)).toMatchObject({
      name: "file package.json",
      pass: false,
    });
  });

  it("records a workspace setup failure as a failed run", async () => {
    const env = await makeEnv();
    await env.writeCase(
      task("no-template", {
        input: { template: { local: "does-not-exist" } },
      }),
    );

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: fakeAdapter() } }),
    );

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]!.error).toBeTruthy();
  });

  it("removes the temp workdir after the run", async () => {
    const env = await makeEnv();
    await env.writeCase(task("cleanup", { input: { template: undefined } }));
    let workdir = "";
    const adapter = fakeAdapter((input) => {
      workdir = input.workdir;
      return {};
    });

    await runEval(env.options(), env.deps({ adapters: { fake: adapter } }));

    await expect(access(workdir)).rejects.toThrow();
  });

  it("keeps the workdir with --keep-workdirs and reports where it is", async () => {
    const env = await makeEnv();
    await env.writeCase(task("kept", { input: { template: undefined } }));
    let workdir = "";
    const adapter = fakeAdapter((input) => {
      workdir = input.workdir;
      return {};
    });
    const workspace = new GitWorkspaceManager({
      skillDir: env.skillDir,
      localTemplatesDir: env.localTemplatesDir,
      keep: true,
    });

    const report = await runEval(
      env.options(),
      env.deps({ adapters: { fake: adapter }, workspace }),
    );

    await access(workdir);
    expect(report.cases[0]!.runs[0]!.workdir).toBe(workdir);
    const md = await readFile(
      path.join(report.resultsPath, "reports", "kept.md"),
      "utf8",
    );
    expect(md).toContain(`Workspace kept at: \`${workdir}\``);
  });
});
