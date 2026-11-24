---
name: eval-grading
description: Grading for the evals in evals/cases. Use when writing or changing a case's output checks or judge rubric, auditing existing rubric lines, or reviewing judge verdicts after an eval run (before approving a baseline).
---

# Eval grading

A case's grading is everything under `output`: the **deterministic** checks the engine runs as code, and the **judge** rubric that Claude Opus grades line by line as pass/fail. Grading is good when every verdict is decided by **evidence** the grader actually has, and a pass means the behaviour really happened.

The error that matters most is the **false pass**: the judge says pass where a careful human would say fail. It hides real bugs. Every choice below is made to prevent one.

Field syntax, matchers and defaults: `evals/README.md` ("Case shape" and the per-kind sections) and `evals/src/cases/schema.ts`. Why the judge works the way it does: `evals/docs/judge-governance.md`.

Pick the branch:

- **Writing or changing grading** → [Authoring](#authoring)
- **Checking existing rubric lines** → apply [Line rules](#line-rules) to every line, then report each failing line with a rewrite
- **A run finished and verdicts need checking** → [Reviewing verdicts](#reviewing-verdicts)

## Authoring

1. **List the behaviours.** Read the case's `input` (prompt, reply, template) and the skill material it exercises (e.g. `skills/io-intelligence/references/*.md`, and docs-ai.interop.io pages it cites). Write down every behaviour a correct run must show and every mistake a plausible wrong run would make. Done when each item is one observable fact about the result, and the mistakes include the near-misses (guessed names, defaults that allow instead of deny, values copied from a docs example).
2. **Route each behaviour to the cheapest grader that can decide it.** Code first:
   - files that must exist → `files`
   - dependencies → `packageJson`
   - it builds or tests pass → `commands`
   - it read, ran or fetched something → `flow` (`mustRead`, `mustRun`, `mustFetch`, `mustNotRead`)
   - answer text contains or avoids something → `mustInclude` / `mustNotInclude`
   
   Everything code can't decide goes to the rubric. Done when every behaviour has exactly one home, and no rubric line repeats a deterministic check.
3. **Write the rubric lines** and apply every [line rule](#line-rules) to every line. Done when each line passes all rules.
4. **Set the judge options:**
   - `threshold`: leave at the default `1` (every counted line must pass). Lower it only when the user asks, and record why in `note`. A line that must never fail stays a separate concern: a low threshold can average a critical miss away, so keep critical behaviours in deterministic checks where possible.
   - Line `type`: every rubric item is `{ "assertion": "...", "type"?: "critical" | "report" }`.
     - `"report"` on every **new** line: graded and shown, but not counted until its verdicts are proven (step 6).
     - `"critical"` on a proven line that guards safety or correctness (fails closed, keeps validation): failing it fails the run whatever the score. This is how a critical behaviour survives a threshold below 1.
     - No type: a standard line, counted in the score.
   - `workspaceAccess: true`: turn it on for task cases with a line about code the agent didn't change. Signal words: *intact, unchanged, still, exactly once, only, already, installed version, installed types*. Without it the judge only has the diff and must trust the agent's word. Answer cases have no project to read, so leave it off there.
   
   Trigger cases take no judge at all.
5. **Validate for free**, from `evals/`:
   ```
   npx tsx -e 'import("./src/cases/loader.ts").then(m => m.loadCases("cases")).then(c => console.log("ok", c.length)).catch(e => { console.error(e.message); process.exit(1) })'
   ```
   Done when it prints `ok`.
6. **Prove the new lines.** Runs cost money, so ask the user before running `npm run eval -- --case <id>`. After a run, review the verdicts of every `"report"` line ([Reviewing verdicts](#reviewing-verdicts)). Remove `"type": "report"` only from lines whose verdicts were right on every run you checked. Reword the others and keep them as report lines.

## Line rules

Each rubric line is one binary claim the judge can settle from the evidence it gets: the final message, the diff, a compacted transcript, and (with `workspaceAccess`) the workspace files. **The judge never sees the case prompt**, on purpose: the prompt biases it towards grading the request instead of the line.

| Rule | Weak line | Strong line |
|---|---|---|
| **One claim** | "Adds the interceptor, shows the details and fails closed" | Three lines |
| **Observable** in the evidence | "Understands Code Mode" | "Enables Code Mode in `aiWebConfig` in `app/src/App.tsx`" |
| **Names where to look** when the proof isn't in the diff | "Uses the right tool name" | "Matches `submit_payment` by the identifier shown in the fetched docs or the installed types" |
| **Spells out the failing cases** | "Handles declines" | "A declined, dismissed or failed approval denies the call" |
| **Concrete words** in place of judgement words (*clean, good, appropriate, recommended, correct*) | "Uses the recommended version" | "Takes the version from the npm registry and the installed host's range" |
| **Self-contained**: judgeable with no prompt | "Shows the payment details", "Answers the question" | "Shows client, amount, currency and beneficiary", "Changes no files" |
| **Code can't decide it** | "Runs `npm run build` successfully" | Move it to `commands` |

The test for every line: **two engineers reading the same run would give the same verdict.** If they could disagree, the judge will flip between runs.

## Reviewing verdicts

The verdict is a claim, and you check it the way you'd check any claim: against the evidence.

1. **Find the verdicts to check**, in `evals/results/<run-id>/`: every failed line, every `"report"` line, and every case whose rubric score changed against the baseline (console notes, or `change` in `summary.json`). Done when you have a list of (case, run, line) to check.
2. **Check each one against the evidence the judge had.** Open `reports/<case>.md` for the verdict and reason, then the run's `judge/<case>__<target>__<n>.md` for exactly what the judge was sent. Settle the line yourself from the diff, the transcript entries (`#n`) and, if needed, the transcript in `transcripts/`. Classify:
   - **correct**: the evidence supports the verdict
   - **false pass**: passed, but the evidence doesn't show it (often: the judge trusted the final message)
   - **false fail**: failed, but the evidence does show it
   - **line defect**: you can't settle it either, because the line is ambiguous or its evidence isn't available to the judge
   
   Done when every listed verdict has a class and a one-line reason that cites the evidence.
3. **Act on each class.**
   - Line defect → rewrite it with the [line rules](#line-rules). If its evidence lives in unchanged code, turn on `workspaceAccess`.
   - False pass or false fail on a sound line → report it as a judge error, with the run and the evidence, and propose adding the run to the calibration set: `npm run eval:calibrate -- add --case <id> --run <run-id> --number <n>` (`judge-governance.md` §5.1). The labels are the user's to write.
   - Run notes "judge transcript trimmed" → the judge saw less detail than usual. Weigh its verdicts on that run with extra care.
4. **Report** to the user: a table of case, line, verdict, class and reason, then the proposed rewrites. The baseline moves only on the user's word: `npm run eval:approve` runs when they ask for it.
