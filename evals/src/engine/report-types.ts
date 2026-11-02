import type { CheckResult } from '../checks/checks.js';
import type { CaseKind } from '../cases/schema.js';
import type { FlowDiff } from '../flow/compare.js';
import type { FlowSnapshot, JudgeLine, StopReason, TriggerDetection } from '../types.js';

export interface RunRecord {
  caseId: string;
  target: string;
  /** 0-based repeat index. */
  index: number;
  /** false for the skill-removed runs added by --baseline. */
  withSkill: boolean;
  skipped: boolean;
  skipReason?: string;
  pass: boolean;
  triggered: boolean;
  triggerDetection?: TriggerDetection;
  checks: CheckResult[];
  judge?: JudgeLine[];
  stopReason?: StopReason;
  error?: string;
  costUsd: number | null;
  flow?: FlowSnapshot;
  /** Relative to the run's results folder. */
  transcriptFile?: string;
}

export interface CaseReport {
  caseId: string;
  kind: CaseKind;
  target: string;
  network: boolean;
  /** null when every run was skipped. */
  pass: boolean | null;
  threshold: number;
  ran: number;
  skipped: number;
  passRate: number | null;
  triggerRate: number | null;
  costUsd: number;
  costUnknown: boolean;
  /** Repeat indices whose flow differs from the majority. */
  oddRuns: number[];
  runs: RunRecord[];
  /** Present when --baseline was used. */
  withoutSkill?: { ran: number; passRate: number | null; triggerRate: number | null; runs: RunRecord[] };
}

export type ComparisonStatus = 'regressed' | 'improved' | 'unchanged' | 'new' | 'removed';

export interface CaseComparison {
  caseId: string;
  target: string;
  status: ComparisonStatus;
  passRate: { before: number | null; after: number | null };
  triggerRate: { before: number | null; after: number | null };
  /** Majority flow vs. the reference's majority flow; absent when either side has no flows. */
  flowDiff?: FlowDiff;
}

export interface RunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  options: {
    kind?: string;
    caseId?: string;
    target?: string;
    repeat?: number;
    concurrency: number;
    maxCostUsd?: number;
    withoutSkill: boolean;
  };
  reference: { kind: 'baseline' | 'previous-run' | 'none'; runId?: string };
  cases: CaseReport[];
  comparison: CaseComparison[];
  totals: {
    costUsd: number;
    costUnknown: boolean;
    costByTarget: Record<string, number>;
    runs: number;
    skipped: number;
    casesPassed: number;
    casesFailed: number;
  };
  resultsPath: string;
}
