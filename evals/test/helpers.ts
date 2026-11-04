import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { EvalEngine } from "../src/engine/index.js";
import { TempWorkspaceManager } from "../src/workspace/workspace.js";
import type { Evals } from "../src/shared/contracts.js";

export const SKILL_INSTALL = ".claude/skills/io-intelligence";

export interface TestEnv {
  root: string;
  casesDir: string;
  resultsDir: string;
  baselineFile: string;
  skillDir: string;
  writeCase(c: Record<string, unknown>): Promise<void>;
  options(extra?: Partial<Evals.Engine.Options>): Evals.Engine.Options;
  deps(
    extra: Partial<Evals.Engine.Deps> & Pick<Evals.Engine.Deps, "adapter">,
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
    options: (extra = {}) => ({
      casesDir: env.casesDir,
      resultsDir: env.resultsDir,
      baselineFile: env.baselineFile,
      ...extra,
    }),
    deps: (extra) => ({
      workspace: new TempWorkspaceManager({ skillDir: env.skillDir }),
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

/** An adapter whose results are scripted per call. Defaults: skill triggered, empty answer, $0.10. */
export function fakeAdapter(
  script: Script = () => ({}),
  ready?: string,
): FakeAdapter {
  const calls: Evals.Agent.RunInput[] = [];
  return {
    name: "fake",
    skillInstallPath: SKILL_INSTALL,
    calls,
    checkReady: () => ready,
    async run(input) {
      calls.push(input);
      return {
        finalMessage: "",
        transcript: [],
        skillTriggered: true,
        turns: 1,
        costUsd: 0.1,
        stopReason: "done",
        ...(await script(input, calls.length - 1)),
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
