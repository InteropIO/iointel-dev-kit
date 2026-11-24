import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addItems } from "../src/calibration/add-items.js";
import { calibrate } from "../src/calibration/calibrate.js";
import {
  cohenKappa,
  scoreCalibration,
  wilson,
} from "../src/calibration/score.js";
import type { Evals } from "../src/shared/contracts.js";

const LINES = ["Fails closed", "Shows the amount", "Leaves validation intact"];
const RUN_ID = "2026-11-16T13-14-58-413Z";

const grading = (
  source: string,
  verdicts: boolean[],
): Evals.Calibration.Grading => ({
  source,
  lines: new Map(
    LINES.map((l, i) => [l, { pass: verdicts[i]!, reason: `r${i}` }]),
  ),
});
const labels = (verdicts: (boolean | null)[]) =>
  LINES.map((line, i) => ({ line, pass: verdicts[i]!, evidence: `e${i}` }));

describe("scoreCalibration", () => {
  it("counts agreement, false passes and false fails against the human labels", () => {
    const score = scoreCalibration([
      {
        id: "a",
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: labels([false, true, true]),
        gradings: [grading("run 1", [true, true, false])],
      },
      {
        id: "b",
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: labels([false, true, true]),
        gradings: [grading("run 2", [false, true, true])],
      },
    ]);
    expect(score).toMatchObject({
      verdicts: 6,
      agree: 4,
      falsePasses: 1,
      falseFails: 1,
      humanFail: 2,
      humanPass: 4,
      falsePassRate: 0.5,
      falseFailRate: 0.25,
      status: "fail",
    });
    expect(score.disagreements.map((d) => `${d.outcome}: ${d.line}`)).toEqual([
      "false pass: Fails closed",
      "false fail: Leaves validation intact",
    ]);
    expect(score.disagreements[0]).toMatchObject({
      judgeReason: "r0",
      humanEvidence: "e0",
    });
    expect(score.lines[0]).toMatchObject({
      line: "Fails closed",
      falsePasses: 1,
    });
  });

  it("finds lines that flip across replays, and skips unlabelled lines", () => {
    const score = scoreCalibration([
      {
        id: "a",
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: labels([false, true, null]),
        gradings: [
          grading("replay 1", [false, true, true]),
          grading("replay 2", [false, false, true]),
        ],
      },
    ]);
    expect(score.flips).toBe(1);
    expect(score.lines.find((l) => l.line === "Shows the amount")!.flips).toBe(
      1,
    );
    expect(score.unlabelled).toBe(2);
    expect(score.verdicts).toBe(4);
  });

  it("is incomplete when no line is labelled fail: the false-pass rate can't be measured", () => {
    const score = scoreCalibration([
      {
        id: "a",
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: [
          ...labels([true, true, true]),
          { line: "Old wording", pass: true, evidence: "" },
        ],
        gradings: [grading("run 1", [true, true, true])],
      },
    ]);
    expect(score.status).toBe("incomplete");
    expect(score.falsePassRate).toBeNull();
    expect(score.problems.join(" ")).toContain("seeded items");
    expect(score.strayLabels).toEqual([{ item: "a", line: "Old wording" }]);
  });

  it("is incomplete, not pass, when the values meet the targets but the 95% range doesn't", () => {
    const score = scoreCalibration(
      Array.from({ length: 5 }, (_, i) => ({
        id: `i${i}`,
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: labels([false, true, true]),
        gradings: [grading(`run ${i + 1}`, [false, true, true])],
      })),
    );
    expect(score).toMatchObject({
      agreement: 1,
      falsePassRate: 0,
      status: "incomplete",
    });
    // 0 false passes out of 5 human fails: the true rate could still be up to ~43%.
    expect(score.falsePassRateCi!.high).toBeCloseTo(0.4345, 3);
    expect(score.kappa).toBe(1);
    expect(score.problems.join(" ")).toContain(
      "95% range for the false-pass rate",
    );
  });

  it("passes once there are enough labels for the range to clear the targets", () => {
    const score = scoreCalibration(
      Array.from({ length: 80 }, (_, i) => ({
        id: `i${i}`,
        rubric: LINES,
        reportOnly: [],
        critical: [],
        labels: labels([false, true, true]),
        gradings: [grading(`run ${i + 1}`, [false, true, true])],
      })),
    );
    expect(score.falsePassRateCi!.high).toBeLessThan(0.05);
    expect(score.status).toBe("pass");
  });
});

describe("wilson", () => {
  it("gives a sensible range at 0 of n and in the middle", () => {
    expect(wilson(0, 10)!.low).toBe(0);
    expect(wilson(0, 10)!.high).toBeCloseTo(0.2775, 3);
    const mid = wilson(5, 10)!;
    expect(mid.low).toBeCloseTo(0.2366, 3);
    expect(mid.high).toBeCloseTo(0.7634, 3);
    expect(wilson(0, 0)).toBeNull();
  });
});

describe("cohenKappa", () => {
  it("corrects agreement for chance", () => {
    // 90% raw agreement, but most labels are pass: κ is only ~0.61.
    const { kappa, kappaCi } = cohenKappa({
      bothPass: 80,
      judgePassOnly: 8,
      humanPassOnly: 2,
      bothFail: 10,
    });
    expect(kappa).toBeCloseTo(0.6106, 3);
    expect(kappaCi!.low).toBeLessThan(kappa!);
    expect(kappaCi!.high).toBeGreaterThan(kappa!);
  });

  it("is zero for a judge that always says pass, and null when undefined", () => {
    expect(
      cohenKappa({
        bothPass: 90,
        judgePassOnly: 10,
        humanPassOnly: 0,
        bothFail: 0,
      }).kappa,
    ).toBe(0);
    expect(
      cohenKappa({
        bothPass: 10,
        judgePassOnly: 0,
        humanPassOnly: 0,
        bothFail: 0,
      }).kappa,
    ).toBeNull();
  });
});

/** A results folder with one graded run of a case, as an eval run leaves it. */
async function makeRun(
  opts: { workspaceAccess?: boolean; workdir?: string } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "evals-cal-"));
  const dirs = {
    results: path.join(root, "results"),
    cases: path.join(root, "cases"),
    calibration: path.join(root, "calibration"),
  };
  await mkdir(path.join(dirs.results, RUN_ID, "transcripts"), {
    recursive: true,
  });
  await mkdir(dirs.cases, { recursive: true });
  await writeFile(
    path.join(dirs.cases, "pay.json"),
    JSON.stringify({
      id: "pay",
      kind: "task",
      targets: ["fake/m"],
      input: { prompt: "Gate payments", template: { local: "app" } },
      output: {
        judge: {
          rubric: [
            { type: "critical", assertion: LINES[0] },
            { assertion: LINES[1] },
            { type: "report", assertion: LINES[2] },
          ],
          ...(opts.workspaceAccess ? { workspaceAccess: true } : {}),
        },
      },
    }),
  );
  const transcript = "transcripts/pay__fake_m__1.json";
  await writeFile(
    path.join(dirs.results, RUN_ID, transcript),
    JSON.stringify({
      finalMessage: "Done: payments now ask first.",
      diff: "+onToolCall()",
      transcript: [
        {
          type: "assistant",
          message: { content: [{ type: "text", text: "working" }] },
        },
      ],
    }),
  );
  const run = (n: number, judged: boolean) => ({
    run: n,
    verdict: judged ? "pass" : "fail",
    costUsd: 1,
    trigger: { triggered: true },
    checks: { passed: 0, failed: 0, results: [] },
    ...(judged
      ? {
          judge: {
            score: 1,
            results: LINES.map((l, i) => ({
              criterion: l,
              pass: true,
              reason: `judge r${i}`,
              ...(i === 0 ? { type: "critical" } : {}),
              // the summary format from before typed rubrics
              ...(i === 2 ? { reportOnly: true } : {}),
            })),
          },
        }
      : {}),
    files: { transcript, ...(opts.workdir ? { workdir: opts.workdir } : {}) },
  });
  await writeFile(
    path.join(dirs.results, RUN_ID, "summary.json"),
    JSON.stringify({
      version: 2,
      cases: [
        { id: "pay", target: "fake/m", runs: [run(1, true), run(2, false)] },
      ],
    }),
  );
  return dirs;
}

const add = (dirs: Awaited<ReturnType<typeof makeRun>>) =>
  addItems({
    resultsDir: dirs.results,
    casesDir: dirs.cases,
    calibrationDir: dirs.calibration,
    caseId: "pay",
  });

const readJson = async (file: string) =>
  JSON.parse(await readFile(file, "utf8"));
const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

describe("addItems", () => {
  it("freezes each graded run with blank labels, the recorded verdicts and a readable evidence file", async () => {
    const dirs = await makeRun();
    const added = await add(dirs);

    const id = `pay/${RUN_ID}/fake_m__1`;
    expect(added).toEqual([{ id, created: true }]); // run 2 failed before grading
    const dir = path.join(dirs.calibration, id);
    const evidence = await readJson(path.join(dir, "evidence.json"));
    expect(evidence).toMatchObject({
      source: { runId: RUN_ID, caseId: "pay", target: "fake/m", run: 1 },
      rubric: LINES,
      reportOnly: [LINES[2]],
      critical: [LINES[0]],
      diff: "+onToolCall()",
      workspaceAccess: false,
    });
    expect((await readJson(path.join(dir, "labels.json"))).labels).toEqual(
      LINES.map((line) => ({ line, pass: null, evidence: "" })),
    );
    expect((await readJson(path.join(dir, "verdicts.json"))).lines[0]).toEqual({
      line: LINES[0],
      pass: true,
      reason: "judge r0",
    });
    const md = await readFile(path.join(dir, "evidence.md"), "utf8");
    expect(md).toContain("0. Fails closed");
    expect(md).toContain("+onToolCall()");
    expect(md).toMatch(/^## Rubric$/m);
    expect(md).toMatch(/^## Final message$/m);
    expect(md).toMatch(/^## Workspace diff$/m);
    expect(md).toMatch(/^```diff$/m);
    expect(md).toMatch(/^## Transcript$/m);
    expect(md).toMatch(/^### #1 · /m);
    expect(md).not.toMatch(
      /<\/?(rubric|final_message|workspace_diff|transcript)\b/,
    );
    expect(md).not.toContain("judge r0");
  });

  it("never overwrites an existing item, so labels survive", async () => {
    const dirs = await makeRun();
    const [first] = await add(dirs);
    const file = path.join(dirs.calibration, first!.id, "labels.json");
    await writeFile(
      file,
      JSON.stringify({ labels: labels([false, true, true]) }),
    );

    expect(await add(dirs)).toEqual([{ id: first!.id, created: false }]);
    expect((await readJson(file)).labels[0].pass).toBe(false);
  });

  it("copies a kept workspace without node_modules and .git for workspaceAccess cases", async () => {
    const workdir = await mkdtemp(path.join(os.tmpdir(), "evals-cal-wd-"));
    await mkdir(path.join(workdir, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(workdir, "src"), { recursive: true });
    await writeFile(path.join(workdir, "src", "server.ts"), "validate()");
    const dirs = await makeRun({ workspaceAccess: true, workdir });

    const [item] = await add(dirs);
    const ws = path.join(dirs.calibration, item!.id, "workspace");
    expect(item!.workspaceMissing).toBeUndefined();
    expect(await readFile(path.join(ws, "src", "server.ts"), "utf8")).toBe(
      "validate()",
    );
    expect(await exists(path.join(ws, "node_modules"))).toBe(false);
  });

  it("flags a workspaceAccess case whose workspace wasn't kept", async () => {
    const dirs = await makeRun({ workspaceAccess: true });
    const [item] = await add(dirs);
    expect(item!.workspaceMissing).toBe(true);
  });
});

/** A judge that returns fixed verdicts per call, and records what it was given. */
function fakeJudge(
  verdicts: boolean[][],
): Evals.Judge.Grader & { calls: Evals.Judge.Input[] } {
  const calls: Evals.Judge.Input[] = [];
  return {
    calls,
    checkReady: () => undefined,
    async grade(input) {
      const v = verdicts[calls.length] ?? verdicts.at(-1)!;
      calls.push(input);
      return {
        lines: input.rubric.map((text, i) => ({
          text,
          pass: v[i]!,
          reason: `replayed ${i}`,
        })),
        costUsd: 0.1,
      };
    },
  };
}

describe("calibrate", () => {
  it("compares the recorded verdicts for free", async () => {
    const dirs = await makeRun();
    const [item] = await add(dirs);
    await writeFile(
      path.join(dirs.calibration, item!.id, "labels.json"),
      JSON.stringify({ labels: labels([false, true, true]) }),
    );

    const run = await calibrate({ calibrationDir: dirs.calibration });
    expect(run.mode).toBe("recorded");
    expect(run.score).toMatchObject({
      verdicts: 3,
      falsePasses: 1,
      status: "fail",
    });
    // Scored again per <case>/<results-run> folder, for the report kept there.
    expect(run.groups).toHaveLength(1);
    expect(run.groups[0]).toMatchObject({
      id: `pay/${RUN_ID}`,
      score: { verdicts: 3, falsePasses: 1, status: "fail" },
    });
  });

  it("replays the current judge on the frozen evidence, N times", async () => {
    const dirs = await makeRun();
    const [item] = await add(dirs);
    await writeFile(
      path.join(dirs.calibration, item!.id, "labels.json"),
      JSON.stringify({ labels: labels([false, true, true]) }),
    );
    const judge = fakeJudge([
      [false, true, true],
      [false, false, true],
    ]);

    const run = await calibrate({
      calibrationDir: dirs.calibration,
      replay: 2,
      judge,
    });
    expect(judge.calls).toHaveLength(2);
    expect(judge.calls[0]).toMatchObject({
      rubric: LINES,
      finalMessage: "Done: payments now ask first.",
      diff: "+onToolCall()",
    });
    expect(judge.calls[0]!.workdir).toBeUndefined();
    expect(run.costUsd).toBeCloseTo(0.2);
    expect(run.score).toMatchObject({ verdicts: 6, falseFails: 1, flips: 1 });
  });

  it("replays workspaceAccess items with the saved workspace, and skips them when it's missing", async () => {
    const workdir = await mkdtemp(path.join(os.tmpdir(), "evals-cal-wd-"));
    await writeFile(path.join(workdir, "a.ts"), "x");
    const dirs = await makeRun({ workspaceAccess: true, workdir });
    const [item] = await add(dirs);
    const judge = fakeJudge([[true, true, true]]);

    await calibrate({ calibrationDir: dirs.calibration, replay: 1, judge });
    expect(judge.calls[0]!.workdir).toBe(
      path.join(dirs.calibration, item!.id, "workspace"),
    );

    await rm(path.join(dirs.calibration, item!.id, "workspace"), {
      recursive: true,
    });
    const run = await calibrate({
      calibrationDir: dirs.calibration,
      replay: 1,
      judge,
    });
    expect(judge.calls).toHaveLength(1);
    expect(run.score.skipped[0]!.reason).toContain("workspaceAccess");
  });

  it("grades a seeded item (no recorded verdicts) only by replay", async () => {
    const dirs = await makeRun();
    const [item] = await add(dirs);
    await rm(path.join(dirs.calibration, item!.id, "verdicts.json"));

    const run = await calibrate({ calibrationDir: dirs.calibration });
    expect(run.score.skipped[0]!.reason).toContain("--replay");
  });
});
