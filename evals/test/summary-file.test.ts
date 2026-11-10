import { describe, expect, it } from "vitest";
import {
  summaryEntries,
  summaryOptions,
  toSummaryFile,
} from "../src/report/summary-file.js";
import type { Evals } from "../src/shared/contracts.js";

const steps: Evals.Flow.Step[] = [
  { kind: "skill-loaded", skill: "io-intelligence", via: "skill-tool" },
  { kind: "read", path: "<skill>/references/code-mode.md" },
];

const run: Evals.Report.RunRecord = {
  caseId: "add",
  target: "claude-code/claude-sonnet-5-5",
  index: 0,
  withSkill: true,
  skipped: false,
  pass: false,
  triggered: true,
  triggerDetection: "skill-tool",
  checks: [
    { name: "skill triggered", pass: true },
    { name: "command npm run build", pass: false, detail: "exit 1" },
  ],
  judge: [
    { text: "Enables Code Mode", pass: false, reason: "empty diff" },
    { text: "Picks a version", pass: true, reason: "npm view", reportOnly: true },
  ],
  rubricScore: 0,
  stopReason: "done",
  costUsd: 0.5660585,
  flow: { steps, stopReason: "done", turns: 13, costUsd: 0.12 },
  transcriptFile: "transcripts/add__claude-code_claude-sonnet-5-5__1.json",
};

const report: Evals.Report.RunReport = {
  runId: "2026-11-09T12-35-08-609Z",
  startedAt: "2026-11-09T12:35:08.609Z",
  finishedAt: "2026-11-09T12:37:01.589Z",
  options: { caseId: "add", repeat: 1, concurrency: 4, withoutSkill: false },
  reference: { kind: "previous-run", runId: "2026-11-09T11-41-54-246Z" },
  cases: [
    {
      caseId: "add",
      kind: "task",
      target: run.target,
      network: true,
      pass: false,
      threshold: 1,
      ran: 1,
      skipped: 0,
      passRate: 0,
      triggerRate: 1,
      rubricScore: 0.2,
      costUsd: 0.5660585,
      costUnknown: false,
      oddRuns: [],
      runs: [run],
    },
  ],
  comparison: [
    {
      caseId: "add",
      target: run.target,
      status: "regressed",
      passRate: { before: 1, after: 0 },
      triggerRate: { before: 1, after: 1 },
      rubricScore: { before: 1, after: 0.2 },
      flowDiff: { added: ["read x"], removed: ["write y"] },
    },
    {
      caseId: "gone",
      target: run.target,
      status: "removed",
      passRate: { before: 1, after: null },
      triggerRate: { before: 1, after: null },
      rubricScore: { before: null, after: null },
    },
  ],
  totals: {
    costUsd: 0.5660585,
    costUnknown: false,
    costByTarget: { [run.target]: 0.5660585 },
    runs: 1,
    skipped: 0,
    casesPassed: 0,
    casesFailed: 1,
  },
  resultsPath: "/results/2026-11-09T12-35-08-609Z",
};

describe("summary.json", () => {
  const summary = toSummaryFile(report);

  it("puts the run and totals first, with rounded numbers", () => {
    expect(summary.version).toBe(2);
    expect(summary.run).toMatchObject({ id: report.runId, durationSec: 113 });
    expect(summary.run.comparedTo).toEqual(report.reference);
    expect(summary.totals).toEqual({
      verdict: "fail",
      cases: { passed: 0, failed: 1, skipped: 0 },
      runs: { ran: 1, skipped: 0 },
      cost: {
        usd: 0.5661,
        incomplete: false,
        byTarget: { [run.target]: 0.5661 },
      },
    });
  });

  it("embeds the comparison in each case and lists removed cases separately", () => {
    const c = summary.cases[0]!;
    expect(c).toMatchObject({
      id: "add",
      verdict: "fail",
      scores: { pass: 0, trigger: 1, rubric: 0.2 },
      change: {
        status: "regressed",
        before: { pass: 1, trigger: 1, rubric: 1 },
        flow: { added: 1, removed: 1 },
      },
      files: { report: "reports/add.md", flow: "flows/add.md" },
    });
    expect(summary.removed).toEqual([
      {
        id: "gone",
        target: run.target,
        before: { pass: 1, trigger: 1, rubric: null },
      },
    ]);
  });

  it("summarizes each run's checks and judge, with the flow last", () => {
    const r = summary.cases[0]!.runs[0]!;
    expect(r).toMatchObject({
      run: 1,
      verdict: "fail",
      stopReason: "done",
      turns: 13,
      costUsd: 0.5661,
      trigger: { triggered: true, via: "skill-tool" },
      checks: { passed: 1, failed: 1 },
      judge: {
        score: 0,
        results: [
          { criterion: "Enables Code Mode", pass: false, reason: "empty diff" },
          {
            criterion: "Picks a version",
            pass: true,
            reason: "npm view",
            reportOnly: true,
          },
        ],
      },
      files: { transcript: run.transcriptFile },
      flow: steps,
    });
    expect(Object.keys(r).at(-1)).toBe("flow");
  });

  it("reads back the same baseline entries from the new and the old format", () => {
    const fromNew = summaryEntries(summary);
    const fromOld = summaryEntries(report);
    expect(fromNew).toEqual([
      {
        caseId: "add",
        target: run.target,
        kind: "task",
        pass: false,
        passRate: 0,
        triggerRate: 1,
        rubricScore: 0.2,
        costUsd: 0.5661,
        flows: [steps],
      },
    ]);
    expect(fromOld).toEqual([{ ...fromNew[0], costUsd: 0.5660585 }]);
    expect(summaryOptions(summary)).toEqual(summaryOptions(report));
  });
});
