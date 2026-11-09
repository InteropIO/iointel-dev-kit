// The contracts shared across the eval engine, in one namespace.
// Import with: import type { Evals } from "../shared/contracts.js";
// Types that are not shared between modules live in shared/types.ts.

export declare namespace Evals {
  /** Normalized key steps an agent took during a run. */
  namespace Flow {
    type TriggerDetection = "skill-tool" | "skill-md-read";

    type Step =
      | {
          readonly kind: "skill-loaded";
          readonly skill: string;
          readonly via: TriggerDetection;
        }
      | { readonly kind: "read"; readonly path: string }
      | { readonly kind: "fetch"; readonly url: string }
      | {
          readonly kind: "script";
          readonly name: string;
          readonly args: readonly string[];
        }
      | {
          readonly kind: "command";
          readonly command: string;
          readonly exitCode: number | null;
        }
      | { readonly kind: "write"; readonly path: string };

    interface Snapshot {
      readonly steps: readonly Step[];
      readonly stopReason: Agent.StopReason;
      readonly turns: number;
      readonly costUsd: number | null;
    }

    /** What a tool-specific extractor reads out of a raw transcript. */
    interface Extraction {
      readonly steps: readonly Step[];
      readonly skillTriggered: boolean;
    }

    /** Repeats grouped by identical flows: indices of the majority group and of the odd runs. */
    interface OddRuns {
      readonly majority: readonly number[];
      readonly odd: readonly number[];
    }

    /** Step-level difference between a reference flow and a current flow. */
    interface Diff {
      readonly added: readonly string[];
      readonly removed: readonly string[];
    }
  }

  /** An agent tool (Claude Code, Codex) driven through an adapter. */
  namespace Agent {
    type StopReason = "done" | "max-turns" | "timeout" | "error";

    interface RunInput {
      readonly prompt: string;
      /** Model from the target; undefined means the adapter's default. */
      readonly model: string | undefined;
      readonly workdir: string;
      readonly network: boolean;
      readonly maxTurns: number;
      readonly timeoutMs: number;
    }

    interface RunResult {
      readonly finalMessage: string;
      /** Raw tool events, saved for debugging and given to the judge. */
      readonly transcript: readonly unknown[];
      readonly skillTriggered: boolean;
      readonly triggerDetection: Flow.TriggerDetection;
      readonly flow: readonly Flow.Step[];
      readonly turns: number;
      /** null when the tool reports no cost and no prices are configured. */
      readonly costUsd: number | null;
      readonly stopReason: StopReason;
      readonly error?: string;
    }

    interface Adapter {
      /** The tool part of a target id, e.g. "claude-code" in "claude-code/claude-sonnet-5-5". */
      readonly tool: string;
      /** Where the skill folder is installed, relative to the workdir. */
      readonly skillInstallPath: string;
      /** Returns an error message when the adapter cannot run (e.g. a missing API key). */
      checkReady(): string | undefined;
      run(input: RunInput): Promise<RunResult>;
    }
  }

  /** Rubric grading of a run's output. */
  namespace Judge {
    interface Input {
      readonly rubric: readonly string[];
      readonly finalMessage: string;
      readonly transcript: readonly unknown[];
      /** Workspace diff, for task cases. */
      readonly diff?: string;
    }

    interface Line {
      readonly text: string;
      readonly pass: boolean;
      readonly reason: string;
      /** Marked "[report-only]" in the rubric: graded and reported, but never affects pass/fail or the score. */
      readonly reportOnly?: boolean;
    }

    interface Result {
      readonly lines: readonly Line[];
      readonly costUsd: number | null;
    }

    interface Grader {
      checkReady(): string | undefined;
      grade(input: Input): Promise<Result>;
    }
  }

  /** The temp folder each run works in. */
  namespace Workspace {
    type Setup =
      | { readonly template: string }
      | { readonly fixture: string }
      | Record<string, never>;

    interface PrepareOptions {
      readonly setup: Setup;
      readonly skillInstallPath: string;
      readonly withSkill: boolean;
    }

    interface Prepared {
      readonly workdir: string;
      /** Changes since the workspace was prepared (lockfiles and the skill folder excluded). */
      diff(): Promise<string>;
      cleanup(): Promise<void>;
    }

    interface Manager {
      prepare(options: PrepareOptions): Promise<Prepared>;
    }

    type TemplateMaterializer = (
      templateId: string,
      target: string,
    ) => Promise<void>;
  }

  /** Shell commands run by task checks. */
  namespace Commands {
    interface Result {
      /** null when the command timed out. */
      readonly exitCode: number | null;
      readonly output: string;
    }

    type Runner = (
      command: string,
      cwd: string,
      timeoutMs: number,
    ) => Promise<Result>;
  }

  /** Case files, after validation and defaults. */
  namespace Cases {
    type Kind = "trigger" | "answer" | "task";

    /** A substring, or a regex written as "/pattern/flags". */
    type Matcher = string;

    interface FlowChecks {
      readonly mustRead: readonly Matcher[];
      readonly mustNotRead: readonly Matcher[];
      readonly mustRun: readonly Matcher[];
    }

    interface Common {
      readonly id: string;
      readonly targets: readonly string[];
      readonly network: boolean;
      readonly prompt: string;
      readonly expectSkill: boolean;
      readonly repeat?: number;
      /** Fraction of runs that must pass, 0..1. */
      readonly passThreshold?: number;
      readonly maxTurns?: number;
      readonly timeoutMs?: number;
      readonly flow?: FlowChecks;
    }

    interface TriggerCase extends Common {
      readonly kind: "trigger";
    }

    interface AnswerCase extends Common {
      readonly kind: "answer";
      readonly mustInclude: readonly Matcher[];
      readonly mustNotInclude: readonly Matcher[];
      readonly rubric?: string;
      /** Share of (non-report-only) rubric lines a run must pass, 0..1. Default 1. */
      readonly rubricThreshold?: number;
    }

    interface TaskChecks {
      readonly files: readonly string[];
      readonly packageJson?: {
        readonly dependencies?: Readonly<Record<string, string>>;
        readonly devDependencies?: Readonly<Record<string, string>>;
      };
      readonly commands: readonly string[];
      readonly reviewRubric?: string;
      /** Share of (non-report-only) review rubric lines a run must pass, 0..1. Default 1. */
      readonly reviewThreshold?: number;
    }

    interface TaskCase extends Common {
      readonly kind: "task";
      readonly setup: Workspace.Setup;
      readonly checks: TaskChecks;
    }

    type Case = TriggerCase | AnswerCase | TaskCase;

    interface Loaded {
      /** Path relative to the cases folder. */
      readonly file: string;
      readonly case: Case;
    }
  }

  namespace Checks {
    interface Result {
      readonly name: string;
      readonly pass: boolean;
      readonly detail?: string;
    }
  }

  /** The engine seam: new EvalEngine(deps).run(options). */
  namespace Engine {
    interface Options {
      readonly casesDir: string;
      readonly resultsDir: string;
      readonly baselineFile: string;
      readonly kind?: Cases.Kind;
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

    /** The options that narrow a run to part of the suite. */
    type Filters = Pick<Options, "kind" | "caseId" | "target">;

    interface Deps {
      readonly adapters: Readonly<Record<string, Agent.Adapter>>;
      readonly judge?: Judge.Grader;
      readonly workspace: Workspace.Manager;
      readonly runCommand?: Commands.Runner;
      readonly now?: () => Date;
      readonly log?: (line: string) => void;
    }
  }

  /** What a run produces (summary.json). */
  namespace Report {
    interface RunRecord {
      readonly caseId: string;
      readonly target: string;
      /** 0-based repeat index. */
      readonly index: number;
      /** false for the skill-removed runs added by --baseline. */
      readonly withSkill: boolean;
      readonly skipped: boolean;
      readonly skipReason?: string;
      readonly pass: boolean;
      readonly triggered: boolean;
      readonly triggerDetection?: Flow.TriggerDetection;
      readonly checks: readonly Checks.Result[];
      readonly judge?: readonly Judge.Line[];
      /** Share of the judged, non-report-only rubric lines that passed, 0..1. Absent when not judged. */
      readonly rubricScore?: number;
      readonly stopReason?: Agent.StopReason;
      readonly error?: string;
      readonly costUsd: number | null;
      readonly flow?: Flow.Snapshot;
      /** Relative to the run's results folder. */
      readonly transcriptFile?: string;
    }

    interface CaseReport {
      readonly caseId: string;
      readonly kind: Cases.Kind;
      readonly target: string;
      readonly network: boolean;
      /** null when every run was skipped. */
      readonly pass: boolean | null;
      readonly threshold: number;
      readonly ran: number;
      readonly skipped: number;
      readonly passRate: number | null;
      readonly triggerRate: number | null;
      /** Mean rubricScore over the runs the judge graded; null when none were graded. */
      readonly rubricScore: number | null;
      readonly costUsd: number;
      readonly costUnknown: boolean;
      /** Repeat indices whose flow differs from the majority. */
      readonly oddRuns: readonly number[];
      readonly runs: readonly RunRecord[];
      /** Present when --baseline was used. */
      readonly withoutSkill?: {
        readonly ran: number;
        readonly passRate: number | null;
        readonly triggerRate: number | null;
        readonly runs: readonly RunRecord[];
      };
    }

    type ComparisonStatus =
      "regressed" | "improved" | "unchanged" | "new" | "removed";

    interface Rates {
      readonly before: number | null;
      readonly after: number | null;
    }

    interface CaseComparison {
      readonly caseId: string;
      readonly target: string;
      readonly status: ComparisonStatus;
      readonly passRate: Rates;
      readonly triggerRate: Rates;
      readonly rubricScore: Rates;
      /** Majority flow vs. the reference's majority flow; absent when either side has no flows. */
      readonly flowDiff?: Flow.Diff;
    }

    interface RunReport {
      readonly runId: string;
      readonly startedAt: string;
      readonly finishedAt: string;
      readonly options: Pick<
        Engine.Options,
        "kind" | "caseId" | "target" | "repeat" | "maxCostUsd"
      > & {
        readonly concurrency: number;
        readonly withoutSkill: boolean;
      };
      readonly reference: {
        readonly kind: Baseline.Reference["kind"];
        readonly runId?: string;
      };
      readonly cases: readonly CaseReport[];
      readonly comparison: readonly CaseComparison[];
      readonly totals: {
        readonly costUsd: number;
        readonly costUnknown: boolean;
        readonly costByTarget: Readonly<Record<string, number>>;
        readonly runs: number;
        readonly skipped: number;
        readonly casesPassed: number;
        readonly casesFailed: number;
      };
      readonly resultsPath: string;
    }
  }

  /** The committed baseline (baseline.json) and what a run is compared against. */
  namespace Baseline {
    interface Entry {
      readonly caseId: string;
      readonly target: string;
      readonly kind: Cases.Kind;
      readonly pass: boolean | null;
      readonly passRate: number | null;
      readonly triggerRate: number | null;
      /** Absent in baselines approved before rubric scores existed. */
      readonly rubricScore?: number | null;
      readonly costUsd: number;
      /** Approved flows, one per with-skill run. */
      readonly flows: readonly (readonly Flow.Step[])[];
    }

    interface File {
      readonly version: 1;
      readonly runId: string;
      readonly approvedAt: string;
      readonly entries: readonly Entry[];
    }

    interface Reference {
      readonly kind: "baseline" | "previous-run" | "none";
      readonly runId?: string;
      readonly entries: readonly Entry[];
    }

    interface CompareOptions {
      /** The run covered only part of the suite: uncovered reference entries are not "removed". */
      readonly filtered: boolean;
    }

    interface ApproveOptions {
      readonly resultsDir: string;
      readonly baselineFile: string;
      /** Defaults to the latest run. */
      readonly runId?: string;
      readonly now?: () => Date;
    }
  }
}
