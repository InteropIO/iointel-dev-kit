# 14: Cost cap, concurrency and cost reporting

**What to build:** The author can cap spending per run with `--max-cost` and control parallelism with `--concurrency`. The report shows cost per case, per target and in total, so mistakes can't run up a large bill and expensive cases are easy to spot.

**Blocked by:** 02 (Claude Code target).

**Status:** ready-for-agent

- [ ] `--concurrency` sets how many run units run at once (default 4).
- [ ] `--max-cost` (USD) stops new run units from starting once the cost so far reaches the cap. Units already running finish, and skipped units are marked in the report.
- [ ] Cost (agent plus judge) is shown per case, per target and for the whole run, in the console and the results JSON.
- [ ] Engine tests cover the cap stopping new units, using a fake adapter with scripted costs and a fake clock.
