# 06: Per-case flow checks

**What to build:** A skill author can lock in a corner case they found by adding `flow.mustRead`, `flow.mustNotRead` or `flow.mustRun` to any case. A violated check fails the run.

**Blocked by:** 05 (Flow snapshots for Claude runs).

**Status:** ready-for-agent

- [ ] The schema accepts an optional `flow` block on any case kind; entries are strings or `/regex/`.
- [ ] `mustRead` and `mustNotRead` match read steps; `mustRun` matches command and script steps.
- [ ] A violated flow check fails the run like any other deterministic check, and the report names the check.
- [ ] Engine tests cover each check type passing and failing.
