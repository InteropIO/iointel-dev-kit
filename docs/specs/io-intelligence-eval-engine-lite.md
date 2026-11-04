# Spec: io-intelligence eval engine, simplified (answer cases on Claude Code only)

Status: ready for implementation. Supersedes the scope of [io-intelligence-eval-engine.md](io-intelligence-eval-engine.md), which describes the full engine this cuts down.

## Problem Statement

The eval engine for the `io-intelligence` skill does far more than a skill author needs today, and that makes it hard to understand, change, or trust. It supports three case kinds (trigger, answer, task), two agent tools (Claude Code and Codex), repeated runs with pass thresholds, flow snapshots with odd-run detection and flow diffs, flow checks, skill-removed comparison runs, cost caps, and two different things both called "baseline". A developer who wants to check that the skill gives correct answers has to learn the whole machine first, and the README has to explain all of it.

The thing actually needed right now is narrower: send a question to Claude Code with the skill installed, check the answer, have a judge grade it against a rubric, and tell me whether that changed since the last approved run.

## Solution

Cut the engine down to one kind of case (an answer case), one agent tool (Claude Code), and one run per case. Each case is a prompt plus optional text checks and an optional rubric. A run:

1. creates a temp folder and copies the working copy of the skill into it where Claude Code discovers skills;
2. runs Claude Code on the prompt, with the chosen model, contained to that folder;
3. checks, in order and stopping at the first failure: the agent finished; the skill triggered; `mustInclude` / `mustNotInclude` against the final message;
4. only if those all pass and the case has a rubric, asks the judge (Opus 5.5) to grade each rubric line from the final message and the transcript;
5. passes only when every check and every rubric line passes.

Results are compared with one committed `baseline.json` (pass and cost per case), reported as regressed / improved / new / removed. Approving a run writes that file.

The README is rewritten for the smaller engine and explains how a case runs, how the judge prompt is built, how the tests are set up, and how the baseline works.

## User Stories

1. As a skill author, I want a case to be just an id, a prompt, optional text checks and an optional rubric, so that I can write one without learning a schema of a dozen fields.
2. As a skill author, I want an invalid case file (unknown field, missing prompt, bad regex) to stop the run with a message naming the file and field, so that typos don't silently change what is tested.
3. As a skill author, I want old fields (`kind`, `targets`, `repeat`, `passThreshold`, `flow`, `expectSkill`, `network`, `maxTurns`, `timeoutMs`, `setup`, `checks`) to be rejected as unknown, so that stale cases fail loudly instead of being half-honoured.
4. As a skill author, I want each case to run exactly once, so that results are simple to read and runs cost less.
5. As a skill author, I want the case to fail if the skill did not load, so that a correct answer from the model's prior knowledge alone doesn't count.
6. As a skill author, I want `mustInclude` to check that a string or regex appears in the final answer, so that I can cheaply require exact package names.
7. As a skill author, I want `mustNotInclude` to check that a string or regex does not appear, so that I can cheaply catch invented package names.
8. As a skill author, I want plain strings to be case-sensitive substrings and `/pattern/flags` to be regexes, so that the matcher syntax stays the same as before.
9. As a skill author, I want to write a rubric as a list of lines, so that each requirement is graded on its own.
10. As a skill author, I want list markers (`-`, `*`, `1.`) stripped from rubric lines, so that I can write the rubric as natural YAML.
11. As a skill author, I want the judge to see the transcript as well as the final answer, so that lines like "does not invent APIs" or "uses the bundled reference" can be checked against what the agent actually read.
12. As a skill author, I want a one-line reason for every rubric verdict, so that I can see why a line failed without opening the transcript.
13. As a skill author, I want the judge to be skipped when a cheaper check already failed, so that I don't pay for grading a run that already failed.
14. As a skill author, I want a case without a rubric to be decided by the cheap checks alone, so that simple cases cost nothing beyond the agent run.
15. As a skill author, I want a rubric line the judge didn't answer to count as failed, so that a partial verdict never passes a run.
16. As a skill author, I want a judge refusal or API error to fail the run with a "judge" check while keeping the agent's answer and cost, so that I can still inspect what happened.
17. As a skill author, I want to choose the model with `--model` (default `claude-sonnet-5-5`), so that I can check the skill on another model without editing cases.
18. As a skill author, I want to run a single case with `--case <id>`, so that I can iterate on one case quickly.
19. As a skill author, I want to set `--concurrency`, so that I can trade speed against rate limits.
20. As a skill author, I want every run to use fixed limits (15 turns, 3 minutes), so that I don't have to think about limits per case.
21. As a skill author, I want a run that errors, hits the turn limit or times out to fail, so that a half-finished answer never passes.
22. As a skill author, I want the agent to see only the skill under test and nothing from my machine (no user skills, plugins, CLAUDE.md or MCP servers), so that results reflect the skill alone.
23. As a skill author, I want file access and commands outside the temp folder to be blocked, so that a run can't touch my real files.
24. As a skill author, I want the agent to have web access, so that the skill's documented fallback to the online docs works as in real use.
25. As a skill author, I want a console row per case with result, cost and the first failure, so that I can see what broke at a glance.
26. As a skill author, I want the first failure note to name the failed check or the failed rubric line with its reason, so that I know where to look.
27. As a skill author, I want a totals line (passed, failed, cost), so that I know the overall state and spend.
28. As a skill author, I want each run's results written to `results/<run-id>/summary.json`, so that I can inspect or approve them later.
29. As a skill author, I want one transcript file per case with the final message, the judge verdict per line and the raw transcript, so that I can debug a failure.
30. As a skill author, I want each run compared with the committed `baseline.json`, so that I can see what a skill edit changed.
31. As a skill author, I want cases to be labelled regressed, improved, new or removed against the baseline, so that changes stand out.
32. As a skill author, I want no comparison (rather than a comparison with some earlier local run) when there is no baseline, so that the reference is always explicit.
33. As a skill author, I want `npm run eval:approve` to make the latest run the baseline, so that accepting new results is one deliberate step.
34. As a skill author, I want `approve --run <id>` to approve a specific earlier run, so that I can pick which run becomes the reference.
35. As a skill author, I want approving a run filtered with `--case` to merge into the existing baseline, so that approving one case doesn't erase the others.
36. As a skill author, I want a run filtered with `--case` not to report the other baseline cases as removed, so that partial runs don't look like deletions.
37. As a team member, I want `baseline.json` committed and small (case id, pass, cost), so that baseline changes are easy to review in a PR.
38. As a skill author, I want the run to stop before anything starts when `ANTHROPIC_API_KEY` is missing, so that I don't get a run full of failures.
39. As a skill author, I want the process to exit 0 whenever the run completed and 1 only when it couldn't start, so that it behaves as before in scripts.
40. As a maintainer, I want only one agent tool in the code, so that there's no tool registry, target parsing or Codex-specific code to maintain.
41. As a maintainer, I want the engine to still take its adapter, judge and workspace as dependencies, so that it stays testable with fakes.
42. As a maintainer, I want skill-trigger detection to be a small function over the SDK messages, so that it doesn't depend on a flow subsystem that no longer exists.
43. As a maintainer, I want the shared types in the `Evals` namespace cut down to what's still used, so that the contract file reflects the real engine.
44. As a maintainer, I want the compile-time check that the case schema matches the `Case` contract kept, so that the two can't drift.
45. As a maintainer, I want `npm test` to stay free and offline, so that anyone can run it without keys.
46. As a maintainer, I want `npm run test:contract` to cover the real Claude Code adapter and judge only, so that it matches what ships.
47. As a new contributor, I want the README to explain step by step how a case runs, how the judge prompt is built, how the tests are set up, and how the baseline works, so that I can understand the engine from the README alone.
48. As a new contributor, I want guidance on writing good rubric lines (one checkable claim per line, exact strings in `mustInclude` instead), so that my cases give stable results.

## Implementation Decisions

**Case schema**

- A case has exactly: `id` (required, kebab-case), `prompt` (required, non-empty), `mustInclude` (matchers, default empty), `mustNotInclude` (matchers, default empty), `rubric` (optional string). The object is strict, so any other field is an error.
- There is no `kind` field and no discriminated union. Every case is an answer case.
- Matcher syntax and validation are unchanged.
- The `Evals.Cases.Case` contract shrinks to the same shape, and the compile-time "schema equals contract" check stays.

**Removed entirely, with all supporting code**

- Codex: the adapter, its flow extractor, its dependency, `OPENAI_API_KEY`, `CODEX_PRICE_*`.
- Targets: target ids, target parsing and the `--target` filter. The engine's dependency map of adapters keyed by tool becomes a single adapter.
- Trigger cases: trigger-rate scoring, the trigger threshold, and `expectSkill`.
- Task cases: workspace setup from templates and fixtures, the git start state and diff, file / `package.json` / command checks, the command runner and command timeout, the review rubric, the `<workspace_diff>` block in the judge prompt, and the fixtures folder.
- Repeat and thresholds: `repeat`, `--repeat`, the default repeat, `passThreshold`, pass rate, and odd runs. A case's result is the result of its single run.
- Flow: flow extraction, normalisation, comparison, flow checks, odd-run detection, flow diffs against the baseline, per-case flow markdown, the `flows/` output folder, and flows stored in the baseline.
- Skill-removed comparison runs (`--baseline` flag / `withoutSkill`).
- `--kind`, `--max-cost` (and the skipped-run state it produced), `--keep-workdirs`.
- Per-case `network`, `maxTurns`, `timeoutMs`. The network-blocking rules in the Claude Code guard and the `WebFetch`/`WebSearch` disallow list go with `network`.
- The fallback that compares with the previous local run when there is no committed baseline.

**Engine**

- The pipeline stays: select cases (by `--case`) → preflight → run each case in a bounded pool → build case reports → load baseline → compare → write results.
- One run unit per case. The unit no longer carries a target, tool, index or with-skill flag.
- Preflight checks the single adapter's and the judge's readiness (both need `ANTHROPIC_API_KEY`). The judge check is only needed when some selected case has a rubric.
- Fixed limits: 15 turns and 3 minutes per run, kept as named defaults.
- The model comes from an engine option set by `--model`. When it's not set, the adapter falls back to `claude-sonnet-5-5`.
- The run report carries one entry per case (no separate per-run records list): case id, pass, the checks, judge lines if graded, stop reason, error if any, cost, and transcript file.
- Pass rule: agent finished, skill triggered, text checks pass, and every rubric line passes (when there is a rubric).

**Workspace**

- Prepare creates a temp folder, copies the skill into the adapter's skill install path, and returns the workdir and a cleanup function. No git, no diff, no seeding.
- It's no longer a git workspace, so the class is renamed to match (for example a temp-folder workspace manager).

**Adapter (Claude Code)**

- Unchanged in its isolation: project settings only, all skills from the workdir, no MCP servers, `default` permission mode with the workdir guard, abort timer for the timeout.
- Skill-trigger detection moves to a small standalone function that scans the SDK messages for a `Skill` tool call naming the skill, or a `Read` of its `SKILL.md`. The skill name is derived from the adapter's skill install path. The adapter's result carries `skillTriggered`, and no longer carries a flow or a trigger-detection label.
- The guard keeps path and command containment and drops the network rules. Its options object goes away if nothing is left in it.

**Judge**

- Unchanged apart from the missing diff. It uses Opus 5.5 with medium effort and structured output `{ lines: [{ index, pass, reason }] }`. The fixed system prompt says to grade each line independently with no credit for intent. The user message contains the numbered `<rubric>`, the `<final_message>` and the `<transcript>` (JSON, cut off at 1.5M characters and marked as truncated).
- A missing line verdict fails that line. A refusal or unparseable verdict throws, and the engine turns that into a failed `judge` check.

**Baseline**

- Approve refuses a run with no cases, and a run where any case never reached the agent. A `baseline.json` with a version other than 2 (written by the older engine) is an error, raised before any case runs.
- `baseline.json` has a version (2), the approved run id, the approval time, and entries of `{ caseId, pass, costUsd }`.
- The reference is the committed baseline or nothing.
- Comparison is keyed by case id: regressed (pass → fail), improved (fail → pass), unchanged, new (not in baseline), removed (in baseline, not run, and only when the run wasn't filtered by `--case`).
- Approve takes the latest run or `--run <id>`. A run filtered by `--case` merges its entries into the existing baseline, and an unfiltered run replaces it.

**Output**

- `results/<run-id>/summary.json` (the run report) and `results/<run-id>/transcripts/<case>.json` (final message, judge verdicts, raw transcript).
- The console prints one row per case (case, result, cost, notes), where notes is the first failed check or the first failed rubric line with its reason. It then prints a totals line and the baseline comparison.

**CLI**

- `run` takes `--case`, `--concurrency` and `--model`. `approve` takes `--run`.
- Exit codes are unchanged: 0 when the run completed, 1 when it couldn't start (invalid cases, missing key, bad flag).

**Conventions kept**

- All shared types in the `Evals` namespace, pruned to Cases, Agent, Judge, Workspace, Engine, Report, Baseline and the minimal check-result type still used.
- The separate typecheck of the contracts file.
- Singletons for the adapter and judge, explicit member visibility, and readonly contracts.

## Testing Decisions

**What makes a good test here:** tests check behaviour at the highest seam, the `EvalEngine.run` call with a fake adapter and a fake judge. Assertions are about the returned report and the files written (`summary.json`, transcripts, `baseline.json`), never about internal functions. Real temp folders are used, and nothing calls the network or needs keys.

**Seams:**

1. **`EvalEngine.run`** with injected adapter, judge and workspace. This is the primary seam and already exists. It covers case validation, check order, judge gating, pass rules, the baseline comparison, approve and merge, the `--case` filter, concurrency, and output files.
2. **The skill-trigger detection function** over SDK messages. This is a new pure function, tested with hand-built transcripts, because the fake adapter bypasses it.
3. **The Claude Code workdir guard.** This seam already exists. Keep its containment tests and drop the network ones.

No other seams. The flow extractor seams are deleted along with the flow subsystem.

**Test changes:**

- Delete: the flow extractor tests for both tools, and the engine tests for flow, task and trigger cases.
- Cut down: the engine answer tests (text checks, skill-triggered check, judge gating, judge errors, missing line verdicts), the engine baseline tests (compare and approve, filtered merge, no fallback to the previous run), the engine controls tests (`--case`, concurrency, `--model` reaching the adapter, preflight on a missing key), and the review-regression tests (keep only the scenarios that still apply).
- Keep: the guard tests (minus network) and the singleton tests.
- Add: tests for the skill-trigger detection function. Add schema tests showing that removed fields are rejected as unknown, either in the engine answer tests or as a small engine test that runs a case file with an old field and expects a setup error.
- Test helpers: drop fixture support and target and repeat options. Adapter fakes become a single adapter rather than a map keyed by tool.
- Contract tests (`npm run test:contract`): keep the Claude Code adapter and judge tests, and delete the Codex test.

**Prior art:** the existing `test/engine-*.test.ts` files and `test/helpers.ts` (`makeEnv`, `runEval`, the scripted fake adapter) are the pattern to follow.

**Verification:** `npm run typecheck` and `npm test` both pass.

## Out of Scope

- Trigger and task case kinds, and any agent tool other than Claude Code. They can come back later through the same adapter seam.
- Repeated runs, pass rates and statistical thresholds.
- Flow snapshots, flow checks and flow comparison.
- Skill-removed comparison runs.
- Cost caps.
- Per-case limits or per-case network control.
- Checking runtime behaviour inside io.Connect.
- Rewriting the original design spec. It only gets a note at the top pointing to this spec.

## Further Notes

- "Baseline" now means only the committed `baseline.json`. The `--baseline` flag that ran cases without the skill is gone, and the README should say so explicitly to avoid the old ambiguity.
- The judge still gets the full transcript because answer-quality lines often depend on what the agent read, not only on what it wrote. Exact strings belong in `mustInclude` / `mustNotInclude`, not in the rubric.
- Existing case files (the `cases/` folder is currently empty) and any existing `baseline.json` in the old format don't need migrating. A new baseline is approved after the first run of the new engine.
- Don't commit as part of this work unless asked.
