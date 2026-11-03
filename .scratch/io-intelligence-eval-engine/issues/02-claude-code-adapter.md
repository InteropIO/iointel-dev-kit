# 02: Claude Code target (real trigger runs)

**What to build:** Trigger cases targeting `claude-code/<model>` run against the real Claude Agent SDK, using the working copy of the `io-intelligence` skill in a fully isolated temp folder. The result tells the author whether the skill triggered.

**Blocked by:** 01 (Engine skeleton).

**Status:** ready-for-agent

- [ ] Each run unit gets a fresh temp folder, with the skill's working copy installed where Claude Code discovers project skills.
- [ ] Only the project setting source is loaded: no user skills, plugins, `CLAUDE.md` or MCP servers leak in.
- [ ] Triggering is detected from a Skill tool call naming `io-intelligence`, and recorded as `skill-tool`.
- [ ] The adapter returns the final message, transcript, trigger result, cost and stop reason through the shared adapter interface.
- [ ] The model comes from the target (Sonnet 5.5 as the default).
- [ ] API keys load from the gitignored env file. A missing key for a selected target fails fast, before any run, with a clear error.
- [ ] Temp folders are cleaned up unless kept for debugging.
- [ ] An opt-in contract test (a separate script that needs keys) runs one positive and one negative trigger case and asserts a valid result and correct detection.
