# Practitioner & AI-lab practices for building trust in LLM-judge outputs

Source URLs used throughout:
- Anthropic, "Demystifying evals for AI agents": https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic docs, "Create strong empirical evaluations": https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- Hamel Husain, "Creating a LLM-as-a-Judge That Drives Business Results": https://hamel.dev/blog/posts/llm-judge/
- Hamel Husain & Shreya Shankar, "LLM Evals FAQ": https://hamel.dev/blog/posts/evals-faq/
- judgy (Husain/Shankar course library): https://github.com/ai-evals-course/judgy
- Eugene Yan, "Evaluating the Effectiveness of LLM-Evaluators": https://eugeneyan.com/writing/llm-evaluators/
- Eugene Yan, "AlignEval": https://eugeneyan.com/writing/aligneval/
- Shankar et al., "Who Validates the Validators?" (EvalGen): https://arxiv.org/abs/2404.12272
- applied-llms.org, "What We've Learned From A Year of Building with LLMs": https://applied-llms.org/
- OpenAI, "Evaluation best practices": https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI, HealthBench paper: https://arxiv.org/html/2505.08775
- OpenAI, PaperBench paper: https://arxiv.org/html/2504.01848

## 1. Judge-alignment workflows recommended by practitioners

### Takeaway
The practitioners agree on one loop. Look at real outputs first, have a single domain expert give binary pass/fail labels with written critiques, build the judge prompt from those critiques, and measure it against held-out human labels with TPR/TNR (not raw agreement) until it agrees well enough. Repeat the loop when the system or model changes. Criteria come out of looking at the data; you cannot fully specify them in advance.

### Cited Findings
**Husain, "critique shadowing" (7 steps)** — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
1. Pick the one or two principal domain experts whose judgment defines success. Developers should not act as the expert.
2. Build a dataset that covers the key dimensions (features, scenarios, personas), using real data, synthetic data, or both, and log everything.
3. The expert gives a binary pass/fail plus a detailed critique, written so "a new employee could follow" it.
4. Fix pervasive errors, then return to step 3.
5. Build the judge iteratively, using the expert critiques as few-shot examples, and refine until agreement is acceptable.
6. Run error analysis: failure rates by dimension, root causes in traces.
7. Add specialized judges only if needed, since some errors are better caught by code assertions.
- The whole process "repeats whenever something material changes, such as a model update" — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Case study: Honeycomb's Query Assistant judge reached >90% agreement with the domain expert in 3 iterations, on a dataset of about 50% failures — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Starting size: about 30 examples, continuing until new failure modes stop appearing — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Validation size: about 100 examples per failure mode, with enough Pass and Fail in each class. Below about 60, confidence intervals are often too wide — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/). The FAQ says "Label 100 to 200 examples for each failure mode", with at least 50 pass and 50 fail as a minimum — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Data splits: train 10–20% (the few-shot pool), dev 40–45%, test 40–45%, with 30–50 examples per label in dev and test. Dev and test examples never go into the prompt, and the frozen judge runs on test once — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Overfitting warning: "After many rounds, it may do well on the dev set but poorly on new examples" — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- "Treat the human labels as ground truth and report the judge's True Positive Rate and True Negative Rate separately." Worked example: if errors occur 5% of the time, an always-Pass judge gets 95% agreement and catches nothing — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Build one judge per failure type, not one judge for overall quality — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Include full context in judge examples (user metadata, system state), shown on one review screen, and use the strongest judge model the cost and latency budget allows — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Husain on the judge as a forcing function: building one is "a nice 'hack' I use to trick people into carefully looking at their data." He also says "I don't think you can eliminate humans completely, because the LLM still needs to be aligned to something" — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- Expert's comment after reviewing judge reasoning: "Seeing how the LLM breaks down its reasoning made me realize I wasn't being consistent." Calibration runs in both directions — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)

**Error analysis, open coding and axial coding** — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- "Error analysis is the most important activity in evals."
- Open coding: annotate at least 30 traces yourself before using LLM-suggested codes. Axial coding: group the notes into a failure taxonomy ("Axial coding is the most important step").
- Review at least 100 traces, and stop at theoretical saturation, when new reviews stop revealing failure modes.
- Re-run error analysis after significant changes. In practice, review cycles "range from 2-4 weeks."
- For agents, "Annotate only the first failure in the trace at first", because downstream failures cascade from it. A transition failure matrix (rows = last successful state, columns = where the first failure occurred) shows where to look first.

**Correcting the measured pass rate for judge error (judgy)** — [judgy](https://github.com/ai-evals-course/judgy)
- Inputs: human labels and judge predictions on a labelled test set, plus judge predictions on unlabelled data.
- Correction (a Rogan–Gladen-style estimator): θ̂ = (p_obs + TNR − 1) / (TPR + TNR − 1), with a bootstrap confidence interval (default 20,000 iterations, 95% level).
- Valid only when TPR + TNR > 1, meaning the judge is better than random.
- The FAQ states the principle: once a judge's TPR/TNR are known, "you can correct its estimates to determine the actual failure rate" — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)

**Eugene Yan, AlignEval: "label first, then criteria, then evaluate the evaluator"** — [AlignEval](https://eugeneyan.com/writing/aligneval/)
- Steps:
  1. Label input/output pairs with binary pass/fail before writing any criteria, "so you don't hunt for defects that don't exist."
  2. Write one prompt per dimension that returns 0/1.
  3. Measure precision, recall, F1, Cohen's κ, and the TP/FP/TN/FN counts.
  4. Optimize on dev and confirm on the held-out test set.
- Example run: F1 went from 0.571 to 0.722 on dev and reached 0.727 on test.
- Sample size: 20 labels is too few, because metrics swing between reruns from LLM stochasticity. Aim for 50–100 labels.
- Motto: "Align AI to human. Calibrate human to AI. Repeat."

**Shankar et al., criteria drift** — [arXiv 2404.12272](https://arxiv.org/abs/2404.12272); quoted in [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- "It is impossible to completely determine evaluation criteria prior to human judging of LLM outputs."
- EvalGen asks users to grade a subset of outputs, then uses those grades to choose among candidate code and LLM evaluators.

**Eugene Yan on metrics** — [llm-evaluators](https://eugeneyan.com/writing/llm-evaluators/)
- He prefers classification metrics (recall on bad responses, false positive rate, κ) over correlation, and is "skeptical of correlation metrics."
- Example: llama-3-8b had 80% raw agreement but only κ = 0.62.
- Target: LLM-human agreement close to human-human agreement.

### Inferences
- For an eval engine grading coding-agent runs, this suggests one binary judge per rubric line, a human-labelled golden set of past runs per rubric line, and TPR/TNR reported per line on a held-out split. The prompt should be frozen once it is validated against the test split.
- The prompt's examples (train split) should be stored separately from the validation labels so they cannot leak into the prompt.
- Reported pass rates could be bias-corrected with the judgy formula and carry confidence intervals, instead of being shown as raw judge pass rates.

### Gaps
- I found no published guidance from Jason Liu or Lilian Weng specifically on judge-calibration workflows within the budget. I did not fetch these, so they are not covered.
- No source gives a specific numeric TPR/TNR threshold for when a judge is "trusted enough". Practitioners describe it as "acceptable agreement" set per business context.

## 2. What AI labs publish about their own judge practices

### Takeaway
Anthropic's guidance:
- Use deterministic graders where possible.
- Calibrate LLM graders against human experts and give them an "Unknown" escape hatch.
- Use one isolated judge per dimension.
- Read transcripts before trusting scores.
- Separate capability evals from regression evals and use multiple trials.

OpenAI's published benchmarks validate the grader formally. They treat grader-vs-expert agreement as a meta-eval, compare it to expert-vs-expert agreement, and pick the judge on the cost/accuracy frontier.

### Cited Findings
**Anthropic, "Demystifying evals for AI agents"** — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Three grader types:
  - Code-based: fast, cheap, reproducible, brittle.
  - Model-based: flexible, but non-deterministic and needing calibration.
  - Human: the gold standard, used to calibrate model graders, but slow.
- Guidance: "choosing deterministic graders where possible", LLM graders where necessary, and humans "judiciously for additional validation."
- Scores can be combined as weighted (threshold), binary (all must pass), or hybrid.
- "LLM-as-judge graders should be closely calibrated with human experts."
- Give the judge an escape hatch such as "Unknown" to reduce hallucinated grades. Grade each dimension with an isolated judge rather than one judge for all dimensions.
- Once the system is robust, human review can drop to occasional spot checks. Research-eval rubrics should be "frequently calibrated against expert human judgment."
- "You won't know if your graders are working well unless you read the transcripts and grades from many trials." The transcript shows whether the agent really failed or the grader rejected a valid solution. "Failures should seem fair."
- "we do not take eval scores at face value" until someone has read the transcripts and grading details.
- Task hygiene:
  - Each task gets a reference solution that passes all graders, which proves the task is solvable.
  - A good task is one where two domain experts independently reach the same verdict.
  - A 0% pass rate over many trials usually means "a broken task, not an incapable agent."
- Case: Opus 4.5 scored 42% on CORE-Bench until fixes raised it to 95%. The fixes covered rigid grading (it rejected "96.12" against a longer expected decimal), ambiguous specs, and irreproducible tasks.

**Anthropic docs, "Create strong empirical evaluations"** — [platform.claude.com](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
- Ranking:
  1. Code-based: "Fastest and most reliable."
  2. Human: "Most flexible and high quality, but slow and expensive. Avoid if possible."
  3. LLM-based: "Test to ensure reliability first, then scale."
- Tips for LLM grading:
  - "Have detailed, clear rubrics." A use case "might require several rubrics."
  - "Be empirical or specific", for example output only 'correct'/'incorrect' or a 1–5 score.
  - "Encourage reasoning": use a grader with thinking on.
- "Generally best practice to evaluate with a different model from the one used to generate the evaluated output."
- "More questions with slightly lower signal automated grading is better than fewer questions with high-quality human hand-graded evals."

**OpenAI, "Evaluation best practices"** — [developers.openai.com](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- "Use pairwise comparison or pass/fail for more reliability."
- Use the strongest judge you can, and ask for reasoning before the score.
- Control for length, position, and verbosity bias.
- Scale the judge only once it "consistently agrees with human annotations."
- "Maintain agreement: Use human feedback to calibrate automated scoring." Use "show rather than tell" score examples and take consensus votes among human reviewers.
- Anti-patterns:
  - Vibe-based evals.
  - Datasets that don't match production traffic.
  - Relying only on generic metrics such as BLEU or perplexity.
  - Waiting until after shipping to build evals.
- Practice: "Log as you develop so you can mine your logs for good eval cases."
- The page says the OpenAI Evals platform is being deprecated, with shutdown on 30 Nov 2026.

**OpenAI HealthBench (grader meta-evaluation)** — [arXiv 2505.08775](https://arxiv.org/html/2505.08775)
- Data: the grader was checked against physician labels on 34 consensus criteria, giving about 60,896 meta-examples.
- Metric: macro F1 over the met and not-met classes (random = 0.50).
- Chosen grader: GPT-4.1, with macro F1 0.709. It beat o4-mini (0.692) and o3 (0.681), and was cheaper than the reasoning models.
- Physician comparison:
  - Physician macro F1 ranged from 0.569 to 0.730 by theme.
  - The grader sat at the 37.5th–88.2nd percentile of physicians and beat the average physician in 5 of 7 themes.
  - Physician-physician and model-physician agreement both fall around 55–75%.
- Run-to-run variance over 16 runs had std ≈ 0.002.
- "Worst-at-k" reliability takes the worst score over k samples. o3's worst-at-16 is about a third lower than its 60% overall score.

**OpenAI PaperBench (JudgeEval)** — [arXiv 2504.01848](https://arxiv.org/html/2504.01848)
- Validation set: an auxiliary JudgeEval benchmark of partial replications graded by human experts at the leaf level. Judges are scored with binary classification metrics, macro-averaged across papers.
- F1 vs cost per paper:

  | Judge | F1 | Cost per paper |
  |---|---|---|
  | Random | 0.49 | $0 |
  | GPT-4o-mini | 0.59 | $8 |
  | GPT-4o | 0.73 | $120 |
  | o1-mini | 0.78 | $72 |
  | o1 | 0.84 | $830 |
  | o3-mini | 0.83 | $66 |

- o3-mini was chosen as the most cost-effective judge.
- F1 differs by requirement type: Code Development 0.72, Execution 0.82, Result Match 0.94.
- Rubric:
  - A weighted tree of 8,316 leaf nodes over 20 papers.
  - Leaves are graded binary pass/fail and broken down until an expert could check one in under 15 minutes.
  - Each parent's score is the weighted mean of its children.
- The authors say the judge is "not as accurate as an expert human" and is non-deterministic. Expert grading of one attempt can take tens of hours.

### Inferences
- The labs' working standard is that a judge is good enough when its agreement with experts is within the expert-vs-expert range. That requires measuring human-human agreement first.
- PaperBench's per-type F1 suggests reporting judge reliability per rubric-line category. Judges are weaker on subjective "code quality" lines than on checkable "result matches" lines.
- Picking the judge model is a measured cost/F1 trade-off, not "always use the strongest model."

### Gaps
- I did not retrieve GDPval's grading-validation details, or any Google DeepMind or Meta published judge practices, within the budget.
- Anthropic does not publish its internal judge-agreement numbers in the sources I read.

## 3. Operational handling: golden sets, IAA, drift, spot checks, versioning, transcripts, capability vs regression, trials

### Takeaway
Standard operations:
- Keep a hand-validated golden set split train/dev/test.
- Measure inter-annotator agreement (Cohen's κ) only if you use multiple annotators; most small teams use a "benevolent dictator."
- Re-run error analysis every 2–4 weeks or after any material change.
- Promote production failures into the CI set.
- Keep capability evals (low pass rate) separate from regression evals (~100%).
- Run multiple trials, reporting pass@k or pass^k depending on whether one success or consistency matters.

### Cited Findings
- **Golden set hygiene:** "Hand-validate every ground-truth label used to test an LLM judge." Skipping validation means "your judges may not reflect your actual quality criteria" — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Annotators:** For most small and medium companies, "appointing a single domain expert as a 'benevolent dictator' is the most effective approach."
- **Inter-annotator agreement:** With multiple annotators, label the same examples independently and measure Cohen's κ. Resolve disagreements by updating the rubric, relabelling, and escalating to the domain expert — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Expert-label reliability:** Expert-vs-expert agreement can itself be modest. HealthBench reports 55–75% — [HealthBench](https://arxiv.org/html/2505.08775). Agreement with non-expert annotators can look inflated: "the results could be overinflated if the annotators were non-experts" — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
- **Drift and recalibration:**
  - Criteria drift means reviewers' definition of good shifts as they see more data.
  - The judge workflow repeats on material changes such as model updates — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
  - Scores may stop being comparable as the eval set changes, so pair them with product metrics — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Production monitoring:**
  - Sample live traces and run judges asynchronously.
  - Track confidence intervals: "If the lower bound crosses your threshold, investigate further."
  - When production reveals new failure patterns, "add representative examples to your CI dataset."
  - In CI, "Favor assertions or other deterministic checks over LLM-as-judge evaluators."
  - Source: [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Spot checks and daily review:**
  - Review a sample of logged inputs and outputs every day, and add data review to the on-call rotation — [applied-llms.org](https://applied-llms.org/)
  - Anthropic: human review can drop to "occasional spot checks" once the system is robust — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - Combine targeted error searches with random sampling after the first iterations — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
- **Reading transcripts:** Anthropic treats reading transcripts as required before trusting graders or scores. It is how grader bugs were found, for example CORE-Bench going from 42% to 95% — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- **Capability vs regression:**
  - Capability evals start low, giving "a hill to climb." Regression evals sit near 100%. High-passing capability tasks "graduate" into the regression suite.
  - "An eval at 100% tracks regressions but provides no signal for improvement" — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - Husain: if "everything keeps passing", run the eval less often or retire it — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Trials and nondeterminism:**
  - Run multiple trials. pass@k is the chance of at least one success in k tries, for cases where one success matters. pass^k is the chance that all k succeed, for consistency.
  - Example: a 75% per-trial rate gives pass^3 ≈ 42%.
  - Give each trial a clean, isolated environment. Shared git history gave Claude unfair advantages in some internal evals.
  - Source: [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - HealthBench's worst-at-k is a similar consistency metric — [HealthBench](https://arxiv.org/html/2505.08775)
- **Judge nondeterminism with small samples:** With 20 labels, judge metrics fluctuate across reruns from LLM stochasticity — [AlignEval](https://eugeneyan.com/writing/aligneval/)
- **Regression via judge:** Rerun tracked production examples against a new prompt and use the judge to find regressions. Do pairwise comparisons twice, swapping the order — [applied-llms.org](https://applied-llms.org/)

### Inferences
- An engine that approves "baselines" is a regression-eval workflow. Before approving one, a human should read the judge verdicts on lines that changed and on a random sample, since Anthropic does not trust a score until someone has read the transcripts.
- Judge prompt and judge model ID should be versioned together with the golden-set TPR/TNR they were validated at. Changing either invalidates comparability and should trigger revalidation on the test split. This follows from "repeat on material change", though no source spells out a versioning scheme.

### Gaps
- None of the sources I read describe a concrete judge-versioning scheme, such as pinning model snapshot IDs or storing a prompt hash. That practice is inferred, not cited.
- I found no source specifying a disagreement-review-queue tool or workflow beyond "resolve disagreements by updating the rubric / escalating to the domain expert."
- No source gives a fixed recalibration cadence for the judge itself, apart from the 2–4 week error-analysis cycles and re-running on material change.

## 4. Cost/benefit: code vs LLM vs human; outcomes vs trajectories; abstain option; per-criterion judges

### Takeaway
Use code wherever a rule can decide, an LLM judge only for criteria that need judgment, and humans to calibrate the judge and spot-check it. Grade the outcome rather than the exact path, and use step-level diagnostics only to debug failures. Give the judge one binary criterion at a time and an "Unknown" option.

### Cited Findings
- **Code first:**
  - Use code when a rule can identify the failure, such as JSON parsing or correct tool arguments. Use an LLM judge when the failure "requires human judgment." Expensive evaluators are for problems you will iterate on repeatedly — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
  - Code-based grading is "Fastest and most reliable"; human grading is to be avoided where possible — [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
- **Classifiers beat judges at scale:** "conventional classifiers and reward models can achieve higher accuracy" at lower cost and latency than an LLM judge — [applied-llms.org](https://applied-llms.org/)
  - Yan: in development, use an LLM API with CoT and few-shot examples. For a production guardrail, fine-tune a classifier — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
  - "You would almost never use a slow or non-deterministic LLM-as-Judge as a synchronous guardrail" — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Outcomes over paths:** "grade what the agent produced, not the path it took." Required tool-order checks are "overly brittle." Use partial credit for multi-part tasks — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - Husain's two-phase approach: first black-box end-to-end success, then step-level diagnostics on the workflows that fail most.
  - Check tool name, arguments, result, and resulting state separately — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- **Abstain or "Unknown":** Anthropic recommends giving the judge an escape hatch to reduce hallucinated grades — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - applied-llms recommends allowing ties in pairwise comparisons — [applied-llms.org](https://applied-llms.org/)
- **Per-criterion isolated judges:** Anthropic grades each dimension with an isolated judge — [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
  - Husain uses one judge per failure mode — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
  - Yan uses one prompt per dimension — [AlignEval](https://eugeneyan.com/writing/aligneval/)
  - PaperBench uses binary leaf criteria small enough to check in under 15 minutes — [PaperBench](https://arxiv.org/html/2504.01848)
- **Binary over Likert:**
  - "Binary evaluations force clearer thinking and more consistent labeling." Likert annotators "often default to middle values." To track gradual progress, use several binary sub-checks — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
  - Binary decisions are "more precise, have higher consistency among raters" — [applied-llms.org](https://applied-llms.org/)
  - Counterpoint: Anthropic's docs still show 1–5 Likert graders as acceptable ("output only 'correct' or 'incorrect', or to judge from a scale of 1–5") — [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
- **Pairwise vs direct scoring:** Use pairwise for subjective criteria (it is more stable) and direct scoring for objective ones like faithfulness. Reference-based grading works when gold answers exist — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
- **Reasoning before the verdict:**
  - Grader with thinking on — [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
  - CoT before scoring — [OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  - Caveat: over-reasoning hurt GPT-4 in PoLL, and an explicit "don't overthink" instruction helped — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
- **Panels:** PoLL, a panel of smaller models, correlated better with humans than GPT-4 alone at one-seventh the cost — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
- **Different judge model:** Evaluate with a different model from the one that generated the output — [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
  - Self-enhancement bias: GPT-4 gave its own outputs about a 10% higher win rate, claude-v1 about 25% — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)

### Inferences
- For a coding-agent engine:
  - Deterministic checks (tests pass, files exist, build succeeds) carry the outcome.
  - The LLM judge covers only rubric lines that cannot be coded, each judged in isolation with pass/fail/unknown.
  - An "unknown" verdict should go to a human review queue, not count as a pass or a fail.
- Judging transcripts or trajectories is justified for process criteria, such as "didn't modify unrelated files" or "asked before destructive action". It should not be used to require a particular path.

### Gaps
- I found no quantitative cost comparisons for code graders vs judges vs humans, other than PaperBench's dollars-per-paper figures.

## 5. Anti-patterns teams warn about

### Takeaway
The recurring warnings:
- Trusting judge scores without measuring them against humans, or measuring with raw agreement on imbalanced data.
- Generic off-the-shelf metrics.
- Likert-scale sprawl.
- Developers acting as the domain expert.
- Not reading data or transcripts.
- Rigid path or format grading.
- Saturated evals.
- Overfitting the judge prompt to the dev set.

### Cited Findings
- Husain's list — [hamel.dev/llm-judge](https://hamel.dev/blog/posts/llm-judge/)
  - Many metrics on 1–5 scales.
  - Off-the-shelf metrics without validation ("these tend to cause more confusion than value").
  - Developers acting as the expert.
  - Raw agreement under class imbalance.
  - Terse or missing critiques.
  - Judge examples missing external context.
  - Non-diverse examples.
  - Not reading the data.
  - Jumping to specialized judges before critique shadowing.
  - Fine-tuning judges by default.
- Generic evals "waste time and create false confidence when you use them as quality measures." BERTScore and ROUGE are generally not useful for LLM outputs — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Judge prompt overfit to the dev set after many iterations — [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/); signalled by divergence between dev and test — [AlignEval](https://eugeneyan.com/writing/aligneval/)
- Writing criteria before looking at outputs, which leads you to hunt for defects that don't exist — [AlignEval](https://eugeneyan.com/writing/aligneval/); [arXiv 2404.12272](https://arxiv.org/abs/2404.12272)
- From [anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents):
  - Brittle exact-format grading (CORE-Bench "96.12").
  - Tasks that penalize instruction-following (METR threshold tasks).
  - One-sided evals: "One-sided evals create one-sided optimization."
  - Graders that can be hacked.
  - Shared state between trials.
  - Taking scores "at face value."
- Judge blind spots and biases — [Eugene Yan](https://eugeneyan.com/writing/llm-evaluators/)
  - GPT-4-turbo failed to lower scores for perturbed answers more than 50% of the time in several categories.
  - Verbosity bias above 90% for claude-v1 and GPT-3.5.
  - Position bias: GPT-3.5 50%, claude-v1 70%.
  - gpt-3.5-turbo caught only 30–60% of inconsistent summaries.
- Goodhart's law: over-optimizing one eval (for example Needle-in-a-Haystack) can hurt real tasks — [applied-llms.org](https://applied-llms.org/)
- Vibe-based evals, evals that don't match production traffic, and generic academic metrics — [OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

### Inferences
- A judge that rarely says "fail" on a mostly-passing baseline set can look excellent on raw agreement. TNR on known-bad runs is the number to watch, so the golden set should deliberately include seeded failing runs (Honeycomb used about 50% failures).

### Gaps
- No primary-source quantitative data on how often production judges silently drift after a provider-side model update. This is a widely cited concern, but I found no measurements in the sources read.
