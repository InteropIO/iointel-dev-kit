# 10: Task cases: build commands and judge review of the diff

**What to build:** Task cases run their command list (e.g. install, type-check, build) and fail on a non-zero exit. When the commands pass, the judge reviews the workspace diff and final message against `reviewRubric`, so a project that builds but is wired wrong is still caught.

**Blocked by:** 04 (Judge rubric grading), 09 (Task case setup and containment).

**Status:** ready-for-agent

- [ ] `checks.commands` run in order in the workdir after the agent finishes. A non-zero exit fails the run, and the output tail is kept in the results.
- [ ] `checks.reviewRubric` is graded by the judge using the workspace diff, the final message and the transcript.
- [ ] The full stage order is files, `package.json`, commands, review, stopping at the first failure, so no judge cost is spent on a broken build.
- [ ] Engine tests use trivial fixture projects with real commands and a fake judge.
