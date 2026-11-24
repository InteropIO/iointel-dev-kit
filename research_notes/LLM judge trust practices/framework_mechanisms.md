# LLM-as-judge design and judge-trust mechanisms across eval frameworks (as of Nov 2026)

Scope note: sources were fetched on 2026-11-18. Where a doc page did not state a version or date, that is noted. Frameworks I could not verify from primary sources in this pass (Ragas, W&B Weave, Anthropic Console eval tool, Arize Phoenix current 2.x API details, Vertex autorater validation claims) are listed under Gaps rather than described from memory.

## Q1. What does the judge design look like in each framework (prompt templates, scales, structured output, reasoning-before-score, reference answers)?

### Takeaway
The common design across frameworks is: a templated prompt holding the input, the output, and a criterion or reference, plus reasoning before the score, then a constrained output (a regex-parsed GRADE, a JSON {reason, score, pass}, or a choice label mapped to a number). A newer second tier lets the judge use tools or a workspace (promptfoo `agent-rubric`, Claude Code `plugin eval` graders that read files and traces) or breaks the rubric into a graph of small judgments (DeepEval DAG).

### Cited Findings

**UK AISI Inspect (inspect_ai)**
- `model_graded_qa()` has another model judge whether the output is correct based on grading guidance in `target`. `model_graded_fact()` is a narrower variant that checks whether the output contains the fact in `target`. Default metrics are `accuracy` and `stderr`. — [Inspect Scorers](https://inspect.aisi.org.uk/scorers.html)
- Parameters:
  - `template` (variables `{question}`, `{answer}`, `{criterion}`, `{instructions}`, `{grader_nonce}`, plus any non-colliding `Sample.metadata` keys).
  - `instructions`: the default asks for chain-of-thought and then a final `GRADE: C` or `GRADE: I`.
  - `grade_pattern`: a regex. The default takes the *last* `GRADE: X` in the output.
  - `include_history`: False by default. True shows the full chat history, or you can pass a function that formats the history.
  - `partial_credit`: when True, a partial grade becomes 0.5.
  - `model`: one model or a list.
  - `model_role`: defaults to `"grader"`.
  - Grader model precedence is the explicit `model`, then the model bound to the `grader` role, then the model under evaluation. — [Inspect Model Grading](https://inspect.aisi.org.uk/model-graded.html)
- **Prompt-injection hardening:** each field (for example the submission) is wrapped in markers that carry a random 8-hex nonce, such as `[BEGIN SUBMISSION (3f9a1c7e)]`, regenerated on every grading request. The template tells the grader to treat the task and submission as data, not instructions. Documented side effect: caching cannot reuse earlier grader responses, and re-scoring may not reproduce the original grades exactly. — [Inspect Model Grading](https://inspect.aisi.org.uk/model-graded.html)
- A scorer can return a dict-valued score. Each key gets its own metrics, glob keys such as `"*": [mean()]` apply to every key, and you can add a metric over the whole dict. This gives multi-criterion rubric output from one scorer. — [Inspect Multiple Scorers](https://inspect.aisi.org.uk/multiple-scorers.html)

**OpenAI Graders API (Evals and RFT)**
- Grader types documented: `string_check` (eq, neq, like, ilike), `text_similarity` (fuzzy_match, bleu, gleu, meteor, cosine, rouge variants, with a `pass_threshold`), `score_model`, and `python`.
  - `score_model`: `input` chat messages, `model`, `range`, `pass_threshold`, and `sampling_params` (`seed`, `top_p`, `temperature`, `max_completions_tokens`, `reasoning_effort`). Structured output is `{"result": float, "steps": [{"description", "conclusion"}]}`, so reasoning steps come before the result. Output is clamped to `range`, and non-numeric output becomes 0.
  - `python` grader: defines `grade(sample, item) -> float`. It runs sandboxed with no network, a 2-minute limit, 2GB of memory, and image tag `2025-05-08`.
- The page says graders are being deprecated, with no timeline given. `label_model` and `multi` were not on the fetched page. — [OpenAI Graders guide](https://developers.openai.com/api/docs/guides/graders)

**promptfoo**
- `llm-rubric`: the judge returns JSON `{reason, score 0.0-1.0, pass}`.
  - An optional `threshold` applies. If both a threshold and an explicit `pass` are present, both must be met.
  - `rubricPrompt` is a custom system and user message array with `{{output}}` and `{{rubric}}`.
  - The judge provider can be overridden via `--grader`, `defaultTest.options.provider`, or `assertion.provider`; the most specific setting wins.
  - `not-llm-rubric` inverts the check. Grader errors count as failures in both directions.
  - The default judge depends on the available API keys (for example `gpt-5` or `claude-sonnet-5`). — [promptfoo llm-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/)
- **`agent-rubric` (agent-as-a-judge):** the judge is a coding-agent provider.
  - Supported providers: `openai:codex-sdk` (default), `anthropic:claude-agent-sdk` / `anthropic:claude-code`, `opencode:sdk`, and Codex app-server. Plain text models are rejected.
  - The default sandbox is a read-only temp dir with no approvals and no access to project files. Setting `working_dir` lets the grader inspect files.
  - If the target used `copy_working_dir`, the grader runs in that call's workspace and sees files as the agent left them.
  - Output has the same `{reason, pass, score}` shape. Tool-call metadata is kept on the grading result, along with `metadata.agentProvider`.
  - The docs recommend keeping grader workspaces read-only. The page was last updated Nov 18 2026, and no release version was given. — [promptfoo agent-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/agent-rubric/)

**DeepEval**
- `DAGMetric` is a rubric expressed as a decision graph:
  - `TaskNode` extracts or transforms evidence and does not score.
  - `BinaryJudgementNode` makes one yes/no criterion with exactly one True and one False verdict.
  - `NonBinaryJudgementNode` classifies into enumerated string verdicts.
  - Terminal verdicts map to fixed scores from 0 to 10, which are divided by 10.
  - The graph structure and the verdict-to-score map are deterministic. Each node's judgment still comes from an LLM.
  - A verdict can delegate to a `GEval` or another metric via `then`.
  - Parameters: `threshold` (default 0.5; None means score-only), `strict_mode` (forces threshold 1), `verbose_mode` (prints nodes and outcomes), and `include_reason` (default True).
  - Guidance: use DAG when rules and gates define the rubric, and G-Eval for one holistic judgment.
  - Under `hybrid`/`system_one` eval modes, judgement nodes are decided by "Jev" while task nodes stay on the LLM. — [DeepEval DAG](https://deepeval.com/docs/metrics-dag)

**Braintrust (autoevals + platform scorers)**
- `LLMClassifier(name, prompt_template, choice_scores)`: the judge picks a label, and `choice_scores` maps labels to numbers, for example `{"A":1,"B":0.5,"C":0}`. `use_cot=True` makes the judge reason before choosing. — [autoevals PyPI](https://pypi.org/project/autoevals); [Braintrust LLM-as-a-judge](https://docs.braintrust.dev/evaluate/llm-as-a-judge.md)
- Platform features:
  - Scorers return a number and classifiers return a label. CoT reasoning for classifiers is stored in metadata.
  - `__pass_threshold` is set between 0 and 1.
  - "Allow skip" lets the judge abstain. Skipped cases return null and are excluded from averages.
  - Trace-level scorers run once per trace and see the full conversation via `{{thread}}`, with a preprocessor controlling serialization.
  - Group scope evaluates multi-trace sessions.
  - Online scoring rules run on production logs.
  - Structured decision judge models such as "TypeSafe Jev" are offered. — [Braintrust LLM-as-a-judge](https://docs.braintrust.dev/evaluate/llm-as-a-judge.md)

**MLflow GenAI**
- `make_judge(name, instructions with {{ inputs }}/{{ outputs }}, feedback_value_type e.g. Literal[...], model)` defines a custom judge, which can be aligned and registered. — [MLflow judge alignment](https://mlflow.org/docs/latest/genai/eval-monitor/scorers/llm-judge/alignment/)

**Google Vertex AI Gen AI evaluation**
- Adaptive rubrics: `GENERAL_QUALITY` (the recommended default) generates per-prompt rubrics covering instruction following, formatting, tone, and style. Rubrics can be generated separately for review and reuse, and steered with natural-language `guidelines`. Targeted variants include `INSTRUCTION_FOLLOWING`, `TEXT_QUALITY`, and multi-turn versions.
- Static rubrics include `GROUNDING`, `SAFETY`, `FLUENCY`, and custom rubrics.
- Computation-based metrics (`exact_match`, `bleu`, `rouge`) need ground truth. Custom code metrics run either locally or in a remote sandbox (no network, 1-minute limit, 1.5GB).
- Agent metrics: `final_response_reference_free`, `final_response_quality`, `hallucination`, `tool_use_quality`. — [Vertex AI determine-eval](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/determine-eval)

**Patronus GLIDER / Lynx**
- GLIDER is a small judge fine-tuned from Phi-3.5-mini (3.8B per the paper, 3B per the docs) with a CC BY-NC 4.0 license.
- It scores against user-defined criteria and rubrics on 0-1, 1-3, or 1-5 scales. Output is reasoning bullets, then a highlight section listing the spans that most influenced the score, then an integer score.
- The paper reports that the highlight spans improved benchmark performance.
- Patronus docs say GLIDER is retired as a product and the platform is no longer offered. — [GLIDER arXiv 2412.14140](https://arxiv.org/html/2412.14140v2); [Patronus docs](https://docs.patronus.ai/docs/research_and_differentiators/Glider); [HF model card](https://huggingface.co/PatronusAI/glider)

**Arize Phoenix**
- `llm_classify` with `rails` constrains output to the allowed labels, and `provide_explanation=True` returns a label plus a rationale. — [Phoenix evals with explanations](https://docs.arize.com/phoenix/learn/evaluation/evals-with-explanations)
- Phoenix Evals 2.x moved to `create_classifier` with an `LLM` object and ships a `PrecisionRecallFScore` metric. — [arize-phoenix-evals PyPI](https://simple-repository.app.cern.ch/project/arize-phoenix-evals)

**Galileo**
- ChainPoll is a CoT-based hallucination judge with human-readable justifications. Galileo claims an aggregate AUROC of 0.781 on RealHall (vendor claim).
- Luna is a family of small evaluation models that can be fine-tuned on customer data. — [Galileo ChainPoll](https://www.plushcap.com/content/galileo/blog/galileo-chainpoll); [Galileo Luna](https://galileo.ai/blog/introducing-galileo-luna-a-family-of-evaluation-foundation-models)

**Claude Code `claude plugin eval` (requires Claude Code v2.1.269+)**
- **Case layout:** each case is a prompt plus graders, one `.md` per grader with frontmatter `type`, `weight`, and `arm`; the body is the rubric. There are no custom-code graders.
- **Grader types:**
  - Free deterministic graders: `regex`, `tool_used`, `tool_order`, `file_exists`.
  - Judge graders:
    - `llm`: a judge votes PASS on the rubric in at least 2 of 3 votes.
    - `baseline`: the judge decides whether the run satisfies the criteria at least as well as a reference transcript `.jsonl`.
- **What graders see:** `target`/`focus` can be the final reply, the `trace`, or `{source: file, path}`.
  - For `trace`, an `llm` judge sees only the first 12 and last 12 messages.
  - Image files are shown to the judge as images, and other binaries are refused.
- **Judge model:** defaults to the background-task model and is overridden with `--judge-model`.
- **Run scoring:** each case runs 3 times by default. A run's score is the weighted fraction of graders that passed, and a case's score is the mean across runs.
- **Baseline and Δ:** a no-plugin baseline arm gives `WITH`, `W/OUT`, and `Δ`. Graders that can only pass with the plugin (`tool_used: Skill`, `arm: with-only`) are reported `scored: false` so they don't inflate Δ.
- **Rubric guidance:**
  - Keep `llm` graders for short outputs, with rubrics written as concrete PASS/FAIL conditions.
  - Grade long files with regex.
  - Pair one result grader with one process grader (`tool_used`/`tool_order`).
  - If `tool_used: Skill` passes but Δ is negative, "suspect the judge before the plugin". Small judges mark correctly formatted-differently answers wrong.
- **Isolation:** the agent cannot read the eval directory, so it can't see the prompt, graders, or sibling cases. Shell grants run under an OS sandbox.
- **Reporting and CI:**
  - The HTML report shows each judge's votes and the evidence excerpt it judged.
  - The JSON output is versioned (`schemaVersion: 1`) and carries `claudeVersion`, cost, and `skippedPaidGraders`.
  - The CI guidance is to pin both `--model` and `--judge-model` so scores stay comparable over time.
- Source for all of the above: [Claude Code plugin evals](https://code.claude.com/docs/en/plugin-evals.md)

### Inferences
- A reasonable design to borrow:
  - Run deterministic checks (regex, tool usage, file existence) first.
  - Then use a short-input LLM judge with concrete PASS/FAIL rubric lines and reasoning before the verdict.
  - Parse the verdict with a strict pattern (the last GRADE token, or JSON), and allow abstain/skip.
- For coding-agent transcripts, frameworks avoid feeding the full transcript to a plain judge. Claude Code truncates to the first 12 and last 12 messages, and Braintrust uses a preprocessor. When evidence is in files, they give the judge workspace access instead (promptfoo agent-rubric). This supports a "compact transcript + read-only workspace" judge design.
- Inspect's nonce-delimited fields are a cheap defense worth copying when transcripts contain adversarial or instruction-like text. It trades away exact cache replay, so log raw judge outputs if reproducibility matters.

### Gaps
- I did not fetch the current docs for Ragas (aspect critic, rubric scores), W&B Weave scorers, LangSmith's evaluator prompt format, DeepEval's G-Eval internals (evaluation_steps, probability-weighted scoring), or the Anthropic Console Evaluate tool.
- The OpenAI `label_model` and `multi` grader specs were not on the fetched page.

## Q2. What trust mechanisms are built in (alignment to human labels, annotation queues, few-shot from corrections, agreement metrics, epochs/reducers, ensembles, confidence, explanations, versioning, determinism, audit)?

### Takeaway
Trust mechanisms fall into four families:
- **Repetition plus reduction:** Inspect epochs and reducers, Claude plugin eval's 3 runs and 2-of-3 votes.
- **Judge panels with agreement statistics:** Inspect's multi-model majority vote and `krippendorff_alpha`.
- **Human-label calibration loops:** LangSmith Align Evals and few-shot corrections, MLflow/Databricks `align()`, Galileo CLHF.
- **Auditability:** stored per-judge votes, explanations, evidence excerpts, re-scoring of logs, and pinned judge models.

Inspect has the most rigorous statistics. LangSmith and MLflow have the strongest human-alignment workflows.

### Cited Findings

**Repetition, reducers, ensembles (Inspect)**
- `Epochs(n, reducer)` controls repetition. Built-in reducers:
  - `mean` (default), `median`, `mode`, `max`.
  - `majority`: more than half must agree, otherwise the sample is unscored.
  - `pass_at_{k}`, `pass_k_{k}` (all k succeed), `at_least_{k}`.
  - `collect`: keeps the raw list.
- Multiple reducers can run at once, for example `Epochs(5, ["at_least_2","at_least_5"])`. Epochs marked excluded (NaN) are dropped. — [Inspect Metrics](https://inspect.aisi.org.uk/metrics.html)
- Judge panels:
  - Passing a list of grader models runs each one independently. Votes are combined with `multi_scorer()` using the `"majority"` reducer, which needs more than half.
  - A grader with no parseable grade withholds its vote without lowering the threshold, so a diminished panel yields unscored rather than an order-dependent grade.
  - Individual votes are stored in score `metadata["panel"]`. `reducer="mode"` gives plurality voting. — [Inspect Model Grading](https://inspect.aisi.org.uk/model-graded.html)
- Agreement and uncertainty statistics:
  - `krippendorff_alpha(level="nominal"|"ordinal"|"interval", to_float=...)` measures inter-judge agreement. It requires `multi_scorer(..., reducer="collect")`.
  - Clustered standard errors: `stderr(cluster="category")`. `ci()` and `ci_wilson()` also accept `cluster=`. — [Inspect Metrics](https://inspect.aisi.org.uk/metrics.html); [Inspect Multiple Scorers](https://inspect.aisi.org.uk/multiple-scorers.html)
- Audit and re-scoring:
  - `--no-score` defers scoring.
  - `inspect score` re-scores existing logs with a new or changed scorer without regenerating outputs. `--action append` keeps the old scores alongside the new ones, and output goes to a new `-scored` file by default.
  - `score(log, model_graded_qa(model=...))` does the same in Python.
  - Scores can be edited after manual review (see Editing Logs). — [Inspect Scoring Workflow](https://inspect.aisi.org.uk/scoring-workflow.html)

**Repetition and voting (Claude Code plugin eval)**
- Each `llm` grader takes three judge votes per run and passes on 2 of 3. Cases run 3 times by default.
- The report exposes the judge's votes and the excerpt judged. Both the agent model and the judge model are pinned in CI.
- Recorded agent-mock answers can be adopted into `mocks/.replay/` so later runs replay them deterministically. — [Claude Code plugin evals](https://code.claude.com/docs/en/plugin-evals.md)

**Determinism controls (OpenAI)**
- `score_model` exposes `seed`, `temperature`, and `top_p`. `temperature` is not supported for reasoning models, where `reasoning_effort` is used instead. — [OpenAI Graders](https://developers.openai.com/api/docs/guides/graders)

**Human-label alignment: LangSmith**
- Align Evals was announced July 29 2025. Workflow:
  1. Pick criteria.
  2. Pick representative good and bad outputs.
  3. Humans grade them, building a "golden set".
  4. Iterate on the evaluator prompt in a playground.
- The UI shows an "alignment score" per prompt version, side-by-side human and LLM scores, sorting to surface misaligned cases, and a saved baseline score for comparing prompt versions. The post does not define how the score is computed. — [LangChain: Introducing Align Evals](https://www.langchain.com/blog/introducing-align-evals)
- Few-shot from corrections:
  - Human corrections to judge outputs are stored in a few-shot dataset and injected into the evaluator prompt on future runs (default 5 examples). Explanations attached to corrections fill a `few_shot_explanation` variable.
  - Limits: mustache prompts only, not prompt-hub prompts, and run-level evaluators only (not thread-level). — [LangSmith few-shot evaluators](https://docs.langchain.com/langsmith/create-few-shot-evaluators); [LangChain blog](https://blog.langchain.dev/aligning-llm-as-a-judge-with-human-preferences/)

**Human-label alignment: MLflow / Databricks**
- `judge.align(traces, optimizer)` uses traces that carry both a judge assessment and a human assessment under the same assessment name.
  - Human feedback is added via "Add Feedback" in the UI or `mlflow.log_feedback` with a HUMAN source.
  - Optimizers: MemAlign (default, dual memory), DSPy SIMBA, DSPy GEPA, or custom.
  - At least 10 traces are required.
  - The aligned judge is saved with `aligned_judge.register(experiment_id=...)`.
  - The docs give an example of comparing original and aligned accuracy against human labels, and claim 30-50% fewer false positives and negatives (no methodology given). — [MLflow judge alignment](https://mlflow.org/docs/latest/genai/eval-monitor/scorers/llm-judge/alignment/)
- MemAlign distills natural-language feedback into guidelines (semantic memory) and keeps salient examples (episodic memory). It needs only a handful of feedback examples. — [MLflow MemAlign blog](https://mlflow.org/blog/memalign/); [Databricks MemAlign blog](https://www.databricks.com/blog/memalign-building-better-llm-judges-human-feedback-scalable-memory)
- Databricks workflow: SMEs label outputs in MLflow labeling sessions, then `align()` calibrates the judge. — [Databricks football chatbot blog](https://www.databricks.com/blog/self-optimizing-football-chatbot-guided-domain-experts-databricks)
- Caveat: Arklex says MemAlign assumes independent examples while agent conversations are not independent, so they adapted it for multi-turn. — [Arklex blog](https://arklex.ai/home/blogs/from-annotation-to-alignment)

**Human-label alignment: Galileo CLHF**
- Reviewers mark judge outputs agree or disagree and explain why. The metric is then prompt-tuned with few-shot examples. Galileo claims AUPRG gains after about 5 annotated records (vendor claim). — [Galileo CLHF blog](https://galileo.ai/blog/introducing-continuous-learning-with-human-feedback)

**Human-label alignment: Braintrust**
- Braintrust advises comparing candidate judge models "on representative examples with human-assigned scores", including ambiguous and failing cases. The fetched page has no dedicated calibration feature. — [Braintrust LLM-as-a-judge](https://docs.braintrust.dev/evaluate/llm-as-a-judge.md)

**Benchmarking judges: Arize Phoenix**
- Arize says its templates were benchmarked on labeled datasets (HaluEval, WikiQA), with targets of 70-90% precision and 70-85% F1. Users can reproduce this with scikit-learn's `precision_recall_fscore_support` against golden labels. — [Arize evaluators doc](https://docs.arize.com/arize/llm-evaluation-and-annotations/catching-hallucinations/arize-evaluators-llm-as-a-judge); [Arize function-calling benchmark blog](https://arize.com/blog/calling-all-functions-benchmarking-openai-function-calling-and-explanations/)

**Explanations and evidence**
- Every surveyed framework returns a reason or explanation:
  - promptfoo: `reason`.
  - DeepEval: `include_reason`, `verbose_mode`.
  - Braintrust: CoT stored in metadata.
  - Phoenix: `provide_explanation`.
  - OpenAI: `steps`.
  - GLIDER: highlight spans.
  - Claude plugin eval: explanation plus the evidence excerpt.
- Sources: [promptfoo llm-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/); [DeepEval DAG](https://deepeval.com/docs/metrics-dag); [Braintrust](https://docs.braintrust.dev/evaluate/llm-as-a-judge.md); [GLIDER](https://arxiv.org/html/2412.14140v2); [Claude Code plugin evals](https://code.claude.com/docs/en/plugin-evals.md)

### Inferences
- Use explicit voting with "unparseable grade = abstain, not fail" (as in Inspect majority) instead of silently counting judge errors as fails.
- Store per-vote raw outputs, as Inspect's `metadata.panel` and the Claude plugin eval report both do.
- Make re-scoring old transcripts with a new judge or rubric a first-class operation (Inspect `inspect score --action append`), so judge changes can be A/B'd against a fixed set of agent outputs before baselines are approved.
- The human-alignment loop has converged on one shape:
  1. Collect human labels on the same criterion name.
  2. Measure judge-vs-human agreement per judge version.
  3. Improve the judge via prompt edits, few-shot corrections, or an optimizer.
  4. Version or register the judge.
- A minimal local version could be: a calibration set of human-labeled transcripts, an agreement score per rubric version, and disagreeing examples shown for rubric editing.
- Pinning the judge model is the main determinism lever documented (Claude plugin eval CI guidance, OpenAI seed). Nonce-randomized prompts (Inspect) deliberately break exact replay.

### Gaps
- The LangSmith alignment-score formula is not published in the announcement.
- LangSmith annotation queues were not fetched in this pass.
- No primary source was fetched for judge versioning in Braintrust, LangSmith, or Weave. MLflow `register` exists, but its comparison semantics were undocumented on the page.
- No confidence-score or logprob features were verified. G-Eval probability weighting is known from the G-Eval paper, but its DeepEval implementation was not confirmed here.
- Caching behavior for judge calls: promptfoo has a general cache page, which I did not fetch.
- Vertex "metrics validated against human ratings" and autorater configuration (sampling count, flip) were not on the fetched page.

## Q3. Notable newer designs (2025-2026): auto-aligning judges, rubric generation, agent-as-a-judge with tool/workspace access

### Takeaway
2025-2026 brought:
- **Optimizer-driven judge alignment:** MLflow `align()` with MemAlign, SIMBA, or GEPA; LangSmith Align Evals; Galileo CLHF.
- **Auto-generated per-item rubrics:** Vertex adaptive rubrics.
- **Agent-as-a-judge:** promptfoo `agent-rubric` runs Claude Agent SDK or Codex in the graded workspace.
- **Agent-native eval harnesses:** Claude Code `plugin eval` with no-plugin baselines, reference-transcript `baseline` graders, and LLM-drafted suites via `eval init`.

### Cited Findings
- **MLflow:** judge alignment with MemAlign as the default optimizer, plus DSPy SIMBA and GEPA. — [MLflow alignment docs](https://mlflow.org/docs/latest/genai/eval-monitor/scorers/llm-judge/alignment/); [MemAlign blog](https://mlflow.org/blog/memalign/)
- **LangSmith:** Align Evals (Jul 2025) adds prompt-iteration against human golden sets. The roadmap mentions automatic prompt optimization. — [LangChain blog](https://www.langchain.com/blog/introducing-align-evals)
- **Vertex AI:** adaptive rubrics generate rubrics from each input prompt. They can be generated separately to review and reuse, and steered with guidelines. — [Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/determine-eval)
- **promptfoo `agent-rubric`:**
  - The judge is a coding agent: Claude Agent SDK, Codex, or OpenCode.
  - It runs read-only by default and can run in the graded agent's own workspace (`copy_working_dir`).
  - Tool calls are kept on the grading result. The docs warn that granting write, shell, or network access to the grader causes real side effects. — [promptfoo agent-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/agent-rubric/)
- **Claude Code `plugin eval`:**
  - `eval init` has Claude interview the author, propose cases and graders, trial-run them, and write files.
  - The `baseline` grader judges a run against a reference transcript.
  - The no-plugin ablation arm reports Δ.
  - Agent-type MCP mocks are answered by the judge model and can be recorded and replayed. — [Claude Code plugin evals](https://code.claude.com/docs/en/plugin-evals.md)
- **Braintrust and DeepEval:** "TypeSafe Jev" / "Jev" structured decision models appear as judge options. DeepEval routes DAG judgement nodes to Jev in hybrid mode. — [Braintrust](https://docs.braintrust.dev/evaluate/llm-as-a-judge.md); [DeepEval DAG](https://deepeval.com/docs/metrics-dag)
- **Galileo Luna:** small evaluation models fine-tunable on customer data. — [Galileo Luna](https://galileo.ai/blog/introducing-galileo-luna-a-family-of-evaluation-foundation-models)
- **Patronus GLIDER:** retired as a product. The research paper and model weights remain. — [Patronus docs](https://docs.patronus.ai/docs/research_and_differentiators/Glider)

### Inferences
- For a coding-agent eval engine, the strongest borrowable combination is:
  - Deterministic graders on tools and files.
  - A short-context rubric judge with 3 votes and a majority rule.
  - An optional agent-judge with read-only workspace access for claims that need verification against files.
  - A baseline comparison (reference transcript or ablation arm).
  - A human-labeled calibration set that tracks judge agreement per rubric version.
- Auto-alignment optimizers (MemAlign, SIMBA) assume independent examples. Per Arklex, multi-turn agent transcripts may need adaptation.

### Gaps
- Release dates and versions for MLflow `align()`/MemAlign, Vertex adaptive rubrics, and promptfoo `agent-rubric` were not stated on the fetched pages.
- No primary documentation was found for an "agent-as-a-judge" feature in LangSmith, Braintrust, Weave, or Phoenix in this pass.
- Independent (non-vendor) validation of the Galileo CLHF, ChainPoll, and MLflow "30-50%" figures was not found.
