# 07: Baseline comparison of results and eval:approve

**What to build:** Each run is compared against a committed baseline, so the author sees per-case and per-target regressions and improvements (e.g. a trigger rate dropping from 90% to 60%). `eval:approve` deliberately promotes the latest run to the baseline.

**Blocked by:** 01 (Engine skeleton).

**Status:** ready-for-agent

- [ ] A committed baseline file holds case results (pass/fail, pass rates, cost) for each case × target.
- [ ] Each run compares against it and shows regressions, improvements, new cases and removed cases in the console and the results JSON.
- [ ] With no baseline committed, the comparison falls back to the most recent local run, and the report says which it used.
- [ ] `eval:approve` promotes the latest run to the baseline (or a run named by an option).
- [ ] Engine tests cover the diff, the fallback and approve.
