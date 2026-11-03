# 08: Flow comparison against the baseline

**What to build:** Approved flow snapshots are committed with the baseline. Each run shows how each case's flow changed (e.g. "no longer reads core.md", "a build retry appeared"), so changes in behaviour after a skill edit stand out.

**Blocked by:** 05 (Flow snapshots for Claude runs), 07 (Baseline comparison of results).

**Status:** ready-for-agent

- [ ] `eval:approve` stores the flow snapshots for each case × target in the baseline, alongside results.
- [ ] Each run reports flow differences against the baseline: steps added or removed, different reads, changed exit codes, a different order.
- [ ] Flow differences appear in the console summary and are highlighted in each case's markdown flow file.
- [ ] Flow differences never affect pass or fail.
- [ ] Engine tests cover the differences reported and approve storing flows.
