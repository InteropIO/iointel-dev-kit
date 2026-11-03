import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCases } from "../cases/loader.js";
import type { CaseKind, EvalCase } from "../cases/schema.js";
import {
  checkAnswerText,
  checkFlow,
  checkTaskStructure,
  runTaskCommands,
  type CheckResult,
} from "../checks/checks.js";
import { runShellCommand } from "../checks/command-runner.js";
import { findOddRuns } from "../flow/compare.js";
import {
  compareWithReference,
  isFiltered,
  loadReference,
  SUMMARY_FILE,
} from "../report/baseline.js";
import { renderFlowMarkdown } from "../report/flow-markdown.js";
import type { WorkspaceManager } from "../workspace/workspace.js";
import type {
  AgentAdapter,
  AgentRunResult,
  CommandRunner,
  Judge,
  JudgeLine,
} from "../types.js";
import type { CaseReport, RunRecord, RunReport } from "./report-types.js";

export interface RunEvalOptions {
  readonly casesDir: string;
  readonly resultsDir: string;
  readonly baselineFile: string;
  readonly kind?: CaseKind;
  readonly caseId?: string;
  /** Exact target id, or a tool name to match all of that tool's targets. Filters only. */
  readonly target?: string;
  /** Overrides the default repeat count; a case's own `repeat` still wins. */
  readonly repeat?: number;
  readonly concurrency?: number;
  readonly maxCostUsd?: number;
  /** --baseline: also run every unit with the skill removed. */
  readonly withoutSkill?: boolean;
}

export interface RunEvalDeps {
  readonly adapters: Readonly<Record<string, AgentAdapter>>;
  readonly judge?: Judge;
  readonly workspace: WorkspaceManager;
  readonly runCommand?: CommandRunner;
  readonly now?: () => Date;
  readonly log?: (line: string) => void;
}

export class EvalSetupError extends Error {
  public override readonly name = "EvalSetupError";

  public constructor(message: string) {
    super(message);
  }
}

const DEFAULT_REPEAT = 3;
const DEFAULT_CONCURRENCY = 4;
const TRIGGER_THRESHOLD = 2 / 3;
const LIMITS = {
  task: { maxTurns: 40, timeoutMs: 10 * 60_000 },
  other: { maxTurns: 15, timeoutMs: 3 * 60_000 },
};
const COMMAND_TIMEOUT_MS = 10 * 60_000;

interface Unit {
  readonly case: EvalCase;
  readonly target: string;
  readonly tool: string;
  readonly model: string | undefined;
  readonly index: number;
  readonly withSkill: boolean;
}

export async function runEval(
  options: RunEvalOptions,
  deps: RunEvalDeps,
): Promise<RunReport> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const runCommand = deps.runCommand ?? runShellCommand;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const startedAt = now();
  const runId = startedAt.toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(options.resultsDir, runId);

  const cases = (await loadCases(options.casesDir))
    .map((l) => l.case)
    .filter((c) => !options.kind || c.kind === options.kind)
    .filter((c) => !options.caseId || c.id === options.caseId);

  const units = expandUnits(cases, options);
  preflight(units, deps);

  await mkdir(path.join(runDir, "transcripts"), { recursive: true });
  log(
    `Running ${units.length} run(s) across ${cases.length} case(s), concurrency ${concurrency}.`,
  );

  let spent = 0;
  const records = await runPool(units, concurrency, async (unit) => {
    if (options.maxCostUsd !== undefined && spent >= options.maxCostUsd) {
      return skipped(unit, `cost cap of $${options.maxCostUsd} reached`);
    }
    const record = await runUnit(unit, deps, runCommand, runDir).catch(
      (err: Error) => failed(unit, err.message),
    );
    spent += record.costUsd ?? 0;
    log(
      `${record.pass ? "pass" : "FAIL"}  ${unit.case.id} [${unit.target}] run ${unit.index + 1}${unit.withSkill ? "" : " (without skill)"}`,
    );
    return record;
  });

  const caseReports = aggregate(cases, units, records, options);
  const reference = await loadReference(
    options.baselineFile,
    options.resultsDir,
    runId,
  );
  const comparison = compareWithReference(caseReports, reference, {
    filtered: isFiltered(options),
  });

  const costByTarget: Record<string, number> = {};
  for (const r of records)
    costByTarget[r.target] = (costByTarget[r.target] ?? 0) + (r.costUsd ?? 0);

  const report: RunReport = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: now().toISOString(),
    options: {
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.caseId ? { caseId: options.caseId } : {}),
      ...(options.target ? { target: options.target } : {}),
      ...(options.repeat ? { repeat: options.repeat } : {}),
      concurrency,
      ...(options.maxCostUsd !== undefined
        ? { maxCostUsd: options.maxCostUsd }
        : {}),
      withoutSkill: !!options.withoutSkill,
    },
    reference: {
      kind: reference.kind,
      ...(reference.runId ? { runId: reference.runId } : {}),
    },
    cases: caseReports,
    comparison,
    totals: {
      costUsd: records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
      costUnknown: records.some((r) => !r.skipped && r.costUsd === null),
      costByTarget,
      runs: records.filter((r) => !r.skipped).length,
      skipped: records.filter((r) => r.skipped).length,
      casesPassed: caseReports.filter((c) => c.pass === true).length,
      casesFailed: caseReports.filter((c) => c.pass === false).length,
    },
    resultsPath: runDir,
  };

  await writeFile(
    path.join(runDir, SUMMARY_FILE),
    JSON.stringify(report, null, 2),
  );
  await mkdir(path.join(runDir, "flows"), { recursive: true });
  for (const c of cases) {
    const reports = caseReports.filter((r) => r.caseId === c.id);
    if (!reports.length) continue;
    const md = renderFlowMarkdown(
      c.id,
      reports,
      comparison.filter((x) => x.caseId === c.id),
    );
    await writeFile(path.join(runDir, "flows", `${c.id}.md`), md);
  }
  return report;
}

function parseTarget(target: string): {
  tool: string;
  model: string | undefined;
} {
  const slash = target.indexOf("/");
  return slash === -1
    ? { tool: target, model: undefined }
    : { tool: target.slice(0, slash), model: target.slice(slash + 1) };
}

function expandUnits(cases: EvalCase[], options: RunEvalOptions): Unit[] {
  const units: Unit[] = [];
  for (const c of cases) {
    for (const target of c.targets) {
      const { tool, model } = parseTarget(target);
      if (
        options.target &&
        options.target !== target &&
        options.target !== tool
      )
        continue;
      const repeat = c.repeat ?? options.repeat ?? DEFAULT_REPEAT;
      for (let index = 0; index < repeat; index++) {
        units.push({ case: c, target, tool, model, index, withSkill: true });
        if (options.withoutSkill)
          units.push({ case: c, target, tool, model, index, withSkill: false });
      }
    }
  }
  return units;
}

/** Fails fast, before anything runs, when an adapter or the judge cannot run. */
function preflight(units: Unit[], deps: RunEvalDeps) {
  const problems: string[] = [];
  for (const tool of new Set(units.map((u) => u.tool))) {
    const adapter = deps.adapters[tool];
    if (!adapter)
      problems.push(
        `no adapter for tool "${tool}" (known: ${Object.keys(deps.adapters).join(", ")})`,
      );
    else {
      const notReady = adapter.checkReady();
      if (notReady) problems.push(`${tool}: ${notReady}`);
    }
  }
  if (units.some((u) => needsJudge(u.case))) {
    if (!deps.judge)
      problems.push("some cases have a rubric but no judge is configured");
    else {
      const notReady = deps.judge.checkReady();
      if (notReady) problems.push(`judge: ${notReady}`);
    }
  }
  if (problems.length) throw new EvalSetupError(problems.join("\n"));
}

function needsJudge(c: EvalCase): boolean {
  return (
    (c.kind === "answer" && !!c.rubric?.trim()) ||
    (c.kind === "task" && !!c.checks.reviewRubric?.trim())
  );
}

function rubricLines(rubric: string): string[] {
  return rubric
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function baseRecord(unit: Unit) {
  return {
    caseId: unit.case.id,
    target: unit.target,
    index: unit.index,
    withSkill: unit.withSkill,
    pass: false,
    triggered: false,
    checks: [],
  };
}

function skipped(unit: Unit, reason: string): RunRecord {
  return { ...baseRecord(unit), skipped: true, skipReason: reason, costUsd: 0 };
}

/** A run that failed outside the agent, e.g. the workspace could not be prepared. */
function failed(unit: Unit, error: string): RunRecord {
  return {
    ...baseRecord(unit),
    skipped: false,
    error,
    stopReason: "error",
    costUsd: null,
  };
}

async function runUnit(
  unit: Unit,
  deps: RunEvalDeps,
  runCommand: CommandRunner,
  runDir: string,
): Promise<RunRecord> {
  const c = unit.case;
  const adapter = deps.adapters[unit.tool]!;
  const limits = c.kind === "task" ? LIMITS.task : LIMITS.other;
  const ws = await deps.workspace.prepare({
    setup: c.kind === "task" ? c.setup : {},
    skillInstallPath: adapter.skillInstallPath,
    withSkill: unit.withSkill,
  });

  try {
    let agent: AgentRunResult;
    try {
      agent = await adapter.run({
        prompt: c.prompt,
        model: unit.model,
        workdir: ws.workdir,
        network: c.network,
        maxTurns: c.maxTurns ?? limits.maxTurns,
        timeoutMs: c.timeoutMs ?? limits.timeoutMs,
      });
    } catch (err) {
      agent = {
        finalMessage: "",
        transcript: [],
        skillTriggered: false,
        triggerDetection: "skill-tool",
        flow: [],
        turns: 0,
        costUsd: null,
        stopReason: "error",
        error: (err as Error).message,
      };
    }

    // Skill-removed runs can't trigger the skill, so their trigger expectation is ignored.
    const triggerOk = !unit.withSkill || agent.skillTriggered === c.expectSkill;
    const checks: CheckResult[] = [];
    let judge: readonly JudgeLine[] | undefined;
    let judgeCost: number | null = 0;

    // A run that errored, hit its turn limit or timed out fails, whatever it produced before stopping.
    if (agent.error || agent.stopReason !== "done") {
      checks.push({
        name: "agent finished",
        pass: false,
        detail: agent.error ?? `stopped: ${agent.stopReason}`,
      });
    }
    if (c.kind !== "trigger" && unit.withSkill && c.expectSkill) {
      checks.push({ name: "skill triggered", pass: agent.skillTriggered });
    }
    if (c.kind === "answer")
      checks.push(...checkAnswerText(c, agent.finalMessage));
    checks.push(...checkFlow(c, agent.flow));

    let diff: string | undefined;
    if (c.kind === "task" && checks.every((x) => x.pass)) {
      checks.push(...(await checkTaskStructure(c, ws.workdir)));
      if (checks.every((x) => x.pass))
        checks.push(
          ...(await runTaskCommands(
            c,
            ws.workdir,
            runCommand,
            COMMAND_TIMEOUT_MS,
          )),
        );
      diff = await ws.diff();
    }

    const rubric =
      c.kind === "answer"
        ? c.rubric
        : c.kind === "task"
          ? c.checks.reviewRubric
          : undefined;
    if (rubric?.trim() && deps.judge && checks.every((x) => x.pass)) {
      try {
        const result = await deps.judge.grade({
          rubric: rubricLines(rubric),
          finalMessage: agent.finalMessage,
          transcript: agent.transcript,
          ...(diff !== undefined ? { diff } : {}),
        });
        judge = result.lines;
        judgeCost = result.costUsd;
      } catch (err) {
        // Keep the agent's result (and its cost) when only grading failed.
        checks.push({
          name: "judge",
          pass: false,
          detail: `judge error: ${(err as Error).message}`,
        });
      }
    }

    const pass =
      triggerOk &&
      checks.every((x) => x.pass) &&
      (judge?.every((l) => l.pass) ?? true);
    const costUsd =
      agent.costUsd === null || judgeCost === null
        ? null
        : agent.costUsd + judgeCost;
    const transcriptFile = path.posix.join(
      "transcripts",
      `${c.id}__${unit.target.replace(/[^\w.-]+/g, "_")}__${unit.withSkill ? "" : "noskill-"}${unit.index + 1}.json`,
    );
    const flow = {
      steps: agent.flow,
      stopReason: agent.stopReason,
      turns: agent.turns,
      costUsd: agent.costUsd,
    };
    await writeFile(
      path.join(runDir, transcriptFile),
      JSON.stringify(
        {
          finalMessage: agent.finalMessage,
          flow,
          diff,
          transcript: agent.transcript,
        },
        null,
        2,
      ),
    );

    return {
      caseId: c.id,
      target: unit.target,
      index: unit.index,
      withSkill: unit.withSkill,
      skipped: false,
      pass,
      triggered: agent.skillTriggered,
      triggerDetection: agent.triggerDetection,
      checks,
      ...(judge ? { judge } : {}),
      stopReason: agent.stopReason,
      ...(agent.error ? { error: agent.error } : {}),
      costUsd,
      flow,
      transcriptFile,
    };
  } finally {
    await ws.cleanup();
  }
}

function aggregate(
  cases: EvalCase[],
  units: Unit[],
  records: RunRecord[],
  options: RunEvalOptions,
): CaseReport[] {
  const reports: CaseReport[] = [];
  for (const c of cases) {
    for (const target of new Set(
      units.filter((u) => u.case.id === c.id).map((u) => u.target),
    )) {
      const mine = records.filter(
        (r) => r.caseId === c.id && r.target === target,
      );
      const withSkill = mine.filter((r) => r.withSkill);
      const ran = withSkill.filter((r) => !r.skipped);
      const passRate = rate(ran, (r) => r.pass);
      const threshold =
        c.passThreshold ?? (c.kind === "trigger" ? TRIGGER_THRESHOLD : 1);
      const { odd } = findOddRuns(ran.map((r) => r.flow?.steps ?? []));

      const without = mine.filter((r) => !r.withSkill);
      const ranWithout = without.filter((r) => !r.skipped);
      reports.push({
        caseId: c.id,
        kind: c.kind,
        target,
        network: c.network,
        pass: passRate === null ? null : passRate >= threshold - 1e-9,
        threshold,
        ran: ran.length,
        skipped: withSkill.length - ran.length,
        passRate,
        triggerRate: rate(ran, (r) => r.triggered),
        costUsd: mine.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
        costUnknown: mine.some((r) => !r.skipped && r.costUsd === null),
        oddRuns: odd.map((i) => ran[i]!.index),
        runs: withSkill,
        ...(options.withoutSkill
          ? {
              withoutSkill: {
                ran: ranWithout.length,
                passRate: rate(ranWithout, (r) => r.pass),
                triggerRate: rate(ranWithout, (r) => r.triggered),
                runs: without,
              },
            }
          : {}),
      });
    }
  }
  return reports;
}

function rate(
  records: RunRecord[],
  predicate: (r: RunRecord) => boolean,
): number | null {
  return records.length
    ? records.filter(predicate).length / records.length
    : null;
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}
