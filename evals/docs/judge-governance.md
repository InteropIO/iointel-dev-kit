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
  { "assertion": "Adds an asynchronous interceptors.onToolCall ... that awaits the user's decision before submit_payment runs" },
  { "assertion": "Fails closed: a declined, dismissed or failed approval denies the call, and approval is never assumed or auto-granted" },
  { "type": "report", "assertion": "Uses the io.Connect modals dialogs that the app already enables instead of window.confirm" }
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
| The transcript, compacted (see [5.8](#58-compact-transcripts-exists)) | *How* it got there: what it read, ran and fetched |
| **Opt-in:** read-only access to the finished workspace | The code the agent *didn't* change, and installed packages (see [5.7](#57-workspace-access-exists)) |

For every line it returns `pass: true/false` and a one-line `reason`.

**You can see exactly what it received.** Every graded run writes `results/<run-id>/judge/<case>__<target>__<n>.md`, linked from the case report as "What the judge saw". It holds the verbatim system prompt and prompt, the tools it had, and how the transcript was compacted. It's written even when the judge fails, so a refusal or a strange verdict can be debugged from the real input.

### How a score is made (exists)

```
score = lines passed ÷ lines counted        ("report" lines are not counted)
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
2. **Line types.** `"type": "report"` lines are graded and shown without affecting pass/fail, for new or unproven lines. `"type": "critical"` lines fail the run whenever they fail, whatever the score (5.5).
3. **Score changes don't decide regressions.** A rubric score change against the baseline is reported, but on its own it never marks a case regressed or improved.
4. **The baseline moves deliberately.** `npm run eval:approve` plus a commit, so baseline changes show up in review.
5. **A contract test.** `test/contract/judge.test.ts` checks that one obviously satisfied line passes and one obviously unsatisfied line fails.
6. **The judge's input is saved.** Every graded run has a `judge/` file with exactly what the judge was sent, so any verdict can be checked against the evidence it actually had.

### What this doesn't give us

None of the above **measures** how often the judge is right. The contract test is a smoke test: it proves the judge isn't broken, not that it's accurate on hard cases. The tool to measure it exists (calibration, 5.1), but until items are labelled we **don't know** our false-pass rate.

---

## 4. Gaps

| # | Gap | Risk |
|---|---|---|
| 1 | No measured accuracy against human labels | We can't say how far to trust a "pass". **Tooling in place** (5.1): `npm run eval:calibrate`; the set still needs labelled items |
| 2 | ~~No consistency check~~ | **Addressed** by calibration replay (5.2), on the items in the set |
| 3 | No standard for writing rubric lines | Vague lines produce noisy verdicts |
| 4 | Nothing re-checks old verdicts when the judge model or prompt changes | A judge change could silently shift every score. **Tooling in place**: `--replay` re-grades the set with the current judge (5.1) |
| 5 | All lines weigh the same | A critical safety line ("fails closed") can be outvoted by cosmetic lines at a 0.5 threshold |
| 6 | ~~Very long transcripts were cut at 1.5M chars, keeping the start and losing the end~~ | **Addressed** by compact transcripts (5.8): the end of the run is now the last thing to lose detail, and trimming is flagged |
| 7 | ~~The judge only sees the diff, so it can't verify unchanged code~~ | **Addressed** by opt-in `workspaceAccess` (5.7), for cases that turn it on |

---

## 5. The plan

### 5.1 Calibration: measure the judge against humans (tool exists, set is empty)

This is the most important step, because it's the only one that produces a number.

**The idea.** Take runs that already happened. A person decides the correct verdict for every rubric line, without looking at the judge's verdict. A script then counts where the person and the judge disagree. Those disagreements are judge errors, or lines too vague to grade.

In standard eval terms, the human verdicts are **golden labels**: answers you trust to be correct, used to test a grader. The judge is checked against them the way a thermometer is checked in ice water. The check doesn't change how the thermometer measures. It tells you whether to believe it.

**What the labels are not.**

- **They never reach the judge.** It has no memory. Every grading is a fresh call with only the rubric and the run's evidence (see `judge/*.md`). The labels are for us: they decide which lines the judge may grade alone.
- **They're not the baseline.** `baseline.json` (`npm run eval:approve`) tracks how the **agent** changes over time. Calibration labels check the **judge**.
- **You don't label every run.** You label a line once, on a few runs. Every eval run after that is graded by the judge alone.

**The unit is one verdict:** one rubric line on one run. `approve-payment` has 11 lines, so one graded run gives 11 verdicts to label.

#### Step by step

1. **Add runs to the set.** Pick a finished eval run and a case:

   ```
   npm run eval:calibrate -- add --case code-mode-approve-payment --run 2026-11-16T13-14-58-413Z
   ```

   Every judge-graded run of that case becomes an **item**: a folder in `evals/calibration/`. Runs that failed before grading (a broken build, say) have no verdicts and are skipped. `--number N` takes only run N, and `--run` defaults to the latest run. An existing item is never overwritten, so labels are safe.

   ```
   evals/calibration/<case>__<target>__<run>__<run-id>/
     evidence.json   what the judge grades: rubric, final message, diff, raw transcript
     evidence.md     the same, as the judge reads it (generated, read-only)
     labels.json     your verdicts, pass: null until you fill them in
     verdicts.json   the judge's verdicts from the original run
     workspace/      the run's files, for cases with workspaceAccess
   ```

   **Workspace cases.** For a case with `workspaceAccess`, the run's workspace is copied in without `node_modules` and `.git`. It must still exist, so run the eval with `--keep-workdirs` first. Without it, the item works for the free comparison (step 4) but replay skips it. Lines about installed packages lose their evidence when `node_modules` is left out; a replay of such a line is graded from `package.json` and the transcript only.

2. **Add near-misses ("seeded" items).** If every run did the job well, every correct answer is "pass", and a judge that always passes would score 100%. The false-pass rate can only be measured on lines a human failed. So copy an item folder, plant one mistake in `evidence.json`, and delete `verdicts.json` (the original verdicts no longer apply). Say what you changed in `note`:

   | Seeded mistake (edit the diff and final message) | Line that must now fail |
   |---|---|
   | The `catch` lets the payment through | "Fails closed: a declined, dismissed or failed approval denies the call…" |
   | The matcher is renamed to `"acme.submitPayment"` | "Matches submit_payment by the tool identifier the host actually passes…" |
   | The amount check is gone from `mcp-server` (in `workspace/`) | "Leaves submit_payment's server-side validation in mcp-server intact" |
   | The final message says the interceptor "fully secures payments" | "Explains … the server must still authorize and validate payments" |

   These are the near-misses the judge is most likely to wave through.

3. **Label, blind.** Open `evidence.md` (and `workspace/` if the case has one). For every line in `labels.json`, set `pass` to `true` or `false` and write the evidence in one sentence. **Don't open `verdicts.json` until you're done**: once you've seen the judge's answer, you tend to agree with it, and the calibration only measures that.

   ```json
   { "line": "Fails closed: a declined, dismissed or failed approval denies the call...",
     "pass": true,
     "evidence": "App.tsx: the catch returns { allow: false }; dismiss resolves false" }
   ```

   **If you can't decide a line, or two people label it differently, the line is the problem.** Reword it (5.3) before going further. Expect 1–2 minutes per verdict.

4. **Compare.**

   ```
   npm run eval:calibrate                 # against the recorded verdicts: free
   npm run eval:calibrate -- --replay 3   # send each item to the current judge 3 times: costs judge calls
   ```

   - **Recorded** compares your labels with what the judge said in the original run. No calls, no cost.
   - **Replay** grades the frozen evidence again with today's judge code: its prompt, compaction and model. It's how a judge change gets tested, and the only way to grade seeded items. Repeating also measures consistency (5.2).

   `--item TEXT` limits either one to items whose folder name contains TEXT. The console prints the numbers, and the full report, with every disagreement and both reasons, goes to `results/calibration-<time>.md`.

5. **Read the numbers.** Each verdict lands in one of four boxes:

   |  | Human: pass | Human: fail |
   |---|---|---|
   | **Judge: pass** | agree | **false pass** |
   | **Judge: fail** | false fail | agree |

   | Number | Meaning | Target |
   |---|---|---|
   | **Agreement** | verdicts where judge = human | ≥ 90% |
   | **False-pass rate** | judge passed ÷ all verdicts the human failed | **≤ 5%** |
   | **False-fail rate** | judge failed ÷ all verdicts the human passed | ≤ 10% |
   | **Flips** (replay only) | lines that got different verdicts on the same input | 0 |
   | **Lines** | the same counts per rubric line, worst first | fix the worst |

   **Worked example.** 200 labelled verdicts: humans said 150 pass and 50 fail. The judge passed 4 of the 50, a false-pass rate of 8%, which is too high. It failed 6 of the 150, a false-fail rate of 4%, which is fine. Agreement is (200 − 4 − 6) ÷ 200 = **95%**. High agreement can hide a bad false-pass rate, which is why the rates are reported separately.

   The result is **PASS**, **FAIL** (a target missed, so the command exits 1) or **INCOMPLETE**: nothing is labelled yet, or no line is labelled fail, so the false-pass rate can't be measured. Add seeded items to fix the second case. Unlabelled lines (`pass: null`) aren't counted.

6. **Find the cause of every disagreement.**

   | Cause | Example | Fix |
   |---|---|---|
   | **Judge error** | It believed the final message ("I matched the real tool id") instead of checking | Tighten the judge's system prompt or model, then replay |
   | **Line defect** | "A URL the app serves … through a repeatable step" can be read two ways | Reword the line (5.3), relabel it, replay |
   | **Missing evidence** | The proof is in unchanged code the judge can't see | Turn on `workspaceAccess` (5.7), or move the check into code |
   | **Label error** | The person missed something and the judge was right | Correct the label |

   A line that **flips** is almost always a line defect.

7. **Decide.** The targets apply to the set as a whole. On top of them, a line with **any** false pass or flip doesn't count towards a score: it goes back to `"type": "report"` until it's reworded and passes calibration again. A judge can be 95% right overall and still be wrong on the one line that guards the payment.

#### Keeping it current

The items are committed, so the set becomes a regression test for the judge. Run it again:

| When | What to do |
|---|---|
| The judge model, its system prompt or the transcript compaction changes | `--replay 3`. The change ships only if the result is still PASS |
| A rubric line is reworded | Update the line in the items' `evidence.json` and `labels.json`, check the label still holds, replay. A label whose line isn't in the rubric is reported as a **stray label** |
| A new case or line | Add 1–3 of its runs, and one seeded item if the line guards something important |
| A review finds a judge error in a real run (5.6) | Add that run, so the mistake is tested from then on |
| Ordinary eval runs | Nothing |

Over time the set grows out of the mistakes the judge actually makes.

**Size.** Start with 2–3 cases and 60–100 labelled verdicts, including at least 10 the human failed. Items hold the raw transcript, so each one is about 250 KB.

### 5.2 Consistency check (exists, through calibration replay)

Grade the same input several times. For each line:

- the same verdict every time → stable
- the verdicts differ → **unstable line**, reported as a **flip**

`npm run eval:calibrate -- --replay 3` does this on every calibration item without extra labelling: unlabelled lines still show their flips. An unstable line is almost always a **wording** problem, not a judge problem: the line can be read two ways. Reword it (5.3).

### 5.3 Rules for writing rubric lines (exists, through the eval-grading skill)

Agents apply these rules through the `eval-grading` skill (`.claude/skills/eval-grading/SKILL.md`), which also covers routing checks and reviewing verdicts. **Change a rule there and here together.**

Most judge errors start with the line. A good line is:

| Rule | Bad | Good |
|---|---|---|
| **One thing per line** | "Adds the interceptor, shows payment details and fails closed" | Three separate lines |
| **Observable in the evidence** | "Understands Code Mode well" | "Enables Code Mode in `aiWebConfig` in `app/src/App.tsx`" |
| **Says where to look** | "Uses the right tool name" | "Matches `submit_payment` by the identifier the host passes to the interceptor, as shown in the docs fetch or the installed types in the transcript" |
| **Says what fails** | "Handles declines" | "A declined, dismissed **or failed** approval denies the call" |
| **No judgement words** | "Clean", "good", "appropriate", "recommended" | Name the concrete property you mean |
| **Doesn't repeat a code check** | "Runs `npm run build` successfully" | Leave it to `deterministic.commands` |
| **Can be judged without the prompt** | "Shows the payment details", "Answers the question without changing files" | "Shows client, amount, currency and beneficiary", "Changes no files" |

Rule of thumb: **if two engineers could disagree about whether a line passed, the judge will too.**

The last rule exists because the judge doesn't see the case's prompt (see [5.9](#59-decision-the-judge-doesnt-see-the-prompt-for-now)). A line that only makes sense next to the request ("the details", "the question", "what the user asked for") has to name what it means.

### 5.4 Lifecycle of a rubric line (proposed)

```
new line ──► "report" ──► spot-check verdicts on 3–5 runs ──► counted line
                  │                         │
                  │                    verdicts wrong?
                  │                         ▼
                  └──────────────── reword the line
```

1. Every new line starts as `"type": "report"`. The type exists already; this makes using it a rule.
2. A human reads its verdicts and reasons on a few runs.
3. If the verdicts are right, remove the prefix. If not, reword the line and repeat.
4. Optionally, add a seeded calibration item for the line's most likely near-miss (5.1, step 2).

### 5.5 Critical lines (exists)

Some lines are about safety or correctness and must never be averaged away. Mark them `"type": "critical"`:

```json
{ "type": "critical", "assertion": "Fails closed: a declined, dismissed or failed approval denies the call" }
```

A run that fails a critical line fails the judge step **whatever the score**. Critical lines still count in the score like any other line, and other lines keep using the threshold. The judge never sees the type, so a critical line is graded exactly like a standard one; only the consequence differs. That makes a false pass on a critical line the most expensive mistake the judge can make, so critical lines are the first to calibrate (5.1).

### 5.6 Human review when scores change (proposed)

When a case's rubric score changes against the baseline:

1. Open the case report and read the **reasons** for the lines that changed.
2. Decide whether each change is a real agent change or a judge error.
3. Only then run `npm run eval:approve`.
4. If it was a judge error, add the run to the calibration set (`npm run eval:calibrate -- add`, 5.1) so it's tested from then on.

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
- **Harder to replay.** A calibration item for such a case needs the workspace too: it is copied in without `node_modules`, and only if the eval ran with `--keep-workdirs` (5.1, step 1).
- **Distraction.** With the whole project visible, the judge could grade the template's code rather than the agent's. The instructions tell it the diff is the agent's work, and the rubric decides what's checked.

**When to turn it on.**

- **Yes:** task cases whose rubric has "intact", "exactly once", "already", "only", "unchanged" or "installed version/types" lines.
- **No:** answer cases (there's no project to inspect) and rubrics that only ask about what was added.

A good habit: if a line can only pass by *trusting* the agent's final message, either turn on `workspaceAccess` or rewrite the line.

**Tests.**

- `test/engine-task.test.ts` checks that the judge gets the workspace path only when the case opts in, and that the agent's files are still on disk while it grades.
- `test/contract/judge.test.ts` checks, against the real judge, that with an **empty diff** it passes a line about code still present in the workspace and fails a line about a file that isn't there. It can only get both right by actually reading the files.

---

### 5.8 Compact transcripts (exists)

**The problem.** The judge used to get the raw transcript as JSON, cut at 1.5M characters. Two things were wrong with that:

1. **Half of it was noise.** On two real runs, 53% of the transcript was duplicate copies and bookkeeping: the SDK stores every tool result twice (`tool_use_result`) and every tool input twice (`wire_tool_inputs`), plus ids, token usage, timestamps and rate-limit events.
2. **The cut was at the wrong end.** Cutting at 1.5M kept the *start* and dropped the *end*, which is where the final edits, the build and the agent's own checks are: the most important evidence.

Real runs were about 200K characters, so the cut hadn't happened yet. But a long run would have been graded without its ending, silently.

**The fix: three layers** (`src/judge/compact-transcript.ts`). Only what the judge reads changes; `transcripts/*.json` stays complete.

| Layer | What it does | Why |
|---|---|---|
| 1. Compact | Turns the raw events into a numbered, readable log: the agent's messages and thinking, tool calls (name + input), tool results, and injected text such as a loaded skill. Duplicates and bookkeeping are dropped. Works for both Claude Code and Codex transcripts. | Less noise for the judge, and lower cost |
| 2. Cap each entry | Each tool result keeps its first 4,000 and last 2,000 characters, with a `[… N chars cut …]` marker. Tool calls get a larger cap (6,000 + 2,000). The agent's own text and thinking are never cut. | One huge file read or `npm install` log can't push out everything else |
| 3. Budget fallback | If the log is still over 1,000,000 characters, the **oldest** entries are cut down to 400 + 200 characters, one by one, until it fits. | The end of the run is the last thing to lose detail |

What the judge reads looks like this:

```text
[#7] tool call Read (toolu_01…)
{"file_path":"app/src/App.tsx"}

[#8] tool result (toolu_01…)
import { … } from "@interopio/ai-web";
…
[… 12,345 chars cut …]
…

[#9] assistant
Code Mode is enabled in aiWebConfig.
```

The judge's instructions explain the format and say: *don't assume what a cut part contained*. Entry numbers let its reasons point at specific evidence ("#8 shows…").

**Measured on real runs:**

| Run | Raw | Sent to judge | Entries shortened | Trimmed |
|---|---|---|---|---|
| approve-payment | 218,283 chars | 64,535 chars (−70%) | 3 | no |
| add-code-mode | 191,494 chars | 51,229 chars (−73%) | 3 | no |

**How to tell when it mattered:**

- The `<transcript>` tag the judge gets says how many entries there were, how many were shortened, and whether the log was trimmed.
- The run's `judge/` file shows the same numbers in a table at the top, followed by the full input.
- A case with any trimmed run gets a **"judge transcript trimmed"** note in the console, and the run's report link says so. Treat verdicts on those runs with more care: the judge had less detail than usual.

**What's still not covered.** A line whose only evidence sits in the *middle* of a very large tool result can still be missed: the cap keeps the start and end of each result. When that matters, turn on `workspaceAccess` (5.7) so the judge can read the file itself, or point the rubric line at evidence that is easier to see.

**Tests.** `test/compact-transcript.test.ts` covers each layer on Claude and Codex shapes. `test/engine-answer.test.ts` checks that the `judge/` file is written, linked from the report and flagged when trimmed, and that it's also written when the judge fails.

### 5.9 Decision: the judge doesn't see the prompt (for now)

**Status:** decided 2026-11-16, to revisit once the calibration set (5.1) exists.

**The question.** The judge gets the rubric, the final message, the diff and the transcript, but not the case's `input.prompt` or `input.reply`. Should it?

**What it already sees.** Not nothing. The transcript contains the agent's *own rewording* of the request, for example its skill call:

```text
[#1] tool call Skill
{"skill":"io-intelligence","args":"Can Code Mode ask the user for confirmation before submitting a payment? Set it up."}
```

The scripted reply can also appear where the agent asked a question and got it back as an answer. So the real choice is **the real request vs the agent's version of it**, not "the request vs nothing".

**Why we're leaving it out: it can bias the judge.**

| Bias | What happens | Example |
|---|---|---|
| **Grading the request instead of the rubric** | The judge asks "did it do what the user wanted?" rather than checking each line | It fails a line because the overall answer felt incomplete, or passes one because the user's need was met in some other way |
| **Filling in gaps** | Knowing the intent, it reads vague evidence charitably | "The user wanted approval before payment and there's an approval prompt, so 'fails closed' is probably fine" |
| **Matching words** | A final message that repeats the prompt's wording looks like it did the work | "I set up confirmation before submit_payment" is just the request restated |
| **Excusing choices** | "Use your recommended defaults" in the reply gets read as permission for anything | It passes a guessed version number because the user said to use defaults |

The first two are the dangerous ones: they create **false passes**, the error that matters most (section 2).

DeepEval gives the same advice for G-Eval's `evaluation_params`: include only the inputs your criteria refer to, because extra fields add noise and can shift scores.

**What we give up by leaving it out.**

| Reason to include it | How we cover it instead |
|---|---|
| Lines that only make sense next to the request ("answers the question") | **Rule:** every line must be judgeable without the prompt (5.3) |
| Vague lines that the request would explain ("the payment details") | Same rule: name the concrete things |
| **Spotting misreadings:** if the agent misunderstood the request, the judge only sees the misunderstanding | **Not covered.** This is the real cost. Deterministic checks (files, flow, `mustInclude`) catch some misreadings; the rest is a known gap |

**How we'll settle it: measure it, don't argue it.** Once the calibration set (5.1) exists:

1. Grade the same labelled runs twice: as now, and with the prompt added.
2. Compare agreement and **false-pass rate** between the two.
3. If the prompt raises the false-pass rate, keep it out. If it lowers it, through misreadings caught and nothing else made worse, add it.

The saved `judge/` files (5.8) make this cheap: they're the exact inputs to replay, and the only change is one added section.

**If we add it later, frame it narrowly:**

- Put it in its own `<request>` section, after the rubric.
- Instruct the judge: *"This is context only. Grade each rubric line on its own evidence. Don't pass or fail a line because of how well the request was met overall."*
- Optionally make it a per-case opt-in (like `workspaceAccess`), used only for cases where catching a misreading matters.

## 6. Summary

| Question | Answer today | Answer after the plan |
|---|---|---|
| How accurate is the judge? | Unknown until items are labelled; `npm run eval:calibrate` measures it (5.1) | Agreement and false-pass rate, measured on labelled items |
| Is it consistent? | Measurable: `--replay 3` reports flips (5.2) | Unstable lines found and reworded |
| Are our rubric lines good? | Depends on the author | Written to rules, proven as `"report"` lines first |
| Can a critical failure hide? | **No, for lines marked `"type": "critical"`** (5.5): failing one fails the run | Same |
| What if we change the judge? | `--replay` re-grades the set with the new judge | Calibration must pass before the change ships |
| Who checks surprising verdicts? | Whoever notices | A defined step before every baseline approval |
| Can it verify code the agent didn't change? | **Yes, for cases that opt in** with `workspaceAccess` (5.7) | Same, used wherever the rubric needs it |
| Can a long run lose its evidence? | **No longer silently**: the transcript is compacted, the end is kept, trimming is flagged (5.8) | Same |
| Can we see what the judge saw? | **Yes**: `judge/<run>.md` per graded run, also on failure | Same; `evidence.md` in each calibration item shows the same view for labelling |
| Does the judge see the user's request? | **No, on purpose**: avoids bias; lines must be self-contained (5.9) | Decided by measuring false passes with and without it |

**Next: fill the calibration set (5.1).** The tool exists; the labelling is the work. The calibration set turns "we think the judge is right" into "the judge agrees with humans 95% of the time and wrongly passes 3% of lines that should fail". The other steps make that number better and keep it from slipping.

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
