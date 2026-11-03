# 01: Engine skeleton with trigger cases and a fake adapter

**What to build:** A skill author can write a trigger case as YAML, run the eval command, and see a pass/fail summary table plus a saved results folder. Behind this is the `runEval(options, deps)` seam, driven in this ticket by a scripted fake adapter. This is the base every later ticket builds on. See the spec: `docs/specs/io-intelligence-eval-engine.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A self-contained eval package exists in the repo, outside the skill folder, with TypeScript, Vitest and an `eval` script.
- [ ] Trigger case files are discovered and validated with Zod (`id`, `kind`, required non-empty `targets`, `prompt`, `expectSkill` defaulting to true, optional `repeat` and `passThreshold`). Any invalid case fails the whole run before anything runs, with a clear message.
- [ ] Cases expand into case × target × repeat run units; `--repeat` defaults to 3.
- [ ] `--kind`, `--case` and `--target` filter the run; `--target` only filters and never overrides a case's targets.
- [ ] Trigger cases pass when at least 2/3 of runs match `expectSkill`; a per-case threshold overrides this.
- [ ] Engine dependencies (adapters keyed by tool, judge, optional clock and filesystem) are passed into `runEval`; the engine imports no SDKs.
- [ ] The console shows a summary table per case × target.
- [ ] Each run writes a timestamped results folder (gitignored) with a summary JSON and each run unit's transcript.
- [ ] The process always exits 0.
- [ ] Engine tests cover validation, expansion, filtering, the threshold and negative trigger cases, using only `runEval` and a fake adapter.
