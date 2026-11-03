# 09: Task cases: workspace setup, containment and structural checks

**What to build:** A skill author can write task cases that start from an official template, a fixture or an empty folder. The agent works contained in its temp folder, and the case checks that expected files exist and that `package.json` has the expected dependencies.

**Blocked by:** 03 (Answer cases with deterministic checks).

**Status:** ready-for-agent

- [ ] The schema accepts the `task` kind with `setup` (`template`, `fixture` or empty) and `checks.files` / `checks.packageJson`.
- [ ] Template setup uses the skill's own template materializer; fixture setup copies a folder from the eval package.
- [ ] The workspace's starting state is recorded so a diff can be produced later.
- [ ] A `canUseTool` guard in the Claude adapter rejects file writes and Bash commands that point outside the workdir.
- [ ] Task-case defaults apply: 40 turns and 10 min (others keep 15 turns and 3 min), with per-case overrides. Hitting a limit shows as a stop reason in the report.
- [ ] Checks run in order (files, then `package.json`), stopping at the first failure.
- [ ] Task cases pass only if every run passes, and the built-in trigger check applies.
- [ ] Engine tests use a fake adapter that writes scripted files into real temp folders. The contract test shows the guard blocking a write outside the workdir.
