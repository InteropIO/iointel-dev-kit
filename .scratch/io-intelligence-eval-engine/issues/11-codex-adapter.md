# 11: Codex target

**What to build:** Any case can target `codex/<gpt-model>`, so the author sees how the skill behaves for Codex users, side by side with Claude Code in the same report.

**Blocked by:** 02 (Claude Code target).

**Status:** ready-for-agent

- [ ] The skill's working copy is installed where Codex discovers skills, in each temp folder.
- [ ] Runs use Codex's `workspace-write` sandbox limited to the workdir, with the model taken from the target.
- [ ] Triggering is detected from any command that touches the installed skill's `SKILL.md`. That rule lives in one function, and runs record detection as `skill-md-read`.
- [ ] The adapter returns the final message, transcript, trigger result, cost and stop reason through the shared interface, and respects `network: false`.
- [ ] A missing OpenAI key fails fast when a Codex target is selected.
- [ ] An opt-in contract test runs one positive and one negative trigger case and checks that the sandbox blocks a write outside the workdir.
