# 03: Answer cases with deterministic checks and network control

**What to build:** A skill author can write answer cases with `mustInclude` and `mustNotInclude`, and mark a case `network: false` to check that the bundled references are enough. Invented package names and APIs get caught for free.

**Blocked by:** 02 (Claude Code target).

**Status:** ready-for-agent

- [ ] The schema accepts the `answer` kind with `mustInclude` and `mustNotInclude`, each entry a plain string or a `/regex/`.
- [ ] Checks run against the final message, and each failed check is reported with the expectation that failed.
- [ ] Every answer case also checks triggering (`expectSkill` defaults to true); a run where the skill didn't trigger fails.
- [ ] Answer cases pass only if every run passes.
- [ ] `network` defaults to true. With `network: false`, the Claude adapter removes web tools, and the report says so.
- [ ] Engine tests cover string and regex matching, the every-run-must-pass rule and the built-in trigger check.
