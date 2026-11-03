# 13: --baseline mode (skill removed)

**What to build:** With `--baseline`, every run unit also runs with the skill removed, and the report shows how much the skill adds per case and target. This shows whether the skill helps and catches edits that make it worse than having no skill.

**Blocked by:** 02 (Claude Code target).

**Status:** ready-for-agent

- [ ] `--baseline` adds a skill-removed run for every run unit; the workspace manager doesn't install the skill for those runs (for every target, including Codex once it exists).
- [ ] The report shows with-skill vs. without-skill results (trigger and pass rates) per case and target.
- [ ] Skill-removed runs never affect pass or fail, and are kept apart from with-skill runs in the results JSON.
- [ ] Engine tests cover `--baseline` with a fake adapter.
