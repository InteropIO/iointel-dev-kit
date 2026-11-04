# io-intelligence skill evals

A local eval engine for the [`io-intelligence`](../skills/io-intelligence/SKILL.md) skill. It runs YAML test cases against the **working copy** of the skill, through the agent tools developers actually use, and reports whether the skill:

- **triggers**: loads for prompts that need it, and stays out of prompts that don't;
- **answers correctly**: right packages and APIs, no invented ones;
- **completes tasks**: scaffolds or extends a project that installs, type-checks and builds.

Every result belongs to a **target**, which is an agent tool and a model together (for example `claude-code/claude-sonnet-5-5` or `codex/gpt-5.5`), never a model on its own. The same skill can behave differently in different tools.

Design background: [docs/specs/io-intelligence-eval-engine.md](../docs/specs/io-intelligence-eval-engine.md).

---

## Quick start

```bash
cd evals
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY and/or OPENAI_API_KEY
# write cases in evals/cases/<kind>/<id>.yaml (see "Writing cases")
npm run eval -- --kind trigger --repeat 1   # a quick first run
npm run eval                                # the full suite
npm run eval:approve                        # make the latest run the baseline, then commit baseline.json
```

| Key | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | `claude-code/*` targets, and the judge (any case with a rubric) |
| `OPENAI_API_KEY` | `codex/*` targets |
| `CODEX_PRICE_*` | optional: lets Codex runs count towards cost totals and `--max-cost` |

If a key that the selected cases need is missing, the run stops before anything starts.

---

## How it works

### The big picture

```mermaid
flowchart LR
    subgraph repo["iointel-dev-kit"]
        skill["skills/io-intelligence<br/>(working copy)"]
        cases["evals/cases/*.yaml"]
        baseline["evals/baseline.json<br/>(committed)"]
    end

    cli["npm run eval<br/>(cli.ts)"] --> engine["EvalEngine<br/>(engine)"]
    cases --> engine
    engine -->|"per run: fresh temp folder<br/>+ copy of the skill"| ws["Workspace manager"]
    skill --> ws
    engine --> cc["Claude Code adapter<br/>(Agent SDK)"]
    engine --> cx["Codex adapter<br/>(Codex SDK)"]
    engine --> judge["Judge<br/>(Claude Opus 5.5)"]
    baseline --> engine
    engine --> results["evals/results/&lt;run-id&gt;/<br/>summary.json · transcripts/ · flows/"]
    engine --> console["Console summary"]
```

The engine itself makes no API calls. Everything that talks to the outside world (agent tools, the judge, temp folders, shell commands) is passed to the `EvalEngine` constructor as a dependency (`new EvalEngine(deps).run(options)`). That one seam is what lets the engine be tested with fakes, and it's also where new agent tools plug in.

### One run, step by step

A case runs once per target, repeated `N` times (default 3). Each of those runs is a **run unit**:

```mermaid
sequenceDiagram
    autonumber
    participant E as Engine
    participant W as Workspace manager
    participant A as Adapter (Claude Code / Codex)
    participant C as Checks
    participant J as Judge (Opus 5.5)

    E->>W: prepare(setup, skill install path, withSkill)
    W-->>E: temp workdir (seeded, skill copied in, git commit of start state)
    E->>A: run(prompt, model, workdir, network, limits)
    A-->>E: final message, transcript, flow, skillTriggered, cost, stop reason
    E->>C: agent finished? skill triggered? text / flow checks
    alt task case and checks pass so far
        E->>C: files exist → package.json deps → commands (install, build…)
        E->>W: diff since start
    end
    alt rubric present and all checks passed
        E->>J: grade(rubric lines, final message, transcript, diff)
        J-->>E: pass/fail + reason per line
    end
    E->>W: cleanup (unless --keep-workdirs)
    E->>E: write transcript file, record result
```

Checks stop at the first failure, so a run that didn't trigger the skill, or whose build failed, never costs a judge call.

### From runs to a report

```mermaid
flowchart TD
    load["Load and validate all case files<br/>(any invalid file stops the run)"] --> filter["Apply --kind / --case / --target"]
    filter --> expand["Expand: case × target × repeat<br/>(+ skill-removed runs with --baseline)"]
    expand --> preflight["Preflight: adapters exist, API keys set,<br/>judge available if any case has a rubric"]
    preflight --> pool["Run units in a pool of --concurrency (default 4)<br/>stop starting new ones at --max-cost"]
    pool --> agg["Aggregate per case × target:<br/>pass rate, trigger rate, cost, odd flows"]
    agg --> ref["Load reference: committed baseline.json,<br/>else the previous local run"]
    ref --> cmp["Compare results and flows with the reference"]
    cmp --> out["Write results/&lt;run-id&gt;/ and print the summary"]
```

---

## Case kinds

All cases are YAML files under `evals/cases/` (subfolders are up to you; `cases/<kind>/<id>.yaml` is the convention). They're validated with Zod when a run starts. A misspelled field, a missing `targets` or an invalid regex stops the run with a message naming the file and field.

### Fields every case has

| Field | Required | Default | Meaning |
|---|---|---|---|
| `id` | ✅ | | Unique, kebab-case |
| `kind` | ✅ | | `trigger`, `answer` or `task` |
| `targets` | ✅ | | Where the case runs: `claude-code/<model>`, `codex/<model>` |
| `prompt` | ✅ | | The single message sent to the agent |
| `expectSkill` | | `true` | Whether the skill should load. `false` makes a negative case |
| `network` | | `true` | `false` blocks web access, to test the bundled references alone |
| `repeat` | | 3 (or `--repeat`) | Runs per target |
| `passThreshold` | | ⅔ for trigger, 1 otherwise | Fraction of runs that must pass |
| `maxTurns` / `timeoutMs` | | 15 / 3 min (task: 40 / 10 min) | Per-run limits |
| `flow` | | | Optional flow checks (see [Flow snapshots](#flow-snapshots)) |

**Matchers.** Anywhere a check takes text, a plain string is a case-sensitive substring, and `/pattern/flags` is a regex. The `g` and `y` flags are ignored.

### `trigger`: does the skill load?

```yaml
id: mcp-web-tool-trigger
kind: trigger
targets: [claude-code/claude-sonnet-5-5, codex/gpt-5.5]
prompt: I want io.Assist to call a function in my io.Connect browser app. How?
```

```yaml
id: unrelated-python
kind: trigger
targets: [claude-code/claude-sonnet-5-5]
prompt: Write a Python function that reverses a string.
expectSkill: false # negative case: must NOT load the skill
```

A run passes when the skill triggered (or didn't) as expected. The case passes at **≥ 2 of 3** runs by default, because triggering naturally varies from run to run.

### `answer`: is the answer right?

```yaml
id: mcp-web-for-browser-apps
kind: answer
targets: [claude-code/claude-sonnet-5-5]
prompt: Which package exposes MCP tools from an io.Connect browser app to io.Assist?
mustInclude: ["@interopio/mcp-web"]
mustNotInclude: ["/@interopio\\/mcp-(server|browser)/"] # invented package names
rubric: |
  - Recommends @interopio/mcp-web for a browser app
  - Explains that io.Assist discovers the registered tools
  - Does not invent APIs
```

The checks run in this order, and the run fails at the first one that fails:
1. **Agent finished:** no error, no turn limit, no timeout.
2. **Skill triggered:** answer and task cases also expect the skill to load, so a right answer from the model's prior knowledge alone doesn't count.
3. **`mustInclude` / `mustNotInclude`:** checked against the final message. Free, and reliable for package names.
4. **`rubric`:** the judge marks each line pass or fail, with a one-line reason.

**Every** run must pass for the case to pass.

### `task`: does the result build?

```yaml
id: add-mcp-tool-react
kind: task
targets: [claude-code/claude-sonnet-5-5]
prompt: Add an MCP tool "getPortfolio" to this app so io.Assist can call it.
setup: { template: io-assist-react-packaged } # or { fixture: my-app } or {} for an empty folder
checks:
  files: [src/mcp/tools.ts]
  packageJson:
    dependencies: { "@interopio/mcp-web": "*" } # "*" = any version; otherwise the exact declared range
  commands: [npm install, npx tsc --noEmit, npm run build]
  reviewRubric: |
    - Registers the tool when the app starts
    - Uses the existing io.Connect client instead of creating a new one
```

`setup` picks the starting point:
- **`template`:** fetches an official template with the skill's own `materialize-template.mjs`. This needs network access and Git.
- **`fixture`:** copies `evals/fixtures/<name>`.
- **`{}`:** starts from an empty folder.

The checks run in this order: files → `package.json` → commands (stopping at the first non-zero exit, and keeping the end of its output) → the judge reviews the **git diff** of everything the agent changed, with lockfiles and the skill folder left out. Every run must pass.

Template build commands differ: React uses `tsc -b && vite build`, Angular packaged uses `ng build`, Angular editable has its own script, and the vanilla template has no build step. List the right `commands` for each starting point.

---

## Targets and adapters

```mermaid
classDiagram
    class Adapter {
        <<Evals.Agent.Adapter>>
        +tool: string
        +skillInstallPath: string
        +checkReady() string | undefined
        +run(RunInput) Promise~RunResult~
    }
    class ClaudeCodeAdapter {
        <<singleton>>
        +tool = "claude-code"
        +skillInstallPath = ".claude/skills/io-intelligence"
        +getInstance()$
    }
    class CodexAdapter {
        <<singleton>>
        +tool = "codex"
        +skillInstallPath = ".agents/skills/io-intelligence"
        +getInstance()$
        +estimateCost(usage)$
    }
    Adapter <|.. ClaudeCodeAdapter
    Adapter <|.. CodexAdapter
```

| | Claude Code | Codex |
|---|---|---|
| Runs through | `@anthropic-ai/claude-agent-sdk` | `@openai/codex-sdk` |
| Skill installed at | `.claude/skills/io-intelligence` | `.agents/skills/io-intelligence` |
| Isolation | Loads only project settings from the temp folder: no user skills, plugins, `CLAUDE.md` or MCP servers | Runs with an empty, temporary home folder, so no user config or skills |
| Containment | A permission guard (`canUseTool`) rejects file access and commands that point outside the workdir | Codex's own `workspace-write` sandbox |
| Trigger detected by | A `Skill` tool call naming `io-intelligence` | Any command that reads `<skill>/SKILL.md` (Codex has no explicit skill event) |
| `network: false` | Removes `WebFetch`/`WebSearch` and blocks `curl`, `wget`, `iwr`, `git clone/fetch/pull` | Disables network access and web search |
| Turn limit | Enforced | Not available in Codex; only the timeout applies |
| Cost | Reported by the SDK | Calculated from token usage × `CODEX_PRICE_*`; otherwise "unknown" |
| Default model | `claude-sonnet-5-5` | Codex's own default |

Each run records how triggering was detected, so a Codex trigger rate isn't mistaken for the same kind of signal as Claude's.

> The Claude Code guard catches mistakes, not attacks. It's a heuristic over tool inputs, not an OS sandbox. That's enough for running your own cases against your own skill.

---

## Flow snapshots

Pass or fail tells you **what** happened. A flow snapshot tells you **how**: the ordered key steps the agent took, recorded for every run in the same format for every tool.

```mermaid
flowchart LR
    raw["Raw transcript<br/>(SDK messages / Codex items)"] --> ext["Tool-specific extractor<br/>claude-flow.ts / codex-flow.ts"]
    ext --> norm["Normalize<br/>• paths relative to the workdir<br/>• skill folder → &lt;skill&gt;<br/>• no temp names, timestamps, wording<br/>• minor steps (ls, grep) dropped"]
    norm --> snap["Flow snapshot"]
    snap --> odd["Among repeats:<br/>flag odd runs"]
    snap --> diff["Against the baseline:<br/>steps added / removed"]
    snap --> checks["Optional flow checks:<br/>mustRead / mustNotRead / mustRun"]
```

A snapshot looks like this:

```
1. skill-loaded io-intelligence (via skill-tool)
2. read <skill>/references/core.md
3. read <skill>/references/mcp-integration.md
4. fetch https://docs-ai.interop.io/llms.txt
5. script materialize-template --template io-assist-react-packaged --target app
6. write src/mcp/tools.ts
7. command npm run build → exit 1
8. command npm run build → exit 0
outcome: done · 23 turns · $0.41
```

Two runs that took the same route produce **identical** snapshots, whatever temp folder they ran in, so differences are meaningful:

- **Odd runs:** repeats are grouped by identical snapshots, and runs outside the largest group are flagged. For example, if two runs read `mcp-integration.md` and the third read `custom-ai-web.md`, the third is flagged, even when all three passed.
- **Baseline flow changes:** the case's usual flow is compared with the approved one, e.g. "no longer reads `core.md`" or "a build retry appeared".
- **Flow checks:** once you've found a corner case, lock it in. A violated check fails the run:

  ```yaml
  flow:
    mustRead: [<skill>/references/core.md, "/mcp-integration\\.md$/"]
    mustNotRead: [custom-ai-web.md]
    mustRun: ["/^npm (i|install)\\b/", materialize-template --template io-assist-react-packaged]
  ```

Odd runs and flow changes are **reported only** and never fail a case. Flows vary between runs for legitimate reasons, so only explicit flow checks fail runs.

---

## Baseline and comparison

```mermaid
flowchart LR
    run1["npm run eval"] --> r1["results/run-A"]
    r1 -->|"npm run eval:approve"| bl["baseline.json<br/>results + approved flows"]
    bl -->|commit| git[("git")]
    run2["npm run eval<br/>(after a skill edit)"] --> r2["results/run-B"]
    bl --> cmp{"compare"}
    r2 --> cmp
    cmp --> report["REGRESSED / IMPROVED / NEW / REMOVED<br/>pass and trigger rate changes<br/>flow changes"]
```

- Each run is compared with the **committed `baseline.json`**. Without one, it's compared with the previous local run.
- `npm run eval:approve` promotes the latest run (or `-- --run <id>`) to the baseline. Commit `baseline.json` to share it with the team. Moving the baseline is a deliberate step that shows up for review.
- **Filtered runs** (`--case`, `--kind`, `--target`) only cover part of the suite. They don't report the cases they skipped as "removed", and approving one **merges** into the baseline instead of replacing it.

---

## Pass rules

| | Run passes when | Case passes when |
|---|---|---|
| `trigger` | Agent finished, and the skill triggered exactly as `expectSkill` says, plus any flow checks | ≥ ⅔ of runs pass (`passThreshold` overrides) |
| `answer` | Agent finished, skill triggered, text checks pass, flow checks pass, every rubric line passes | **every** run passes |
| `task` | Agent finished, skill triggered, files, deps, commands and flow checks pass, every review line passes | **every** run passes |

- If every run of a case was skipped by the cost cap, the case shows as `SKIPPED`, not failed.
- A judge error (refusal or API failure) fails that run but keeps the agent's transcript and cost.
- The process exits **0** whenever the run completed, whatever the results; reporting is all it does for now. It exits **1** only when a run can't start: invalid cases, a missing key, or a bad flag.

---

## Command reference

```
npm run eval -- [options]
  --kind trigger|answer|task   only cases of this kind
  --case ID                    only this case
  --target ID                  a target ("claude-code/claude-sonnet-5-5") or a whole tool ("codex")
  --repeat N                   runs per case (default 3; a case's own repeat wins)
  --concurrency N              runs at once (default 4)
  --max-cost USD               stop starting new runs once this much has been spent
  --baseline                   also run every case WITHOUT the skill, to show what it adds
  --keep-workdirs              keep temp workspaces for debugging

npm run eval:approve -- [--run ID]   promote the latest (or given) run to baseline.json
npm test                             engine tests (no network, no keys, no cost)
npm run test:contract                real adapters and judge (needs keys; costs money)
npm run typecheck                    tsc, plus a separate check of shared/contracts.d.ts
npm run format                       prettier
```

**`--baseline`** reruns every unit with the skill removed and reports the difference next to each case ("without skill: pass 20%"). It answers "does the skill actually help, or did the model already know this?". Runs without the skill never affect pass or fail.

### What a run writes

```
evals/results/<run-id>/            (gitignored)
├── summary.json                   the full Evals.Report.RunReport
├── transcripts/
│   └── <case>__<target>__<n>.json final message, flow, diff and raw transcript per run
└── flows/
    └── <case>.md                  every run and target side by side, odd runs and changes highlighted
```

The console summary:

```
case                      target                         kind     result  pass      trigger  cost   notes
mcp-web-tool-trigger      claude-code/claude-sonnet-5-5  trigger  PASS    100% (3)  100%     $0.21
mcp-web-tool-trigger      codex/gpt-5.5                  trigger  FAIL    33% (3)   33%      $0.15  odd flow, regressed

Cases: 1 passed, 1 failed · runs: 6, skipped: 0 · cost: $0.36
Comparison against committed baseline (2026-11-02T10-00-00-000Z):
  REGRESSED mcp-web-tool-trigger [codex/gpt-5.5] pass 100% → 33%, trigger 100% → 33%
Odd flows among repeats (see flows/<case>.md):
  mcp-web-tool-trigger [codex/gpt-5.5]: run 2
```

---

## Code layout

```
evals/
├── cases/                    your YAML cases
├── fixtures/                 starting projects for task cases (setup.fixture)
├── baseline.json             approved reference (committed, once you approve a run)
├── src/
│   ├── cli.ts                argument parsing, wires real adapters/judge/workspace into an EvalEngine
│   ├── shared/
│   │   ├── contracts.d.ts    the Evals namespace: every type shared between modules
│   │   └── types.ts          every other type (used by one module)
│   ├── engine/
│   │   ├── index.ts          public entry: EvalEngine, EvalSetupError, Evals
│   │   ├── eval-engine.ts    EvalEngine.run(): plan → preflight → run units → aggregate → compare → write
│   │   ├── planning.ts       load + filter cases, expand into run units (targets × repeats)
│   │   ├── preflight.ts      fail fast when an adapter or the judge isn't ready
│   │   ├── unit-runner.ts    UnitRunner: one unit in its own workspace (agent → checks → judge → record)
│   │   ├── run-checks.ts     the deterministic checks of one run, in order
│   │   ├── grading.ts        rubric lookup and the judge call
│   │   ├── records.ts        the RunRecord for a completed, failed or skipped run
│   │   ├── aggregate.ts      run records → one CaseReport per case and target
│   │   ├── run-report.ts     assembles the RunReport (options echo, totals)
│   │   ├── results-writer.ts ResultsWriter: transcripts/, summary.json, flows/
│   │   ├── pool.ts           bounded-concurrency pool
│   │   ├── defaults.ts       repeat, concurrency, thresholds, turn and time limits
│   │   └── errors.ts         EvalSetupError
│   ├── cases/                schema.ts (Zod, checked against Evals.Cases at compile time), loader.ts
│   ├── adapters/             claude-code.ts, claude-guard.ts, codex.ts
│   ├── flow/                 normalize.ts, claude-flow.ts, codex-flow.ts, compare.ts
│   ├── checks/               matcher.ts, checks.ts, command-runner.ts
│   ├── judge/                anthropic-judge.ts
│   ├── workspace/            workspace.ts (temp folder + git start state + diff)
│   └── report/               baseline.ts, console.ts, flow-markdown.ts
└── test/
    ├── engine-*.test.ts      engine behaviour through EvalEngine.run with fake adapters and judge
    ├── *-flow.test.ts        transcript → flow extraction per tool
    ├── claude-guard.test.ts  containment rules
    └── contract/             opt-in tests against the real tools and judge
```

### Contracts and types

```mermaid
flowchart TB
    subgraph contracts["shared/contracts.d.ts · namespace Evals"]
        direction LR
        Flow ~~~ Agent ~~~ Judge ~~~ Workspace ~~~ Commands
        Cases ~~~ Checks ~~~ Engine ~~~ Report ~~~ Baseline
    end
    types["shared/types.ts<br/>module-only types"]
    modules["src/**/*.ts"] -->|"import type { Evals }"| contracts
    modules -->|"import type { … }"| types
    schema["cases/schema.ts"] -.->|"compile-time: Zod output ≡ Evals.Cases.Case"| contracts
```

- **Every** type shared between modules is in the `Evals` namespace. Every other type is in `shared/types.ts`. No other file declares types.
- `contracts.d.ts` has no JavaScript behind it. Always import it with `import type`; `verbatimModuleSyntax` rejects anything else.
- `npm run typecheck` checks `contracts.d.ts` on its own (`tsconfig.contracts.json`), because the main config's `skipLibCheck` would otherwise skip it.
- The case schema and `Evals.Cases.Case` must match exactly, including optional fields, or the code doesn't compile.

### Design conventions

- **Singletons:** `ClaudeCodeAdapter`, `CodexAdapter` and `AnthropicJudge` hold no per-run state, so they have a private constructor and `getInstance()`. `GitWorkspaceManager` isn't a singleton: each instance is bound to a skill folder and a fixtures folder.
- **Explicit visibility:** every class member is `public`, `private` or `readonly`. Stateless helpers inside classes are `private static`. In plain modules, "private" means not exported.
- **Immutable data:** contracts are `readonly` throughout, including the arrays.

---

## Testing the engine

```mermaid
flowchart LR
    subgraph unit["npm test (free, offline)"]
        fakes["Fake adapter + fake judge"] --> seam["EvalEngine.run"]
        seam --> fs["Real temp folders,<br/>real git, real commands"]
        ext["Extractor tests<br/>(sample transcripts)"]
        guard["Guard tests"]
    end
    subgraph contract["npm run test:contract (keys, costs money)"]
        real["Real Claude Code / Codex / judge"] --> rec["Records transcripts to<br/>test/fixtures/transcripts/"]
    end
```

- Engine tests go **only through `EvalEngine.run`** (via the `runEval` helper in `test/helpers.ts`) and check the report and the files it writes. They never check internal functions.
- The extractor tests use hand-built sample transcripts. The first `npm run test:contract` saves real ones to `test/fixtures/transcripts/`, which should then become the test data.
- Contract tests skip themselves when their keys are missing.

---

## Adding a new agent tool

1. Implement `Evals.Agent.Adapter`: `tool`, `skillInstallPath` (where that tool discovers skills), `checkReady()` and `run()`.
2. Write a flow extractor for its transcript format that produces `Evals.Flow.Step`s with the shared normalizer, plus tests against sample transcripts.
3. Register it in `cli.ts` under its tool name. Cases then use `<tool>/<model>` targets.
4. Add it to `test/contract/adapters.test.ts`.

Candidates that support skills: OpenCode (`.claude/skills` and `.agents/skills`, a native `skill` tool, any model), GitHub Copilot CLI, Gemini CLI and Goose. Cursor CLI's headless mode doesn't load skills yet.

---

## Known limitations

- **Not yet verified against real models.** The engine is tested with fakes, but the extractors and containment are only checked for real by `npm run test:contract`.
- **Runtime behaviour isn't tested.** Task cases stop at "it builds". Checking the app inside io.Connect is out of scope (templates also ship with an empty `AGENT_SERVER_URL`).
- **Single-turn only.** The agent can ask questions, but nobody answers them. Write prompts with enough context.
- **Network-dependent cases** depend on docs-ai.interop.io and GitHub being reachable. Check the transcript before treating a network-shaped failure as a skill regression.
- **Codex:** no turn limit, cost needs `CODEX_PRICE_*`, and triggering is inferred from reading `SKILL.md`.
- **`network: false`** doesn't block `npm install`.
