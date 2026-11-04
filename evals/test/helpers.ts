import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { EvalEngine } from "../src/engine/index.js";
import { GitWorkspaceManager } from "../src/workspace/workspace.js";
import type { Evals } from "../src/shared/contracts.js";

export const SKILL_INSTALL = ".claude/skills/io-intelligence";

export interface TestEnv {
  root: string;
  casesDir: string;
  resultsDir: string;
  baselineFile: string;
  skillDir: string;
  fixturesDir: string;
  writeCase(c: Record<string, unknown>): Promise<void>;
  writeFixture(name: string, files: Record<string, string>): Promise<void>;
  options(extra?: Partial<Evals.Engine.Options>): Evals.Engine.Options;
  deps(
    extra: Partial<Evals.Engine.Deps> & Pick<Evals.Engine.Deps, "adapters">,
  ): Evals.Engine.Deps;
}

export async function makeEnv(): Promise<TestEnv> {
  const root = await mkdtemp(path.join(os.tmpdir(), "evals-test-"));
  const env = {
    root,
    casesDir: path.join(root, "cases"),
    resultsDir: path.join(root, "results"),
    baselineFile: path.join(root, "baseline.json"),
    skillDir: path.join(root, "skill"),
    fixturesDir: path.join(root, "fixtures"),
  };
  await mkdir(env.casesDir, { recursive: true });
  await mkdir(env.skillDir, { recursive: true });
  await writeFile(
    path.join(env.skillDir, "SKILL.md"),
    "---\nname: io-intelligence\ndescription: test skill\n---\n",
  );

  let clock = Date.parse("2026-11-02T10:00:00.000Z");
  return {
    ...env,
    async writeCase(c) {
      await writeFile(
        path.join(env.casesDir, `${String(c.id)}.yaml`),
        stringify(c),
      );
    },
    async writeFixture(name, files) {
      for (const [file, content] of Object.entries(files)) {
        const full = path.join(env.fixturesDir, name, file);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, content);
      }
    },
    options: (extra = {}) => ({
      casesDir: env.casesDir,
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
      repeat: 1,
      ...extra,
    }),
    deps: (extra) => ({
      workspace: new GitWorkspaceManager({
        skillDir: env.skillDir,
        fixturesDir: env.fixturesDir,
      }),
      // Each run gets a later timestamp, so run ids sort in call order.
      now: () => new Date((clock += 1000)),
      ...extra,
    }),
  };
}

export type Script = (
  input: Evals.Agent.RunInput,
  call: number,
) => Partial<Evals.Agent.RunResult> | Promise<Partial<Evals.Agent.RunResult>>;

export interface FakeAdapter extends Evals.Agent.Adapter {
  calls: Evals.Agent.RunInput[];
}

/** An adapter whose results are scripted per call. Defaults: skill triggered, no steps, $0.10. */
export function fakeAdapter(
  script: Script = () => ({}),
  tool = "fake",
  ready?: string,
): FakeAdapter {
  const calls: Evals.Agent.RunInput[] = [];
  return {
    tool,
    skillInstallPath: SKILL_INSTALL,
    calls,
    checkReady: () => ready,
    async run(input) {
      calls.push(input);
      const scripted = await script(input, calls.length - 1);
      const triggered = scripted.skillTriggered ?? true;
      return {
        finalMessage: "",
        transcript: [],
        skillTriggered: triggered,
        triggerDetection: "skill-tool",
        flow: triggered
          ? [
              {
                kind: "skill-loaded",
                skill: "io-intelligence",
                via: "skill-tool",
              },
            ]
          : [],
        turns: 1,
        costUsd: 0.1,
        stopReason: "done",
        ...scripted,
      };
    },
  };
}

export interface FakeJudge extends Evals.Judge.Grader {
  calls: Evals.Judge.Input[];
}

/** A judge that passes every line unless `failing` matches the line text. */
export function fakeJudge(
  failing: (line: string) => boolean = () => false,
  costUsd: number | null = 0.05,
): FakeJudge {
  const calls: Evals.Judge.Input[] = [];
  return {
    calls,
    checkReady: () => undefined,
    async grade(input): Promise<Evals.Judge.Result> {
      calls.push(input);
      return {
        lines: input.rubric.map((text) => ({
          text,
          pass: !failing(text),
          reason: failing(text) ? "missed" : "ok",
        })),
        costUsd,
      };
    },
  };
}

/** The engine seam, as one call: every engine test goes through it. */
export function runEval(
  options: Evals.Engine.Options,
  deps: Evals.Engine.Deps,
): Promise<Evals.Report.RunReport> {
  return new EvalEngine(deps).run(options);
}
