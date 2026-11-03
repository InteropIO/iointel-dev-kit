# 04: Judge rubric grading for answer cases

**What to build:** Answer cases can have a `rubric`. A fixed Opus 5.5 judge grades each rubric line pass or fail with a one-line reason, so subtler correctness is checked and the author sees exactly what was missed.

**Blocked by:** 03 (Answer cases with deterministic checks).

**Status:** ready-for-agent

- [ ] The judge implements `grade(rubric, output, transcript) → lines[{ text, pass, reason }]` and is injected through the engine's deps.
- [ ] The judge sees the final message and the transcript.
- [ ] The judge model is fixed to Opus 5.5 whatever the target.
- [ ] The judge runs only after deterministic checks pass, so failing runs cost nothing extra.
- [ ] A run passes only if every rubric line passes. The report and results JSON list each line's verdict and reason.
- [ ] Judge cost is included in run and case costs.
- [ ] Engine tests use a fake judge. An opt-in contract test checks the real judge on a tiny rubric with one line that should pass and one that should fail.
