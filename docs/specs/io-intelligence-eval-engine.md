# Spec: io-intelligence skill eval engine (v1)

Status: ready-for-agent

## Problem Statement

We maintain the `io-intelligence` skill, which teaches coding agents how to build, scaffold, extend, explain and diagnose AI assistants in io.Connect with io.Intelligence. Today we have no way to tell whether a change to the skill makes it better or worse. Edits to its description can stop it from triggering. Edits to its references can introduce wrong package names or invented APIs. Edits to its scaffolding guidance can produce projects that don't build. Customers use the skill through different agent tools (Claude Code, Codex), and we can't tell how well it works in each. The only check today is someone trying a few prompts by hand, which is slow, can't be repeated reliably, and can't be compared from one change to the next.

## Solution

A local, on-demand eval engine, kept in this repo next to the skill. It runs a suite of hand-written cases against the working copy of the skill, through the real agent tools our users run. Each target is an agent tool + model pair: Claude Code (through the Claude Agent SDK) running Claude models, and Codex running OpenAI GPT models. It measures three things:

- **Triggering:** does the skill load for prompts that should use it, and stay out of prompts that shouldn't?
- **Answer quality:** are explanations and advice correct? Checked deterministically first (required or forbidden strings and regexes), then by an LLM judge against a rubric, one line at a time.
- **Task success:** when asked to scaffold or extend a project, does the agent produce a project with the right files and dependencies that installs, type-checks and builds, and does a judge's review of the diff pass the case's rubric?

Each case runs several times, because results vary between runs. The engine prints a summary, saves full results and transcripts, and compares the run with a committed baseline, so a skill author can see right away what improved or regressed. An optional comparison mode reruns the cases without the skill, to show how much the skill actually adds.

## User Stories

1. As a skill author, I want to run the whole eval suite with one command, so that I can check a skill change before committing it.
2. As a skill author, I want the eval to use the working copy of the skill in this repo, so that I can test unsaved or branch-specific edits without reinstalling anything.
3. As a skill author, I want each run fully isolated from my own installed skills, plugins, `CLAUDE.md` and MCP servers, so that results are repeatable and the same on every machine.
4. As a skill author, I want to write a case as a short YAML file, so that adding coverage takes minutes and doesn't require reading engine code.
5. As a skill author, I want case files checked against a schema when a run starts, so that a typo fails immediately instead of silently skipping a check.
6. As a skill author, I want trigger cases that state whether the skill should or shouldn't load, so that I can catch descriptions that are too narrow or too broad.
7. As a skill author, I want negative trigger cases (prompts that must not load the skill), so that the skill doesn't take over unrelated requests.
8. As a skill author, I want every answer and task case to also check that the skill triggered, so that a case can't pass on the model's prior knowledge while the skill is ignored.
9. As a skill author, I want to state in answer cases which strings or regexes must and must not appear, so that invented package names and invented APIs are caught for free and with certainty.
10. As a skill author, I want an LLM judge to grade answers against a rubric I write, so that subtler correctness ("explains that io.Assist discovers the tool") is checked too.
11. As a skill author, I want the judge to mark each rubric line pass or fail with a one-line reason, so that I know exactly which expectation was missed and why.
12. As a skill author, I want the judge to see the final output and the transcript, so that it can judge whether the answer was grounded in what the agent actually did.
13. As a skill author, I want task cases to start from a chosen state (an official template, a fixture folder in the repo, or an empty folder), so that I can test both scaffolding from scratch and extending an existing project.
14. As a skill author, I want task cases to check that expected files exist, so that structural mistakes are caught cheaply.
15. As a skill author, I want task cases to check `package.json` for expected `@interopio/*` dependencies, so that wrong or missing packages are caught.
16. As a skill author, I want task cases to run a list of commands (install, type-check, build) and fail on a non-zero exit, so that I know the generated project actually builds.
17. As a skill author, I want a judge to review the task's file changes against a rubric, so that wiring that builds but is wrong is still caught.
18. As a skill author, I want task-case checks to stop at the first failing stage, so that I don't pay for a judge review of a project that doesn't install.
19. As a skill author, I want each case to run several times (three by default), so that a result that varies between runs is visible instead of being hidden by one lucky run.
20. As a skill author, I want trigger cases to pass when at least 2 of 3 runs behave as expected, so that occasional variation doesn't make the suite useless.
21. As a skill author, I want answer and task cases to pass only if every run passes, so that correctness regressions are never hidden.
22. As a skill author, I want to override the repeat count and pass threshold per case, so that I can tune expensive or known-noisy cases.
23. As a skill author, I want each case to state which targets it applies to, so that a case doesn't run where it doesn't make sense.
24. As a skill author, I want the targets field to be required, so that I always make a deliberate choice about where a case runs.
25. As a skill author, I want targets named as tool + model pairs, so that results are never mistaken for a property of the model alone.
26. As a skill author, I want cases to allow network access by default and to be able to turn it off per case, so that I can test the skill as designed (reading the docs site and fetching templates) and also check that the bundled references are enough on their own.
27. As a skill author, I want to run the Claude target with a model I choose by flag (Sonnet 5.5 by default), so that I can test against what users run.
28. As a skill author, I want to run cases against GPT models through Codex, so that I know whether the skill works for Codex users.
29. As a skill author, I want the skill installed where each tool discovers it (the Claude skills folder for Claude Code, the agents skills folder for Codex), so that discovery is tested realistically.
30. As a skill author, I want Claude Code triggering detected from its Skill tool call, so that the trigger signal is exact.
31. As a skill author, I want Codex triggering detected from a read of the skill's `SKILL.md`, and that detection method recorded in the results, so that a Codex trigger rate isn't mistaken for the same kind of signal as Claude's.
32. As a skill author, I want the agent stopped from writing or running commands outside its temp folder, so that a confused agent can't damage my repo or machine.
33. As a skill author, I want the Claude target contained by a permission guard and the Codex target by Codex's own workspace-write sandbox, so that containment works natively on Windows.
34. As a skill author, I want a `--baseline` flag that reruns cases with the skill removed and reports the difference, so that I can show the skill adds value and catch changes that make it worse than no skill.
35. As a skill author, I want to filter a run by case kind, case id or target, so that I can iterate quickly on one area.
36. As a skill author, I want to set repeat count and concurrency from the command line, so that I can trade speed against confidence and stay within rate limits.
37. As a skill author, I want a cost cap in USD that stops the run once it's reached, so that a mistake can't run up a large bill.
38. As a skill author, I want to see the cost per case, per target and for the whole run, so that I can budget and spot expensive cases.
39. As a skill author, I want per-case turn and time limits (40 turns / 10 min for tasks, 15 turns / 3 min for the others, adjustable), so that a stuck agent doesn't block the run.
40. As a skill author, I want a summary table in the console, so that I can read the result at a glance.
41. As a skill author, I want each run saved to its own timestamped results folder with a summary JSON and every transcript, so that I can debug a failure after the run.
42. As a skill author, I want the run compared against a committed baseline, showing per-case and per-target changes (e.g. trigger rate 90% → 60%), so that regressions stand out.
43. As a skill author, I want the comparison to fall back to the latest local run when no baseline is committed, so that comparison works from the first day.
44. As a skill author, I want a command that promotes a run to the committed baseline, so that moving the reference point is a deliberate, reviewable decision.
45. As a teammate on another branch, I want my run compared against the same committed baseline, so that we judge changes against a shared reference.
46. As a skill author, I want the suite to always exit successfully (report only) for now, so that local runs never stop on a failing case; failing on regressions can come later with CI.
47. As a skill author, I want API keys read from a gitignored env file in the eval package, so that credentials never get committed and billing is predictable.
48. As a skill author, I want a clear error when a key for a selected target is missing, so that I don't wait for a run that was always going to fail.
49. As a skill author, I want the judge model fixed (Opus 5.5) whatever the target, so that scores stay comparable between runs and targets.
50. As an engine maintainer, I want all agent tools behind one adapter interface, so that adding OpenCode, Gemini or Copilot later means writing one adapter, not changing the engine.
51. As an engine maintainer, I want engine logic testable with fake adapters and a fake judge, so that I can change the engine without network access or API cost.
52. As an engine maintainer, I want opt-in contract tests for each real adapter and the real judge, so that I find out when an SDK update changes transcript formats or trigger detection.
53. As a skill author, I want the eval package kept separate from the skill folder, so that users who install or link the skill don't get eval code.
54. As a skill author, I want the case schema to leave room for multi-turn cases later, so that adding them won't mean rewriting existing cases.
55. As a skill author, I want a flow snapshot recorded for every run (the ordered key steps the agent took), so that I can see how it reached its answer, not just whether it passed.
56. As a skill author, I want flow snapshots normalized (workdir-relative paths, no timestamps, temp names or message wording), so that two runs that took the same route produce identical snapshots.
57. As a skill author, I want flow snapshots in the same format for Claude Code and Codex, so that I can compare targets on the same case.
58. As a skill author, I want runs whose flow differs from the other repeats of the same case flagged, so that I find corner cases even when every run passed.
59. As a skill author, I want each case's flows compared against the approved flows in the baseline, so that changes like "no longer reads `core.md`" or "now retries the build" stand out after a skill edit.
60. As a skill author, I want flow differences reported but never failing a case on their own, so that normal variation between runs doesn't turn the suite into noise.
61. As a skill author, I want optional per-case flow checks (must read, must not read, must run), so that a corner case I've found becomes a permanent check.
62. As a skill author, I want approved flows committed together with the baseline by the same approve step, so that one reviewable reference covers both results and flows.
63. As a skill author, I want a readable markdown flow file per case in the results folder, showing all runs and targets side by side with odd runs highlighted, so that I can inspect corner cases without opening raw transcripts.
64. As a skill author, I want flow differences summarized in the console output, so that I notice them without opening the flow files.

## Implementation Decisions

**Package and stack**
- A self-contained eval package in this repo (outside the skill folder), with its own dependencies. TypeScript, with Vitest as the test runner for the engine's own tests.
- Runs locally, on demand. No CI in v1.
- Agent runtimes: the Claude Agent SDK for the Claude Code target, and the Codex SDK/CLI for the Codex target. No third-party eval framework (promptfoo and DeepEval were considered and rejected for v1; DeepEval stays an option for judge metrics later).
- Credentials (Anthropic and OpenAI API keys) come from a gitignored env file in the eval package. Subscription logins are not used.

**Modules**
- **Case loader:** discovers case YAML files, validates them against the case schema (Zod), applies defaults, and expands each case × target × repeat into run units. Fails the whole run immediately on any invalid case.
- **Engine (the single test seam):** `runEval(options, deps) → RunReport`, where `deps` supplies the adapters (keyed by tool name) and the judge, plus optional clock and filesystem. It handles filtering, scheduling with concurrency, workspace preparation, adapter calls, checks, judging, aggregation, the cost cap, the baseline comparison and writing results. Everything outside the process comes in through `deps`.
- **Workspace manager:** creates a fresh temp folder per run unit and seeds it from the case's setup (an official template through the skill's own template materializer, a fixture folder, or empty). It installs the working copy of the skill where the target's tool discovers it, removes it for `--baseline` runs, and records the starting state so a diff can be produced at the end.
- **Agent adapters:** one per tool, all implementing the same interface:

  ```ts
  // decision shape, not final code
  interface AgentAdapter {
    tool: 'claude-code' | 'codex';
    skillInstallPath: string;                 // relative to workdir
    run(input: {
      prompt: string; model: string; workdir: string;
      network: boolean; maxTurns: number; timeoutMs: number;
    }): Promise<{
      finalMessage: string;
      transcript: TranscriptEvent[];          // normalized across tools
      skillTriggered: boolean;
      triggerDetection: 'skill-tool' | 'skill-md-read';
      costUsd: number;
      stopReason: 'done' | 'max-turns' | 'timeout' | 'error';
    }>;
  }
  ```

  - **Claude Code adapter:** only the project setting source, so nothing at user level loads. A `canUseTool` guard rejects file writes and Bash commands that point outside the workdir. Triggering is detected from a Skill tool call naming `io-intelligence`.
  - **Codex adapter:** `workspace-write` sandbox limited to the workdir, model chosen per target. Triggering is detected from any command execution that touches the installed skill's `SKILL.md`. This rule lives in exactly one function.
- **Flow extractor:** each adapter maps its tool's raw transcript into a normalized **flow snapshot**, an ordered list of key steps only:

  ```ts
  // decision shape, not final code
  type FlowStep =
    | { kind: 'skill-loaded'; skill: string; via: 'skill-tool' | 'skill-md-read' }
    | { kind: 'read'; path: string }        // skill references and workdir files, workdir/skill-relative
    | { kind: 'fetch'; url: string }        // docs / llms.txt / other web access
    | { kind: 'script'; name: string; args: string[] }   // skill scripts, e.g. the template materializer
    | { kind: 'command'; command: string; exitCode: number }
    | { kind: 'write'; path: string };
  interface FlowSnapshot { steps: FlowStep[]; stopReason: string; turns: number; costUsd: number }
  ```

  Normalization: paths relative to the workdir or the skill root; temp folder names, timestamps, tool-call ids and the wording of the agent's messages are dropped. Searches, directory listings and other minor tool calls are left out of the snapshot (they stay in the full transcript). The extractor is per adapter, because the raw formats differ; the snapshot format is shared.
- **Flow comparer:** compares snapshots in two ways. **Within a run:** the repeats of each case × target are grouped by identical snapshots; runs outside the majority group are flagged as odd. **Against the baseline:** each case × target's snapshots are compared with the approved snapshots, and the differences are reported (steps added or removed, a different reference read, a command's exit code changed, a different order). Flow differences never fail a case.
- **Flow checks (optional, per case):** `mustRead`, `mustNotRead` and `mustRun` match against the flow snapshot (string or regex). A failed flow check fails the run like any other deterministic check.
- **Checkers (deterministic):** answer-case must/must-not include (string or regex) against the final message. Task-case stages, run in order and stopping at the first failure: expected files → `package.json` dependency expectations → command list (non-zero exit fails) → judge review.
- **Judge:** `grade(rubric, output, transcript) → { lines: [{ text, pass, reason }] }`. Fixed to Opus 5.5. Each rubric line gets pass or fail with a one-line reason; there are no numeric scores. For task cases, the output is the final message plus the workspace diff.
- **Reporter:**
  - A console summary table, including a short flow-difference summary (odd runs, and cases whose flow changed from the baseline).
  - A timestamped results folder (gitignored) with a summary JSON, plus the full transcript and flow snapshot for each run unit.
  - One markdown flow file per case, showing every run and target side by side as numbered steps, with odd runs and baseline differences highlighted.
  - A diff against the committed baseline, falling back to the most recent local run.
- **Baseline:** the committed baseline holds both case results and the approved flow snapshots for each case × target. `eval:approve` promotes both together.
- **CLI:** `eval` with `--kind`, `--case`, `--target`, `--repeat` (default 3), `--concurrency` (default 4), `--baseline`, `--max-cost`; plus `eval:approve`, which promotes the latest run to the committed baseline. `--target` filters cases by their declared targets and never overrides them. The process always exits 0 (report only).

**Case schema (decision shape)**

```yaml
id: string                      # unique
kind: trigger | answer | task
targets: [claude-code/<model>, codex/<model>]   # required, non-empty
network: true                   # default true
prompt: string                  # single turn in v1
expectSkill: true               # default true; false = negative trigger case
repeat / passThreshold / maxTurns / timeoutMs: optional per-case overrides
flow:                           # optional, any kind
  mustRead: [string | /regex/]  # e.g. references/core.md
  mustNotRead: [string | /regex/]
  mustRun: [string | /regex/]   # commands or skill scripts
# answer
mustInclude: [string | /regex/]
mustNotInclude: [string | /regex/]
rubric: string                  # one expectation per line
# task
setup: { template: <template id> } | { fixture: <path> } | {}
checks:
  files: [path]
  packageJson: { dependencies: { <name>: <range or "*"> } }
  commands: [string]
  reviewRubric: string
```

**Pass rules**
- Trigger cases pass when at least 2 of 3 runs behave as expected (default threshold, can be overridden per case).
- Answer and task cases pass only if every run passes. A run passes when the trigger expectation holds, every deterministic check passes (including any flow checks), and every judge rubric line passes.
- Flow differences (odd runs, changes from the baseline flow) are reported only and never affect pass or fail.
- `--baseline` runs are reported as a difference against the with-skill runs; they never affect whether a case passes.

**Cost and limits**
- Cost is collected from each adapter. The engine stops starting new run units once `--max-cost` is reached, and marks the units it skipped in the report.
- Defaults: 40 turns / 10 min for task cases, 15 turns / 3 min for the others, adjustable per case.

**Assumptions carried from the design session** (recommended; not explicitly confirmed)
- The case field is named `targets` (tool/model pairs) rather than `models`, and the flag is `--target`.
- The content-only lens (the skill content sent through the raw API with no agent tool) is out of v1.

## Testing Decisions

- **What makes a good test:** tests drive the engine only through `runEval` and check only the `RunReport` and the files written to the results folder. They never assert on internal functions, call order or intermediate data shapes. A refactor that keeps behaviour the same must not break a test.
- **One seam:** `runEval(options, deps)`. Engine tests pass in fake adapters, which return scripted results and, for task cases, write scripted files into the workdir, plus a fake judge with scripted verdicts. Real temp folders and real command execution are used for task checks (with trivial fixture projects), so the checks are tested for real.
- **Behaviours covered by engine tests:**
  - rejecting invalid case files;
  - target, kind and case filtering;
  - expanding cases into repeats;
  - the trigger threshold vs. the every-run-must-pass rule;
  - negative trigger cases;
  - must and must-not include, with strings and regexes;
  - task stages stopping at the first failure;
  - judge results combined into a case result;
  - `--baseline` removing the skill and reporting the difference;
  - the cost cap stopping new units;
  - turn and time limits shown as stop reasons;
  - the baseline diff, the fallback to the latest run, and `eval:approve`;
  - flow snapshots: identical scripted runs give identical snapshots, odd runs are flagged, differences from the baseline flow are reported without changing pass or fail, and flow checks fail a run when violated;
  - the markdown flow file and `eval:approve` storing flows in the baseline;
  - exit code always 0.
- **Flow extractor tests:** each adapter's extractor is tested with recorded raw transcripts from its tool (saved as test data), checking the normalized snapshot it produces. This is the one place below the engine seam that gets direct tests, because tool transcript formats are the most likely thing to break on an SDK update. The contract tests also check that a real run produces a non-empty snapshot that starts with the skill being loaded.
- **Contract tests (opt-in, need API keys, not part of the default test command):** for each real adapter, one positive and one negative trigger case against the real tool. They assert a valid adapter result, correct trigger detection, and that containment blocks a write outside the workdir. For the real judge, one tiny rubric with a known pass line and a known fail line.
- **Prior art:** none. The repo has no tests today. Only the Angular templates include test scaffolding, and it has no spec files.

## Out of Scope

- Checking the running app in io.Connect Desktop or Browser, including any Playwright or browser automation.
- CI integration and failing the process on regressions.
- Adapters for OpenCode, Gemini CLI, Copilot CLI, Cursor or Goose.
- The content-only lens (raw API with the skill content injected) and the model-comparison lens (all models in one agent tool).
- Multi-turn or scripted follow-up cases.
- HTML reports and a web viewer.
- Generated or synthetic test cases; v1 cases are hand-written by the skill owner.
- Distractor skills to test triggering against competition.
- Docker or WSL2 isolation.
- Strict snapshot testing, where any flow difference fails a case.
- Snapshotting every tool call; the full detail stays in the saved transcripts only.

## Further Notes

- Results always describe a tool + model pair, never a model on its own. A worse Codex + GPT result can't be put down to Codex or to GPT without a grid run, which is out of scope.
- The skill expects network access (the docs site, `llms.txt`, and GitHub for template materialization). Network-on cases therefore depend on external availability. A failure that looks network-related should be checked against the transcript before being treated as a skill regression.
- Every template ships with an empty agent server URL. This doesn't affect build checks, but it is one more reason runtime checks are out of scope.
- Template build commands differ: the React templates use the TypeScript build plus Vite, Angular packaged uses the Angular CLI, Angular editable uses a custom build script, and the vanilla template has no build script. Task cases must list the right commands for their starting point.
- Cost depends heavily on task cases (installs and builds over many turns). Start the case set small, around 20–30 cases plus about 10 negative trigger prompts, and grow it.
- Codex trigger detection relies on Codex loading a skill by reading its `SKILL.md`. If a future Codex version exposes an explicit skill event, only the Codex adapter changes.
