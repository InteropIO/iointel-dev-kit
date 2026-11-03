# 05: Flow snapshots for Claude runs

**What to build:** Every Claude run records a normalized flow snapshot: the ordered key steps (skill loaded, reads, fetches, skill scripts, commands with exit codes, writes). Runs that took a different route from the other repeats are flagged, and a markdown flow file per case shows them side by side, so corner cases are visible even when everything passed.

**Blocked by:** 02 (Claude Code target).

**Status:** ready-for-agent

- [ ] A shared flow snapshot format exists (step kinds: skill-loaded, read, fetch, script, command with exit code, write; plus stop reason, turns and cost).
- [ ] The Claude flow extractor maps raw transcripts to snapshots. Paths are relative to the workdir or skill root; temp names, timestamps, ids and message wording are dropped; minor tool calls are left out.
- [ ] Two runs that took the same route produce identical snapshots.
- [ ] Repeats are grouped by identical snapshots, and runs outside the majority group are flagged as odd. This never affects pass or fail.
- [ ] Each case gets one markdown flow file in the results folder: numbered steps for every run and target, odd runs highlighted.
- [ ] The console shows a short flow summary (cases with odd runs).
- [ ] Snapshots are saved per run unit in the results folder.
- [ ] Extractor tests run against saved real Claude transcripts. Engine tests cover grouping and flagging with scripted snapshots.
