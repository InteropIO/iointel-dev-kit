# 12: Flow snapshots for Codex runs

**What to build:** Codex runs produce flow snapshots in the same format as Claude runs, so flows can be compared across targets and flow checks and baseline flow comparisons work for Codex too.

**Blocked by:** 05 (Flow snapshots for Claude runs), 11 (Codex target).

**Status:** ready-for-agent

- [ ] The Codex flow extractor maps raw Codex events to the shared snapshot format, with the same normalization rules as Claude.
- [ ] Codex reads done through shell commands (e.g. reading `SKILL.md` or a reference file) become read steps, not command steps.
- [ ] Odd-run flagging, flow checks and the markdown flow files work for Codex targets.
- [ ] Extractor tests run against saved real Codex transcripts.
