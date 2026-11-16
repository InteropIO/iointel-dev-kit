# Can we trust the judge?

This document explains how our evals use an LLM "judge" to grade agent work against a rubric, the ways the judge can get it wrong, what protects us today, and what we should add so we can **measure** how far to trust it instead of just assuming.

Sections are marked **(exists)** for what is in the code today and **(proposed)** for what we don't have yet.

---

## 1. The basics

### What is a rubric?

A rubric is a written grading guide, agreed **before** grading, that says what good work looks like. It does two jobs:

1. **Names what is judged,** so the grader doesn't skip things or invent new standards.
2. **Makes grading repeatable,** so two graders (or one grader on two days) give the same work the same grade.

### What does our rubric look like? (exists)

Each case can have an `output.judge.rubric`: a list of separate requirements. Each line is graded **pass or fail**. Example from `cases/code-mode/approve-payment.json`:

```json
"rubric": [
  "Adds an asynchronous interceptors.onToolCall ... that awaits the user's decision before submit_payment runs",
  "Fails closed: a declined, dismissed or failed approval denies the call, and approval is never assumed or auto-granted",
  "[report-only] Uses the io.Connect modals dialogs that the app already enables instead of window.confirm"
]
```

This kind is called a **binary analytic rubric**, or **checklist rubric**:

- *analytic*: it scores separate criteria rather than giving one overall impression
- *binary*: each criterion has two levels, met or not met

### What is the judge? (exists)

The judge is Claude Opus 5.5 (`src/judge/anthropic-judge.ts`). After an agent finishes a run and passes all the deterministic checks, the judge receives:

| Input | Why |
|---|---|
| The rubric lines, numbered | What to check |
| The agent's final message | What the agent *said* it did |
| The workspace git diff (task cases) | What the agent *actually changed* |
| The full transcript | *How* it got there: what it read, ran and fetched |
| **Opt-in:** read-only access to the finished workspace | The code the agent *didn't* change, and installed packages (see [5.7](#57-workspace-access-exists)) |

For every line it returns `pass: true/false` and a one-line `reason`.

### How a score is made (exists)

```
score = lines passed ÷ lines counted        ([report-only] lines are not counted)
run passes the judge step if score ≥ threshold   (threshold defaults to 1 = every line)
```

Example: 9 counted lines, 7 pass → score 0.78. With `threshold: 0.5` the run passes; with the default of 1 it fails.

---

## 2. Why the judge can be wrong

An LLM judge is a **measuring instrument**. Like any instrument it has error, and we need to know how large it is. These are the typical mistakes:

| Mistake | What it looks like | Example from our cases |
|---|---|---|
| **Believing claims** | The agent *says* it did X, the judge passes X, but the diff shows otherwise | Final message says "approval fails closed", but the code's `catch` returns `allow` |
| **Being lenient on near-misses** | Something close to the requirement is accepted as meeting it | Tool name `submit_payment` was hard-coded from a guess, but the line asks for a name *verified* in docs or types |
| **Being too strict** | Correct work fails because it's written differently from what the judge expected | Approval implemented in a helper file instead of inline, and the judge says "not found in App.tsx" |
| **A vague line** | The line can reasonably be read two ways, so verdicts flip between runs | "Uses recommended defaults" (whose recommendation?) |
| **Missing evidence** | The proof is in a part of the transcript the judge didn't weigh, or that was truncated | Version was checked with `npm view`, but that sits deep in a very long transcript |
| **Can't see unchanged code** | The line is about code the agent left alone, which isn't in the diff | "Leaves submit_payment's validation intact": an empty diff for that file looks the same as "the file was never there" |
| **Inconsistency** | The same input graded twice gives different verdicts | Borderline lines flip pass/fail between calls |

Two of these errors matter much more than the others:

- **False pass:** the judge says pass, a careful human would say fail. **This is the dangerous one.** It hides real bugs and makes the skill look better than it is.
- **False fail:** the judge says fail, a human would say pass. Annoying and noisy, but at least someone looks at it.

---

## 3. What protects us today (exists)

### Design choices that reduce errors

1. **Binary, specific lines.** "Does X" is much easier to judge reliably than "is the code good, 1–10?".
2. **An evidence-first instruction.** The judge's system prompt says:
   > A line passes only if the evidence clearly satisfies it. Do not give credit for intent, for claims the transcript or diff contradicts, or for things the rubric does not ask for.
3. **It sees the diff, not just the message,** so it can check claims against the code. When a case opts in with `workspaceAccess`, it can also read the rest of the project (5.7).
4. **Fixed judge model.** It's always Opus 5.5, whichever agent is being tested, so scores are comparable.
5. **Strict output format.** The judge must return JSON verdicts. A line with no verdict counts as **fail**, never pass.
6. **Code checks first.** Files, dependencies, build commands and flow (what was read and fetched) are checked by code. The judge only runs if they pass, so it only handles what code can't.

### Process controls

1. **A reason for every verdict.** Every verdict comes with a one-line reason in the report, so a human can check any of them.
2. **`[report-only]` lines.** New or unproven lines can be graded and shown without affecting pass/fail.
3. **Score changes don't decide regressions.** A rubric score change against the baseline is reported, but on its own it never marks a case regressed or improved.
4. **The baseline moves deliberately.** `npm run eval:approve` plus a commit, so baseline changes show up in review.
5. **A contract test.** `test/contract/judge.test.ts` checks that one obviously satisfied line passes and one obviously unsatisfied line fails.

### What this doesn't give us

None of the above **measures** how often the judge is right. The contract test is a smoke test: it proves the judge isn't broken, not that it's accurate on hard cases. Today we **don't know** our false-pass rate.

---

## 4. Gaps

| # | Gap | Risk |
|---|---|---|
| 1 | No measured accuracy against human labels | We can't say how far to trust a "pass" |
| 2 | No consistency check | Borderline lines may flip between runs without anyone noticing |
| 3 | No standard for writing rubric lines | Vague lines produce noisy verdicts |
| 4 | Nothing re-checks old verdicts when the judge model or prompt changes | A judge change could silently shift every score |
| 5 | All lines weigh the same | A critical safety line ("fails closed") can be outvoted by cosmetic lines at a 0.5 threshold |
| 6 | Very long transcripts are truncated (over 1.5M chars) | The evidence for a line may be cut off |
| 7 | ~~The judge only sees the diff, so it can't verify unchanged code~~ | **Addressed** by opt-in `workspaceAccess` (5.7), for cases that turn it on |

---

## 5. The plan (proposed)

### 5.1 Calibration set: measure the judge against humans

This is the most important step, because it's the only one that produces a number.

**The idea:** collect real graded runs, have a human decide the correct verdict for every line, then check how often the judge agrees.

**Step by step:**

1. **Collect examples.** Take 20–50 real runs from `evals/results/`. Choose a mix:
   - clearly good runs
   - clearly bad runs
   - **near-misses**, the important ones: guessed tool name, approval that defaults to allow, `window.confirm` instead of modals, a version copied from a docs example
   
   If real near-misses are rare, make them by editing a good run's diff.
2. **Label them.** For every rubric line, a human writes the correct verdict and a short reason. Two people label the trickiest ones. If they disagree, the line itself is unclear and needs rewording (see 5.3).
3. **Store them** as fixtures, for example:

   ```
   evals/judge-calibration/
     approve-payment-guessed-tool-name.json
   ```
   ```json
   {
     "rubric": ["...same lines as the case..."],
     "finalMessage": "...",
     "diff": "...",
     "transcriptFile": "approve-payment-guessed-tool-name.transcript.json",
     "labels": [
       { "index": 3, "pass": false, "why": "Tool name hard-coded; no docs or types lookup in transcript" }
     ]
   }
   ```
4. **Run the judge on all fixtures** with a script (e.g. `npm run judge:calibrate`) and compare each verdict with its label.
5. **Report four numbers:**

   | Number | Meaning | Target (example) |
   |---|---|---|
   | **Agreement** | share of lines where judge = human | ≥ 90% |
   | **False-pass rate** | judge passed, human failed ÷ all lines the human failed | **≤ 5%** |
   | **False-fail rate** | judge failed, human passed ÷ all lines the human passed | ≤ 10% |
   | **Worst lines** | the specific rubric lines the judge gets wrong most often | fix or reword them |

   **Worked example.** 200 labelled line-verdicts. Humans said 150 pass and 50 fail.
   - Judge passed 4 of the 50 the humans failed → **false-pass rate 8%** → too high, investigate.
   - Judge failed 6 of the 150 the humans passed → false-fail rate 4% → fine.
   - Agreement = (200 − 4 − 6) ÷ 200 = **95%**.

   High agreement can still hide a bad false-pass rate. That's why the two rates are reported separately.

6. **Re-run the calibration whenever** the judge model, the judge prompt or the verdict format changes, and before trusting a new rubric style. If the numbers drop below the targets, the change doesn't ship.

### 5.2 Consistency check

Grade the same run 3 times. For each line:

- the same verdict all 3 times → stable
- the verdicts differ → **unstable line**

An unstable line is almost always a **wording** problem, not a judge problem: the line can be read two ways. Reword it (5.3). This can run as an option on calibration fixtures (e.g. `--repeat 3`) without any extra labelling.

### 5.3 Rules for writing rubric lines

Most judge errors start with the line. A good line is:

| Rule | Bad | Good |
|---|---|---|
| **One thing per line** | "Adds the interceptor, shows payment details and fails closed" | Three separate lines |
| **Observable in the evidence** | "Understands Code Mode well" | "Enables Code Mode in `aiWebConfig` in `app/src/App.tsx`" |
| **Says where to look** | "Uses the right tool name" | "Matches `submit_payment` by the identifier the host passes to the interceptor, as shown in the docs fetch or the installed types in the transcript" |
| **Says what fails** | "Handles declines" | "A declined, dismissed **or failed** approval denies the call" |
| **No judgement words** | "Clean", "good", "appropriate", "recommended" | Name the concrete property you mean |
| **Doesn't repeat a code check** | "Runs `npm run build` successfully" | Leave it to `deterministic.commands` |

Rule of thumb: **if two engineers could disagree about whether a line passed, the judge will too.**

### 5.4 Lifecycle of a rubric line

```
new line ──► [report-only] ──► spot-check verdicts on 3–5 runs ──► counted line
                  │                         │
                  │                    verdicts wrong?
                  │                         ▼
                  └──────────────── reword the line
```

1. Every new line starts with `[report-only]`. The flag exists already; this makes using it a rule.
2. A human reads its verdicts and reasons on a few runs.
3. If the verdicts are right, remove the prefix. If not, reword the line and repeat.
4. Optionally, add one calibration fixture for the line's most likely near-miss.

### 5.5 Critical lines

Some lines are about safety or correctness and must never be averaged away. Proposal: a `[critical]` prefix, like `[report-only]`:

```json
"[critical] Fails closed: a declined, dismissed or failed approval denies the call"
```

A run that fails a `[critical]` line fails the judge step **whatever the score**. Other lines keep using the threshold.

### 5.6 Human review when scores change

When a case's rubric score changes against the baseline:

1. Open the case report and read the **reasons** for the lines that changed.
2. Decide whether each change is a real agent change or a judge error.
3. Only then run `npm run eval:approve`.
4. If it was a judge error, turn the run into a calibration fixture (5.1) so it's tested from then on.

Over time this grows the calibration set out of the mistakes the judge actually makes.

### 5.7 Workspace access (exists)

**The problem.** The diff shows only what the agent **changed**. Several kinds of rubric line are about the rest of the project:

| Kind of line | Example | Why the diff isn't enough |
|---|---|---|
| Something must be left alone | "Leaves submit_payment's server-side validation intact" | No change in the diff looks the same as "the file doesn't exist" |
| Something must appear exactly once | "Enables Code Mode exactly once" | The diff shows the addition, not whether the template already had one |
| Something the app already has | "Uses the modals dialogs the app already enables" | That code is in the template, outside the diff |
| What an installed package declares | "Matches the tool identifier from the installed types" | `node_modules` isn't in the diff |

Without the workspace, the judge has to trust what the agent says about these, which is the "believing claims" mistake from section 2.

**The fix.** A case can set:

```json
"judge": {
  "rubric": ["..."],
  "workspaceAccess": true
}
```

Then the judge also gets **read-only** access to the finished workspace:

| | Without (default) | With `workspaceAccess: true` |
|---|---|---|
| Evidence | final message, transcript, diff | the same, **plus** files in the workspace |
| Tools | none | `Read`, `Grep`, `Glob` only. No shell, no writing, no web |
| Where it can look | n/a | only inside the workspace: the same guard that keeps agents in their folder denies any path outside it |
| Turns allowed | 3 | 20, since each file lookup is a turn |
| Instructions | grade from the evidence | the same, plus: *the diff is what the agent changed; use files only to verify lines the other evidence can't settle; don't review the project beyond the rubric* |

**How it works.** A run's steps are: agent → checks → **judge** → save → **clean up**. The judge runs *before* the temp workspace is deleted, so the folder is still there to read. Nothing is copied or uploaded. The judge reads it where it is.

**Costs and risks.**

- **More expensive and slower.** Each lookup is another model turn. The cost shows in the report's `cost` column as usual.
- **A bit less consistent.** The judge may look at different files on different runs. Calibration and consistency checks (5.1, 5.2) matter more for these cases.
- **Harder to replay.** A calibration fixture for such a case needs the relevant workspace files saved alongside the diff and transcript, not just those two.
- **Distraction.** With the whole project visible, the judge could grade the template's code rather than the agent's. The instructions tell it the diff is the agent's work, and the rubric decides what's checked.

**When to turn it on.**

- **Yes:** task cases whose rubric has "intact", "exactly once", "already", "only", "unchanged" or "installed version/types" lines.
- **No:** answer cases (there's no project to inspect) and rubrics that only ask about what was added.

A good habit: if a line can only pass by *trusting* the agent's final message, either turn on `workspaceAccess` or rewrite the line.

**Tests.**

- `test/engine-task.test.ts` checks that the judge gets the workspace path only when the case opts in, and that the agent's files are still on disk while it grades.
- `test/contract/judge.test.ts` checks, against the real judge, that with an **empty diff** it passes a line about code still present in the workspace and fails a line about a file that isn't there. It can only get both right by actually reading the files.

---

## 6. Summary

| Question | Answer today | Answer after the plan |
|---|---|---|
| How accurate is the judge? | Unknown | Agreement and false-pass rate, measured on labelled fixtures |
| Is it consistent? | Unknown | Unstable lines found and reworded |
| Are our rubric lines good? | Depends on the author | Written to rules, proven as `[report-only]` first |
| Can a critical failure hide? | Yes, behind a low threshold | No, `[critical]` lines always fail the run |
| What if we change the judge? | Nothing re-checks it | Calibration must pass before the change ships |
| Who checks surprising verdicts? | Whoever notices | A defined step before every baseline approval |
| Can it verify code the agent didn't change? | **Yes, for cases that opt in** with `workspaceAccess` (5.7) | Same, used wherever the rubric needs it |

**Start with 5.1.** The calibration set turns "we think the judge is right" into "the judge agrees with humans 95% of the time and wrongly passes 3% of lines that should fail". The other steps make that number better and keep it from slipping.

---

## Appendix: how this compares to DeepEval's G-Eval

DeepEval's G-Eval asks the judge for **one overall score from 0 to 10** against a single criterion. The judge writes its own evaluation steps first, the score is weighted by token probabilities, and an optional `Rubric` describes what each score band means.

| | Ours | G-Eval |
|---|---|---|
| Unit of judgement | many pass/fail lines | one overall score |
| What "rubric" means | the requirements themselves | descriptions of the score bands |
| Easy to see what failed | yes, per line | no, a 0.6 doesn't say what was missing |
| Partial credit | only across lines | within the single score |

For checking agent work against concrete requirements, a checklist is the better fit. G-Eval-style scoring suits qualities that are a matter of degree, such as how clear an explanation is. Either way, the governance in section 5 applies: **every LLM judge needs to be measured against humans.**
