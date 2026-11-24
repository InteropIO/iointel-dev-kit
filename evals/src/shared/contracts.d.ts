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

    /** What an odd run did differently from the usual (majority) flow of its repeats. */
    interface OddRun {
      /** The run's 0-based repeat index. */
      readonly index: number;
      /** Steps the odd run took that the usual flow doesn't. */
      readonly added: readonly string[];
      /** Steps of the usual flow the odd run didn't take. */
      readonly removed: readonly string[];
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
      /** The case's scripted answer to the agent's questions, if it has one. */
      readonly reply?: string;
      /** Model from the target; undefined means the adapter's default. */
      readonly model: string | undefined;
      readonly workdir: string;
      /** Where the skill under test is installed, relative to the workdir: <skillsDir>/<skill name>. */
      readonly skillInstallPath: string;
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
      /** The folder the tool discovers skills in, relative to the workdir (e.g. ".claude/skills"). */
      readonly skillsDir: string;
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
      /** Workspace diff, for answer and task cases. */
      readonly diff?: string;
      /**
       * The run's workspace, still on disk while grading. Set only when the case opts in with
       * judge.workspaceAccess: the judge may then read files there to verify lines the diff can't show.
       */
      readonly workdir?: string;
    }

    interface Line {
      readonly text: string;
      readonly pass: boolean;
      readonly reason: string;
      /** The rubric item's type; absent for a standard line (see Cases.RubricType). */
      readonly type?: Cases.RubricType;
    }

    /** How the raw transcript was turned into what the judge reads (see src/judge/compact-transcript.ts). */
    interface TranscriptStats {
      /** Size of the raw transcript as JSON. */
      readonly rawChars: number;
      /** Size of the compact log actually sent. */
      readonly sentChars: number;
      readonly entries: number;
      /** Entries cut to their start and end by the normal per-entry caps. */
      readonly entriesShortened: number;
      /** Entries cut further because the log was over budget (oldest first). */
      readonly entriesTrimmed: number;
      /** The over-budget fallback ran: the judge saw less detail than usual. */
      readonly trimmed: boolean;
    }

    /** Exactly what was sent to the judge model, saved per run as judge/<run>.md. */
    interface Request {
      readonly model: string;
      readonly system: string;
      readonly prompt: string;
      readonly tools: readonly string[];
      /** Set when the judge could read the workspace (judge.workspaceAccess). */
      readonly workdir?: string;
      readonly transcript: TranscriptStats;
    }

    interface Result {
      readonly lines: readonly Line[];
      readonly costUsd: number | null;
      /** What the judge was sent. A grader that doesn't report it gets no judge-input file. */
      readonly request?: Request;
    }

    interface Grader {
      checkReady(): string | undefined;
      grade(input: Input): Promise<Result>;
    }
  }

  /** The temp folder each run works in. */
  namespace Workspace {
    /** An official template fetched by the skill's script, or a project copied from evals/templates/<name>. */
    type Template = { readonly official: string } | { readonly local: string };

    interface PrepareOptions {
      /** Omitted: the run starts in an empty folder. */
      readonly template?: Template;
      readonly skillInstallPath: string;
      readonly withSkill: boolean;
    }

    interface Prepared {
      readonly workdir: string;
      /** true when cleanup() leaves the folder in place (--keep-workdirs). */
      readonly kept?: boolean;
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
      /** Matched against fetched URLs and web searches, and against download commands (curl, wget, iwr…). */
      readonly mustFetch: readonly Matcher[];
    }

    /** What the agent gets: the prompt, and the project it starts in (an empty folder when omitted). */
    interface Input {
      readonly prompt: string;
      readonly template?: Workspace.Template;
      /**
       * What the user answers when the agent asks a question (AskUserQuestion). Every question gets
       * this reply. Without it, questions come back unanswered.
       */
      readonly reply?: string;
    }

    /** Pass/fail checks computed from the run, with no model involved. */
    interface DeterministicChecks {
      /** Whether the skill should load. false makes a negative case. */
      readonly expectSkill: boolean;
      readonly flow?: FlowChecks;
    }

    interface AnswerDeterministicChecks extends DeterministicChecks {
      readonly mustInclude: readonly Matcher[];
      readonly mustNotInclude: readonly Matcher[];
    }

    interface TaskDeterministicChecks extends DeterministicChecks {
      readonly files: readonly string[];
      readonly packageJson?: {
        readonly dependencies?: Readonly<Record<string, string>>;
        readonly devDependencies?: Readonly<Record<string, string>>;
      };
      readonly commands: readonly string[];
    }

    /**
     * How a rubric line counts. Absent: a standard line, counted in the score.
     * "critical": counted in the score, and failing it fails the run whatever the score.
     * "report": graded and reported, never counted and never fails the run.
     */
    type RubricType = "critical" | "report";

    interface RubricItem {
      readonly type?: RubricType;
      /** The claim the judge grades pass or fail. It's all the judge sees of the item. */
      readonly assertion: string;
    }

    /** Checks graded by the judge model: the final message for answer cases, plus the diff for task cases. */
    interface JudgeChecks {
      /** One expectation per item. */
      readonly rubric: readonly RubricItem[];
      /** Share of counted rubric items a run must pass, 0..1. Default 1. */
      readonly threshold?: number;
      /**
       * Let the judge read the finished workspace (read-only: Read, Grep, Glob) as well as the diff.
       * For lines about unchanged or surrounding code ("left intact", "exactly once", "already enables").
       * Costs more per grade. Default false.
       */
      readonly workspaceAccess?: boolean;
    }

    interface Common {
      readonly id: string;
      /** Free-text note for humans (where the case came from, what it expects). Ignored by the engine. */
      readonly note?: string;
      readonly targets: readonly string[];
      readonly network: boolean;
      readonly repeat?: number;
      /** Fraction of runs that must pass, 0..1. */
      readonly passThreshold?: number;
      readonly maxTurns?: number;
      readonly timeoutMs?: number;
      readonly input: Input;
    }

    interface TriggerCase extends Common {
      readonly kind: "trigger";
      readonly output: { readonly deterministic: DeterministicChecks };
    }

    interface AnswerCase extends Common {
      readonly kind: "answer";
      readonly output: {
        readonly deterministic: AnswerDeterministicChecks;
        readonly judge?: JudgeChecks;
      };
    }

    interface TaskCase extends Common {
      readonly kind: "task";
      readonly output: {
        readonly deterministic: TaskDeterministicChecks;
        readonly judge?: JudgeChecks;
      };
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
      /**
       * Not checked, so it can't fail: a flow check on the skill's own files, in a run without
       * the skill (--without-skill). pass is true so it doesn't decide the run.
       */
      readonly skipped?: true;
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
      /** --without-skill: also run every unit with the skill removed. */
      readonly withoutSkill?: boolean;
    }

    /** The options that narrow a run to part of the suite. */
    type Filters = Pick<Options, "kind" | "caseId" | "target">;

    interface Deps {
      readonly adapters: Readonly<Record<string, Agent.Adapter>>;
      /** Name of the skill under test (SKILL.md frontmatter name): its install folder and what triggering means. */
      readonly skillName: string;
      /**
       * The skill folder's files, relative and with "/" (e.g. "references/core.md"). Skill-removed
       * runs skip the flow checks that point at them. Without it, every flow check runs.
       */
      readonly skillFiles?: readonly string[];
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
      /** false for the skill-removed runs added by --without-skill. */
      readonly withSkill: boolean;
      readonly skipped: boolean;
      readonly skipReason?: string;
      readonly pass: boolean;
      readonly triggered: boolean;
      readonly triggerDetection?: Flow.TriggerDetection;
      readonly checks: readonly Checks.Result[];
      readonly judge?: readonly Judge.Line[];
      /** Share of the judged, counted (non-"report") rubric lines that passed, 0..1. Absent when not judged. */
      readonly rubricScore?: number;
      readonly stopReason?: Agent.StopReason;
      readonly error?: string;
      readonly costUsd: number | null;
      readonly flow?: Flow.Snapshot;
      /** Relative to the run's results folder. */
      readonly transcriptFile?: string;
      /** Exactly what the judge was sent, relative to the run's results folder. Absent when not judged. */
      readonly judgeInputFile?: string;
      /** The judge's transcript was trimmed beyond the normal per-entry caps because it was over budget. */
      readonly judgeTranscriptTrimmed?: true;
      /** Absolute path of the run's workspace, set only when it was kept (--keep-workdirs). */
      readonly workdir?: string;
    }

    interface CaseReport {
      readonly caseId: string;
      readonly kind: Cases.Kind;
      readonly target: string;
      /** The message sent to the agent, and the simulated user reply when the case has one. */
      readonly prompt: string;
      readonly reply?: string;
      readonly network: boolean;
      /** null when every run was skipped. */
      readonly pass: boolean | null;
      readonly threshold: number;
      /** Share of counted rubric lines a run must pass; null when the case has no rubric. */
      readonly rubricThreshold: number | null;
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
      /** For each odd run, how its flow differs from the majority flow. */
      readonly oddFlows: readonly Flow.OddRun[];
      readonly effort: Effort;
      readonly runs: readonly RunRecord[];
      /** Present when --without-skill was used. */
      readonly withoutSkill?: {
        readonly ran: number;
        readonly passRate: number | null;
        readonly triggerRate: number | null;
        readonly effort: Effort;
        readonly runs: readonly RunRecord[];
      };
    }

    /**
     * What a run cost the agent, averaged over the runs that ran: compared with and without the
     * skill, it shows whether the skill makes the agent work less. Each field is null when no run
     * reported it. Turns are counted per tool (Codex counts tool items), so compare within a target.
     */
    interface Effort {
      readonly turns: number | null;
      /** The agent's own shell commands that exited non-zero; not the case's `commands` checks. */
      readonly failedCommands: number | null;
      readonly costUsd: number | null;
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
        /** With-skill runs that passed / failed. runs = runsPassed + runsFailed + runsWithoutSkill. */
        readonly runsPassed: number;
        readonly runsFailed: number;
        /** Skill-removed runs added by --without-skill; they never affect pass or fail. */
        readonly runsWithoutSkill: number;
        readonly skipped: number;
        readonly casesPassed: number;
        readonly casesFailed: number;
      };
      readonly resultsPath: string;
    }
  }

  /**
   * The summary.json file format: the RunReport reshaped for reading. Grouped per case, then per
   * run, with the verdict and scores first and long details (flow steps) last.
   */
  namespace Summary {
    type Verdict = "pass" | "fail" | "skipped";

    /** Shares 0..1; null when nothing was measured. */
    interface Scores {
      readonly pass: number | null;
      readonly trigger: number | null;
      readonly rubric: number | null;
    }

    interface File {
      readonly version: 2;
      readonly run: {
        readonly id: string;
        readonly startedAt: string;
        readonly finishedAt: string;
        readonly durationSec: number;
        readonly options: Report.RunReport["options"];
        readonly comparedTo: Report.RunReport["reference"];
        readonly resultsPath: string;
      };
      readonly totals: {
        /** "fail" when any case failed. */
        readonly verdict: Verdict;
        readonly cases: {
          readonly passed: number;
          readonly failed: number;
          readonly skipped: number;
        };
        /**
         * ran = passed + failed + withoutSkill. passed/failed count the with-skill runs, which decide
         * the verdict; withoutSkill (only with --without-skill) counts the skill-removed runs.
         */
        readonly runs: {
          readonly ran: number;
          readonly passed: number;
          readonly failed: number;
          readonly withoutSkill?: number;
          readonly skipped: number;
        };
        readonly cost: {
          readonly usd: number;
          /** true when some run's cost was not reported, so usd is a lower bound. */
          readonly incomplete: boolean;
          readonly byTarget: Readonly<Record<string, number>>;
        };
      };
      readonly cases: readonly Case[];
      /** Reference cases this (unfiltered) run no longer has. */
      readonly removed: readonly {
        readonly id: string;
        readonly target: string;
        readonly before: Scores;
      }[];
    }

    interface Case {
      readonly id: string;
      readonly kind: Cases.Kind;
      readonly target: string;
      /** The message sent to the agent, and the simulated user reply when the case has one. */
      readonly prompt: string;
      readonly reply?: string;
      readonly verdict: Verdict;
      readonly scores: Scores;
      /** Share of runs that must pass. */
      readonly passThreshold: number;
      /** Share of counted rubric lines a run must pass (scores.rubric is compared to it); null when the case has no rubric. */
      readonly rubricThreshold: number | null;
      readonly ran: number;
      readonly skipped: number;
      readonly network: boolean;
      readonly costUsd: number;
      /** Against the reference run or baseline; absent when there is none. */
      readonly change?: {
        readonly status: Report.ComparisonStatus;
        readonly before: Scores;
        /** How many majority-flow steps were added and removed; the steps are in files.flow. */
        readonly flow?: { readonly added: number; readonly removed: number };
      };
      /** 1-based run numbers whose flow differs from the majority. */
      readonly oddRuns: readonly number[];
      /** What each odd run did differently: steps added to and missing from the usual flow. */
      readonly oddFlows?: readonly {
        readonly run: number;
        readonly added: readonly string[];
        readonly removed: readonly string[];
      }[];
      /** Mean turns, failed agent commands and cost per run. */
      readonly effort: Report.Effort;
      /** Relative to the run's results folder. */
      readonly files: { readonly report: string; readonly flow: string };
      readonly runs: readonly Run[];
      /** Present when --without-skill was used: the same case with the skill removed. */
      readonly withoutSkill?: {
        readonly ran: number;
        readonly scores: Pick<Scores, "pass" | "trigger">;
        readonly effort: Report.Effort;
        readonly runs: readonly Run[];
      };
    }

    interface Run {
      /** 1-based. */
      readonly run: number;
      readonly verdict: Verdict;
      readonly skipReason?: string;
      readonly error?: string;
      readonly stopReason?: Agent.StopReason;
      readonly turns?: number;
      readonly costUsd: number | null;
      readonly trigger: {
        readonly triggered: boolean;
        readonly via?: Flow.TriggerDetection;
      };
      readonly checks: {
        readonly passed: number;
        readonly failed: number;
        /** Present when some checks were skipped (skill-file flow checks in a run without the skill). */
        readonly skipped?: number;
        readonly results: readonly Checks.Result[];
      };
      readonly judge?: {
        /** Share of graded, counted (non-"report") lines that passed. */
        readonly score: number | null;
        readonly results: readonly {
          readonly criterion: string;
          readonly pass: boolean;
          readonly reason: string;
          readonly type?: Cases.RubricType;
        }[];
      };
      readonly files: {
        readonly transcript?: string;
        /** Exactly what the judge was sent: system prompt, prompt with the compact transcript, tools. */
        readonly judgeInput?: string;
        /** Kept workspace (--keep-workdirs). */
        readonly workdir?: string;
      };
      /** Key steps the agent took; absent when the agent did not run to completion. */
      readonly flow?: readonly Flow.Step[];
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

  /**
   * The judge calibration set (evals/calibration/, docs/judge-governance.md §5.1): graded runs
   * frozen with a human's verdict per rubric line, to measure how often the judge agrees.
   */
  namespace Calibration {
    /** evidence.json: what the judge grades, frozen from one graded run. */
    interface Evidence {
      readonly version: 1;
      readonly source: {
        readonly runId: string;
        readonly caseId: string;
        readonly target: string;
        /** 1-based, as numbered in summary.json. */
        readonly run: number;
      };
      /** Why the item exists, e.g. the mistake planted in a seeded copy. */
      readonly note?: string;
      readonly rubric: readonly string[];
      /** Lines of type "report" in the case when the item was added. */
      readonly reportOnly: readonly string[];
      /** Lines of type "critical" in the case when the item was added. */
      readonly critical: readonly string[];
      readonly finalMessage: string;
      readonly diff?: string;
      readonly transcript: readonly unknown[];
      /** The case had judge.workspaceAccess: replay needs the item's workspace/ folder. */
      readonly workspaceAccess: boolean;
    }

    /** One human verdict in labels.json; pass is null until labelled. */
    interface Label {
      readonly line: string;
      readonly pass: boolean | null;
      readonly evidence: string;
    }

    interface Labels {
      readonly labelledBy: string;
      readonly labels: readonly Label[];
    }

    /** verdicts.json: the judge's verdicts from the original run. */
    interface RecordedVerdicts {
      readonly runId: string;
      readonly lines: readonly {
        readonly line: string;
        readonly pass: boolean;
        readonly reason: string;
      }[];
    }

    interface Item {
      /** The folder relative to the calibration folder: "<case-id>/<results-run-id>/<target>__<n>". */
      readonly id: string;
      readonly dir: string;
      readonly evidence: Evidence;
      readonly labels: Labels;
      /** Absent for seeded items, which only replay can grade. */
      readonly recorded?: RecordedVerdicts;
    }

    interface AddOptions {
      readonly resultsDir: string;
      readonly casesDir: string;
      readonly calibrationDir: string;
      readonly caseId: string;
      /** Defaults to the latest run. */
      readonly runId?: string;
      readonly target?: string;
      /** Only this run number (1-based). */
      readonly run?: number;
    }

    interface Added {
      readonly id: string;
      /** False when the item already existed: it is left alone, so labels are never overwritten. */
      readonly created: boolean;
      /** The case uses workspaceAccess but the run's workspace wasn't kept. */
      readonly workspaceMissing?: true;
    }

    /** One grading of an item: the original run's verdicts, or one replay. */
    interface Grading {
      /** "run 2 (<run-id>)" or "replay 1". */
      readonly source: string;
      /** Verdict per rubric line text. */
      readonly lines: ReadonlyMap<
        string,
        { readonly pass: boolean; readonly reason: string }
      >;
      readonly error?: string;
    }

    interface ItemGradings {
      readonly id: string;
      readonly rubric: readonly string[];
      readonly reportOnly: readonly string[];
      readonly critical: readonly string[];
      readonly labels: readonly Label[];
      readonly gradings: readonly Grading[];
      /** Why the item has no gradings, e.g. a seeded item without --replay. */
      readonly skipped?: string;
    }

    type Outcome = "agree" | "false pass" | "false fail";

    interface Disagreement {
      readonly item: string;
      readonly line: string;
      readonly source: string;
      readonly outcome: Exclude<Outcome, "agree">;
      readonly judgeReason: string;
      readonly humanEvidence: string;
    }

    interface LineStats {
      readonly line: string;
      readonly reportOnly: boolean;
      readonly critical: boolean;
      readonly verdicts: number;
      readonly falsePasses: number;
      readonly falseFails: number;
      /** Items where repeated gradings of the same input disagreed with each other. */
      readonly flips: number;
    }

    interface Interval {
      readonly low: number;
      readonly high: number;
    }

    interface Targets {
      readonly minAgreement: number;
      readonly maxFalsePassRate: number;
      readonly maxFalseFailRate: number;
    }

    interface Score {
      readonly items: number;
      readonly gradings: number;
      readonly verdicts: number;
      readonly agree: number;
      readonly falsePasses: number;
      readonly falseFails: number;
      /** Verdicts labelled pass / fail: the denominators of the two rates. */
      readonly humanPass: number;
      readonly humanFail: number;
      readonly agreement: number | null;
      /** False passes ÷ verdicts the human failed; null when no line is labelled fail. */
      readonly falsePassRate: number | null;
      readonly falseFailRate: number | null;
      /** 95% Wilson intervals for the three rates; null when the rate is. */
      readonly agreementCi: Interval | null;
      readonly falsePassRateCi: Interval | null;
      readonly falseFailRateCi: Interval | null;
      /** Cohen's κ, judge vs human: agreement beyond chance. Null when undefined (no verdicts, or one answer only on both sides). */
      readonly kappa: number | null;
      readonly kappaCi: Interval | null;
      readonly unlabelled: number;
      /** The judge returned no verdict for a labelled line. */
      readonly missing: number;
      readonly flips: number;
      /** Worst first. */
      readonly lines: readonly LineStats[];
      readonly disagreements: readonly Disagreement[];
      readonly skipped: readonly {
        readonly item: string;
        readonly reason: string;
      }[];
      readonly errors: readonly {
        readonly item: string;
        readonly source: string;
        readonly error: string;
      }[];
      /** Labels whose line isn't in the item's rubric (a reworded line, or a typo). */
      readonly strayLabels: readonly {
        readonly item: string;
        readonly line: string;
      }[];
      /** Against the targets; "incomplete" when a rate can't be measured yet. */
      readonly status: "pass" | "fail" | "incomplete";
      readonly problems: readonly string[];
    }

    interface Options {
      readonly calibrationDir: string;
      /** Only items whose id contains this text. */
      readonly filter?: string;
      /** Grade each item this many times with the judge, instead of using the recorded verdicts. */
      readonly replay?: number;
      readonly judge?: Judge.Grader;
      readonly concurrency?: number;
      readonly log?: (line: string) => void;
    }

    interface Run {
      /** All the items together: the gate. */
      readonly score: Score;
      /** The same, per "<case-id>/<results-run-id>" folder: each gets its own report there. */
      readonly groups: readonly GroupScore[];
      readonly mode: "recorded" | "replay";
      readonly costUsd: number;
    }

    interface GroupScore {
      readonly id: string;
      readonly score: Score;
      readonly costUsd: number;
    }
  }
}
