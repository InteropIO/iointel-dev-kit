// The contracts shared across the eval engine, in one namespace.
// Import with: import type { Evals } from "../shared/contracts.js";
// Types that are not shared between modules live in shared/types.ts.

export declare namespace Evals {
  /** The agent tool (Claude Code) driven through an adapter. */
  namespace Agent {
    type StopReason = "done" | "max-turns" | "timeout" | "error";

    interface RunInput {
      readonly prompt: string;
      /** From --model; undefined means the adapter's default. */
      readonly model: string | undefined;
      readonly workdir: string;
      readonly maxTurns: number;
      readonly timeoutMs: number;
    }

    interface RunResult {
      readonly finalMessage: string;
      /** Raw SDK messages, saved for debugging and given to the judge. */
      readonly transcript: readonly unknown[];
      readonly skillTriggered: boolean;
      readonly turns: number;
      /** null when the tool reports no cost. */
      readonly costUsd: number | null;
      readonly stopReason: StopReason;
      readonly error?: string;
    }

    interface Adapter {
      /** The tool's name, used in messages, e.g. "claude-code". */
      readonly name: string;
      /** Where the skill folder is installed, relative to the workdir. Its last segment is the skill name. */
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
    }

    interface Line {
      readonly text: string;
      readonly pass: boolean;
      readonly reason: string;
    }

    interface Result {
      readonly lines: readonly Line[];
      readonly costUsd: number | null;
    }

    interface Grader {
      checkReady(): string | undefined;
      /** Rejects on failure; with a BilledError when the failed call was still paid for. */
      grade(input: Input): Promise<Result>;
    }

    /** A grading failure that happened after the judge had answered, so it still cost money. */
    interface BilledError extends Error {
      readonly costUsd: number;
    }
  }

  /** The temp folder each run works in. */
  namespace Workspace {
    interface PrepareOptions {
      readonly skillInstallPath: string;
    }

    interface Prepared {
      readonly workdir: string;
      cleanup(): Promise<void>;
    }

    interface Manager {
      prepare(options: PrepareOptions): Promise<Prepared>;
    }
  }

  /** Case files, after validation and defaults. Every case is an answer case. */
  namespace Cases {
    /** A substring, or a regex written as "/pattern/flags". */
    type Matcher = string;

    interface Case {
      readonly id: string;
      readonly prompt: string;
      readonly mustInclude: readonly Matcher[];
      readonly mustNotInclude: readonly Matcher[];
      readonly rubric?: string;
    }

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
      readonly caseId?: string;
      /** Undefined means the adapter's default model. */
      readonly model?: string;
      readonly concurrency?: number;
    }

    /** The options that narrow a run to part of the suite. */
    type Filters = Pick<Options, "caseId">;

    interface Deps {
      readonly adapter: Agent.Adapter;
      readonly judge?: Judge.Grader;
      readonly workspace: Workspace.Manager;
      readonly now?: () => Date;
      readonly log?: (line: string) => void;
    }
  }

  /** What a run produces (summary.json). */
  namespace Report {
    /** The one run of one case. */
    interface CaseReport {
      readonly caseId: string;
      /** false when the run failed before the agent could start (e.g. the workspace could not be prepared). */
      readonly ran: boolean;
      readonly pass: boolean;
      readonly skillTriggered: boolean;
      readonly checks: readonly Checks.Result[];
      readonly judge?: readonly Judge.Line[];
      readonly stopReason: Agent.StopReason;
      readonly error?: string;
      /** Agent plus judge; null when the agent reported no cost. 0 when the agent never ran. */
      readonly costUsd: number | null;
      /** Relative to the run's results folder; absent when the agent never ran or the file could not be written. */
      readonly transcriptFile?: string;
    }

    type ComparisonStatus =
      "regressed" | "improved" | "unchanged" | "new" | "removed";

    interface CaseComparison {
      readonly caseId: string;
      readonly status: ComparisonStatus;
      readonly pass: {
        readonly before: boolean | null;
        readonly after: boolean | null;
      };
    }

    interface RunReport {
      readonly runId: string;
      readonly startedAt: string;
      readonly finishedAt: string;
      readonly options: Pick<Engine.Options, "caseId" | "model"> & {
        readonly concurrency: number;
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
        readonly casesPassed: number;
        readonly casesFailed: number;
      };
      readonly resultsPath: string;
    }
  }

  /** The committed baseline (baseline.json) that every run is compared with. */
  namespace Baseline {
    interface Entry {
      readonly caseId: string;
      readonly pass: boolean;
      readonly costUsd: number | null;
    }

    interface File {
      /** 2 since the engine was cut down to answer cases; other versions are rejected. */
      readonly version: 2;
      readonly runId: string;
      readonly approvedAt: string;
      readonly entries: readonly Entry[];
    }

    interface Reference {
      readonly kind: "baseline" | "none";
      readonly runId?: string;
      readonly entries: readonly Entry[];
    }

    interface CompareOptions {
      /** The run covered only part of the suite: uncovered baseline entries are not "removed". */
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
