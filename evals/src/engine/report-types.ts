import type { CheckResult } from "../checks/checks.js";
import type { CaseKind } from "../cases/schema.js";
import type { FlowDiff } from "../flow/compare.js";
import type {
  FlowSnapshot,
  JudgeLine,
  StopReason,
  TriggerDetection,
} from "../types.js";

export interface RunRecord {
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
  readonly triggerDetection?: TriggerDetection;
  readonly checks: readonly CheckResult[];
  readonly judge?: readonly JudgeLine[];
  readonly stopReason?: StopReason;
  readonly error?: string;
  readonly costUsd: number | null;
  readonly flow?: FlowSnapshot;
  /** Relative to the run's results folder. */
  readonly transcriptFile?: string;
}

export interface CaseReport {
  readonly caseId: string;
  readonly kind: CaseKind;
  readonly target: string;
  readonly network: boolean;
  /** null when every run was skipped. */
  readonly pass: boolean | null;
  readonly threshold: number;
  readonly ran: number;
  readonly skipped: number;
  readonly passRate: number | null;
  readonly triggerRate: number | null;
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

export type ComparisonStatus =
  "regressed" | "improved" | "unchanged" | "new" | "removed";

export interface CaseComparison {
  readonly caseId: string;
  readonly target: string;
  readonly status: ComparisonStatus;
  readonly passRate: {
    readonly before: number | null;
    readonly after: number | null;
  };
  readonly triggerRate: {
    readonly before: number | null;
    readonly after: number | null;
  };
  /** Majority flow vs. the reference's majority flow; absent when either side has no flows. */
  readonly flowDiff?: FlowDiff;
}

export interface RunReport {
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly options: {
    readonly kind?: string;
    readonly caseId?: string;
    readonly target?: string;
    readonly repeat?: number;
    readonly concurrency: number;
    readonly maxCostUsd?: number;
    readonly withoutSkill: boolean;
  };
  readonly reference: {
    readonly kind: "baseline" | "previous-run" | "none";
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
