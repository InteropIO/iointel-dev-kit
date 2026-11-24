# Academic Literature on LLM-as-a-Judge Reliability and Trustworthiness

Notes compiled 2026-11-18. Sources marked "(abstract/secondary)" were only verified via abstract or third-party summary, not full text. Items marked "[background, not re-verified this session]" come from prior knowledge of well-known papers; the link is the primary paper, but the exact figure should be checked before quoting.

## 1. Known biases (position, verbosity, self-preference, authority, sycophancy, format) — magnitudes and mitigations

### Takeaway
Position bias is the best-documented and still present in some 2026 frontier judges (|P(A)-0.5| up to 0.19), while verbosity bias appears to have shrunk to near zero in current frontier judges under simple pairwise rubrics; self-preference is real but partially an artifact of evaluator uncertainty. The cheapest effective mitigations are order-swapping (count only consistent verdicts or average both orders), reference answers for verifiable tasks, and CoT/evidence-first prompting.

### Cited Findings
**Position bias**
- MT-Bench paper (Zheng et al., NeurIPS 2023), default prompt, pairwise with swapped order: GPT-4 consistent 65.0% (biased toward first 30.0%); Claude-v1 consistent 23.8% (biased toward first 75.0%); GPT-3.5 consistent 46.2% (biased toward first 50.0%) — [Zheng et al. 2023, Table 2](https://arxiv.org/html/2306.05685v4)
- Wang et al. "LLMs are not Fair Evaluators": by simply reordering responses, Vicuna-13B could "beat" ChatGPT on 66 of 80 queries under a ChatGPT/GPT-4 judge; rankings "can be easily hacked by simply altering their order of appearance" — [Wang et al. 2023](https://arxiv.org/pdf/2305.17926)
- Wang et al. mitigations: Multiple Evidence Calibration (judge writes evidence before the score; sample k scores, k=3 in repo), Balanced Position Calibration (aggregate across both orders), and Human-in-the-Loop Calibration (a "balanced position diversity entropy" flags hard examples for human review). Reported to improve accuracy and kappa vs. human labels and reduce conflict rate (exact table numbers not retrieved) — [Wang et al. 2023](https://arxiv.org/pdf/2305.17926); [FairEval repo](https://github.com/i-Eval/FairEval)
- 2026 large-scale study ("Reliability without Validity", 21 judges, 9 providers, ~541,000 judgments): position bias |P(A wins)−0.5| on MT-Bench ranges from 0.002 (Gemini 2.5 Pro), 0.004 (Claude Opus 4.6, Kimi K2.5) to 0.083 (GPT-5.4), 0.094 (DeepSeek V3.2), 0.125 (Gemini 2.5 Flash), 0.192 (Qwen 3 8B). Position flip rates increased on harder JudgeBench items (cohort median 0.09 → 0.17); Llama 3.3 70B flip rate rose 3.3x, GPT-4o-mini 3.0x — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)
- Same study: "thinking" architecture judges were predicted to have position bias <0.05; only Gemini 3.1 Pro (0.038) did — reasoning models are not automatically position-debiased — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)

**Verbosity bias**
- MT-Bench "repetitive list" attack (padding answers with rephrased repeats), failure rate on 23 answers: Claude-v1 91.3%, GPT-3.5 91.3%, GPT-4 8.7% — [Zheng et al. 2023, Table 3](https://arxiv.org/html/2306.05685v4)
- 2026: all 21 judges had verbosity bias <0.011 on MT-Bench (17/21 <0.005; GPT-4o-mini highest ~0.010) — but authors caution this holds only under their single pairwise rubric and length operationalization — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)
- Older finding superseded in part: the 2023 verbosity results (91% failure) describe weaker judges; 2026 frontier judges show little length preference in pairwise settings, though no evidence was found that this holds for pointwise rubric scoring.

**Self-preference / self-enhancement**
- MT-Bench: GPT-4 favored itself with ~10% higher win rate than humans assigned; Claude-v1 ~25% higher; GPT-3.5 did not favor itself. Authors said data were too limited to conclude bias exists — [Zheng et al. 2023 §3.3](https://arxiv.org/html/2306.05685v4)
- Panickssery et al. (NeurIPS 2024): linear correlation between a model's self-recognition ability and strength of self-preference; fine-tuning to change self-recognition shifts the bias, suggesting causal link — [Panickssery et al. 2024](https://arxiv.org/pdf/2404.13076)
- Chen et al. 2025 separate legitimate self-preference (own output really is better) from "harmful" self-preference (preferring own objectively wrong answer); harmful self-preference persists — [arXiv 2504.03846](https://arxiv.org/pdf/2504.03846)
- Critique (2026): "Are LLM Evaluators Really Narcissists?" reports evaluator uncertainty accounts for on average 89.6% of measured self-preference in reproductions — i.e., much measured self-preference may be an artifact of noisy judging on hard items — [arXiv 2601.22548](https://arxiv.org/html/2601.22548)
- PoLL authors argue a single judge introduces intra-model bias and use cross-family panels to dilute it — [Verga et al. 2024](https://arxiv.org/html/2404.18796v2)

**Authority, sentiment, and other biases (CALM framework)**
- Ye et al. "Justice or Prejudice?" (ICLR 2025) define 12 bias types (incl. position, verbosity, authority via fake citations, sentiment, bandwagon, distraction, self-enhancement, CoT, refinement-aware, etc.) and measure Robustness Rate (share of verdicts unchanged under perturbation). Even the best model reached RR of only 0.86 (abstract/secondary); some models below 0.5 on some biases (secondary) — [Ye et al. 2024](https://arxiv.org/html/2410.02736v2); [project site](https://llm-judge-bias.github.io)
- Secondary summary claims book citations/quotes sway judges more than URLs in authority-bias tests (unverified) — [alphaXiv overview](https://alphaxiv.org/overview/2410.02736v2)

**Mitigations with numbers**
- MT-Bench math/reasoning grading failure rate (20 judgments, GPT-4): default prompt 70%, CoT 30%, reference-guided 15% — reference answers are the strongest single fix for verifiable tasks — [Zheng et al. 2023, Table 4](https://arxiv.org/html/2306.05685v4)
- JudgeBench credits verdicts only if consistent across both response orders, an explicit design pattern for position-robust scoring — [JudgeBench, ICLR 2025](https://mlanthology.org/iclr/2025/tan2025iclr-judgebench)

### Inferences
- For a coding-agent/assistant eval engine, swap-and-require-consistency (or average both orders) remains necessary for any pairwise judging, even with 2026 frontier judges; pointwise rubric grading avoids position bias in its pairwise form but not "first-item"/anchoring effects within long transcripts (untested in the sources found).
- Where a ground-truth or reference artifact exists (tests passing, expected diff, reference answer), giving it to the judge yields the largest documented error reduction (70% → 15%).
- Avoid using the same model family as both agent-under-test and judge, or at least measure self-preference on a labeled set; the magnitude is contested, so measure rather than assume.

### Gaps
- No quantified sycophancy bias (judge deferring to claims in the transcript such as "all tests pass") was found in this session; CALM's "authority" and "distraction" biases are closest analogues, but per-model numbers were not retrieved.
- No source found that measures format bias (markdown/bullets vs prose) magnitudes for 2025–2026 judges.

## 2. Measuring judge-vs-human agreement; typical levels vs human-human

### Takeaway
Raw percent agreement badly overstates judge quality: on MT-Bench, exact-match agreement exceeds Cohen's kappa by ~34–41 points (85% agreement ≈ κ 0.48). Report chance-corrected metrics (Cohen's κ / Krippendorff's α), and benchmark-dependent rankings mean a judge must be validated on data resembling your own task.

### Cited Findings
- MT-Bench (2023): GPT-4 pairwise vs human 66% (3-way incl. ties, S1; random=33%) and 85% (2-way excl. ties, S2; random=50%); human-human 63%/81% (turn 1). GPT-4 single-answer grading vs human 60%/85%. GPT-4 pairwise vs single-answer self-agreement 70% (S1)/97% (S2) — basis of the "LLM judge ≈ human-human agreement (>80%)" claim — [Zheng et al. 2023, Table 5](https://arxiv.org/html/2306.05685v4)
- "Reliability without Validity" (2026): exact match exceeds κ by 33.8–41.3 pp for every judge on MT-Bench (mean 38.6 pp); gap 23.7 pp on JudgeBench, 10.2 pp on RewardBench. "A reported 85% agreement on MT-Bench corresponds to κ ≈ 0.48." Gemini 3.1 Pro: exact match 0.849, κ 0.511 — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)
- Same study, κ ranges: MT-Bench 0.376–0.511; JudgeBench 0.271–0.875; RewardBench 0.616–0.898. Best: MT-Bench Gemini 3.1 Pro 0.511, Claude Opus 4.6 0.489; JudgeBench Claude Opus 4.6 0.875, Gemini 3.1 Pro 0.841, Claude Sonnet 4.6 0.782; RewardBench Gemini 3.1 Pro 0.898, GPT-oss-120B 0.880. Rank shifts up to 14–15 positions across benchmarks (Llama 3.3 70B #5 → #20); only Gemini 3.1 Pro and Claude Opus 4.6 stayed top-3 on all three — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)
- Same study's "Minimum Viable Validation Protocol": (1) headline κ or Krippendorff's α, not exact match; (2) paired AB+BA runs for position bias; (3) ≥3 independent replicates at temperature 0, caching disabled; (4) validate on ≥2 benchmarks with different label structures; (5) if test-retest >0.95, confirm position bias <0.10 — "High stability with high bias is a failure mode, not a strength." Test-retest averaged ~0.944 (MT-Bench), 0.913 (JudgeBench); Qwen 3 8B had test-retest 0.992 with position bias 0.192 — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)
- "Judging the Judges" (Thakur et al., 13 judges, 9 exam-taker models, a setting with high inter-human agreement): only the best/largest judges achieve reasonable alignment, still "quite far behind inter-human agreement"; scores can differ from human scores by up to 5 points; judges with high percent agreement can assign vastly different scores; judges are lenient and sensitive to prompt complexity/length; smaller judges and even a lexical metric can still give reasonable *rankings* (abstract) — [arXiv 2406.12624](https://arxiv.org/abs/2406.12624)
- JudgeBench (Tan et al., ICLR 2025): 350 hard pairs (knowledge, reasoning, math, coding) where one response is objectively correct; GPT-4o ~50.9% (vanilla) / 56.6% (Arena-Hard-style prompt), barely above random; Claude-3.5-Sonnet 64.3%; top reward models ~64% vs up to 97% on RewardBench subsets. GPT-4o vanilla by category: knowledge 44.2, reasoning 48.0, math 66.1, coding 61.9 (secondary summaries) — [JudgeBench](https://mlanthology.org/iclr/2025/tan2025iclr-judgebench); [emergentmind summary](https://www.emergentmind.com/papers/2410.12784)
- "Can You Trust LLM Judgments?" (Schroeder & Wood-Doughty, 2024/25): proposes measuring judge *reliability* (internal consistency via McDonald's omega across random seeds, holding other settings fixed); 9 judges, 2 settings; uncertainty varied by family and size; prompting strategies partially reduced it (abstract) — [arXiv 2412.12509](https://arxiv.org/abs/2412.12509v2)
- A 2026 systematic review (27 papers, 2020–Mar 2026) concludes judges show systematic biases, single-pass evaluation is insufficient, and no unified meta-evaluation framework exists — [ResearchGate SLR](https://www.researchgate.net/publication/406281480_LLM-as-a-Judge_A_Systematic_Literature_Review_on_Reliability_Bias_and_Meta-Evaluation_Frameworks)
- Survey (Gu et al., "A Survey on LLM-as-a-Judge") frames evaluation along agreement with humans, bias, and adversarial robustness — [alphaXiv 2411.15594](https://www.alphaxiv.org/abs/2411.15594)
- Metric caveat: with highly imbalanced binary per-item labels, Krippendorff's α can approach perfect agreement while Cohen's κ stays moderate — report both and the base rate — [InfiMed-ORBIT](https://arxiv.org/pdf/2510.15859) (via search summary)
- Ordinal scales: weighted kappa or ICC credit near-misses for Likert; McNemar's test for paired binary outcomes (practitioner source) — [Medium, Masood](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)

### Inferences
- The widely quoted "GPT-4 matches human-human agreement (80%+)" is a 2-way-without-ties percent-agreement figure on a chat-preference task; it should not be treated as evidence that judges reach human-level reliability on hard, objectively-gradeable tasks (JudgeBench shows near-chance for 2024 judges; 2026 frontier judges reach κ ~0.84–0.88 there).
- For an eval engine, the practical bar is: a held-out human-labeled set from your own case distribution, κ/α as the headline, replicate runs to measure test-retest, and order-swap tests. Judge choice should be re-validated per domain because rankings flip across benchmarks.

### Gaps
- No direct academic measurement of judge-human κ for grading coding-agent transcripts against rubrics was found; nearest are JudgeBench coding subset and RewardBench.
- Did not retrieve LLMBar (Zeng et al., ICLR 2024) numbers this session. [background, not re-verified this session] LLMBar's adversarial set showed many judges (e.g., ChatGPT, Llama-2-Chat) performing near or below chance at choosing the instruction-following output over a superficially better one, with prompting strategies (rules, self-generated metrics, swap) giving notable gains — [LLMBar, arXiv 2310.07641](https://arxiv.org/abs/2310.07641)
- RewardBench (Lambert et al.) and its 2025 successor RewardBench 2 numbers were not retrieved here.

## 3. Calibration, uncertainty, abstention, and statistical correction (PPI, conformal)

### Takeaway
Judge self-reported confidence / token probabilities tend to overestimate agreement with humans, but calibrated abstention ("Trust or Escalate") can give provable human-agreement guarantees on the subset the judge keeps. For aggregate metrics, prediction-powered inference (PPI/PPI++) uses a small human-labeled set to debias judge-labeled scores and produce valid confidence intervals.

### Cited Findings
- Trust or Escalate (Jung, Brahman, Choi; ICLR 2025 oral): judge estimates confidence and abstains below a threshold set by fixed-sequence testing on a small calibration set, giving a user-chosen bound on disagreement with humans for non-abstained items. Predictive probability overestimates human agreement; "Simulated Annotators" (in-context simulation of diverse annotators, confidence = agreement ratio) is better calibrated. Cascades escalate from a cheap to a strong judge only when uncertain. On a Chatbot Arena subset where GPT-4 almost never reaches 80% human agreement, the method guarantees >80% agreement at ~80% coverage using Mistral-7B first in the cascade — [arXiv 2407.18370](https://arxiv.org/abs/2407.18370); [ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/08dabd5345b37fffcbe335bd578b15a0-Abstract-Conference.html)
- PPI setup for judges: large judge-only set + small calibration set with both human labels and judge labels; judge treated as surrogate, its average bias corrected using the calibration set — [arXiv 2601.05420](https://www.arxiv.org/pdf/2601.05420)
- Imperfect judge sensitivity/specificity biases naive pass-rate estimates; plug-in (misclassification) correction with CIs that account for uncertainty in both datasets — [arXiv 2511.21140](https://arxiv.org/pdf/2511.21140v2)
- Estimator comparison (Jan 2026): efficient-influence-function estimators including PPI++ give the narrowest intervals; Rogan–Gladen correction is much wider, especially when judge accuracy is poor — [alphaXiv overview 2601.05420](https://alphaxiv.org/overview/2601.05420v1)
- Tooling: GLIDE library (May 2026) packages PPI variants incl. active and cost-optimal sampling for GenAI/agentic evaluation — [arXiv 2605.31278](https://arxiv.org/html/2605.31278); [docs](https://glide-py.readthedocs.io/en/latest/tutorials/ppi/). PPI applied to LLM-based ranking evaluation — [arXiv 2606.05308](https://arxiv.org/html/2606.05308)
- [background, not re-verified this session] G-Eval (Liu et al. 2023) weights each score by token probabilities (probability-weighted sum over 1–5) and CoT-generated evaluation steps; reported Spearman ~0.514 with human judgments on SummEval with GPT-4, beating prior metrics; also noted a bias toward LLM-generated text — [G-Eval, arXiv 2303.16634](https://arxiv.org/abs/2303.16634)

### Inferences
- An eval engine can (a) let the judge abstain/flag "uncertain" and route those to humans, with a threshold calibrated on labeled data, and (b) report pass rates with PPI-corrected CIs rather than raw judge pass rates, given a modest human-labeled calibration sample per suite.
- Logprob-weighted scores are only available for APIs exposing logprobs and do not themselves guarantee calibration; empirical calibration on human labels is the reliable path.

### Gaps
- No conformal-prediction-for-judge numbers beyond Trust or Escalate were retrieved; no evidence found on how well calibration transfers to agentic/coding transcripts.
- No 2025–2026 measurements of verbalized-confidence calibration (ECE) for frontier judges were found in this session.

## 4. Rubric/criteria design: pointwise vs pairwise vs reference-based, binary vs Likert, checklists, criteria drift

### Takeaway
Decomposed, binary (met/unmet) rubric items with behavioral anchors are more reliable than holistic Likert scores; reference-guided grading sharply reduces errors on verifiable tasks; and criteria cannot be fully specified up front ("criteria drift"), so rubrics must be iterated against human grading of real outputs.

### Cited Findings
- Criteria drift (EvalGen, Shankar et al., UIST 2024): "users need criteria to grade outputs, but grading outputs helps users define criteria"; it is impossible to completely determine evaluation criteria before humans judge outputs. Qualitative study with 9 expert users. LLM-generated evaluators "inherit all the problems of the LLMs they evaluate, requiring further human validation" — [arXiv 2404.12272](https://arxiv.org/pdf/2404.12272); [ACM](https://dl.acm.org/doi/fullHtml/10.1145/3654777.3676450)
- Pointwise vs pairwise: on MT-Bench, GPT-4 single-answer grading reached similar agreement with humans as pairwise (85% vs 85% in the 2-way setting) and 97% self-agreement between modes in S2, 70% in S1 — [Zheng et al. 2023](https://arxiv.org/html/2306.05685v4)
- Reference-guided grading cut GPT-4's math grading failure from 70% to 15% — [Zheng et al. 2023](https://arxiv.org/html/2306.05685v4)
- Binary vs Likert: binary MET/UNMET criteria give the highest inter-rater reliability; recommend narrow 3–5-level ordinal scales with behavioral anchors because judges show central-tendency bias on broad scales — [Autorubric, arXiv 2603.00077](https://arxiv.org/html/2603.00077v2)
- Practitioner measurement (Microsoft, not peer-reviewed): Likert 1–5 had 60–70% agreement with human experts vs binary pass/fail 89–93% — [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/evaluating-ai-agents-can-llm%E2%80%91as%E2%80%91a%E2%80%91judge-evaluators-be-trusted/4480110)
- Rubric-based benchmarks for agents: ResearchRubrics (deep-research agents) and PReMISE (policy rubrics as measurement specifications) treat rubrics as measurement instruments — [ResearchRubrics](https://arxiv.org/pdf/2511.07685); [PReMISE](https://arxiv.org/pdf/2605.30803)
- Construct validity: a 2026 paper argues judges should be validated on whether they detect the specific change being measured ("A Judge Should Know What Changed") — [arXiv 2608.24419](https://arxiv.org/pdf/2608.24419) (title only seen)
- Judging the Judges: judges are sensitive to prompt complexity and length — [arXiv 2406.12624](https://arxiv.org/abs/2406.12624)
- [background, not re-verified this session] HealthBench (OpenAI, 2025) grades with 48,562 physician-written rubric criteria across 5,000 conversations, scored per-criterion by a model grader, with grader-physician agreement reported comparable to physician-physician agreement — [HealthBench](https://arxiv.org/abs/2505.08775). CheckEval (Lee et al.) decomposes criteria into boolean checklist questions and reports improved inter-evaluator agreement — [CheckEval](https://arxiv.org/abs/2403.18771)

### Inferences
- For the engine: express rubric lines as atomic binary checks with explicit pass/fail anchors, attach reference artifacts (expected behavior, test results) where available, and score aggregates by counting met items rather than asking for a holistic 1–10.
- Build in a loop where humans grade a sample of outputs, rubric lines get revised, and judge-human agreement is re-measured per line; treat rubric versions as changing the measurement instrument (baselines must be re-established).

### Gaps
- Peer-reviewed head-to-head numbers for binary vs Likert judge reliability were not retrieved (the 60–70% vs 89–93% figure is a vendor blog).
- HealthBench/CheckEval exact agreement figures were not re-verified this session.

## 5. Multi-judge ensembles/juries, debate, meta-judging, fine-tuned judges

### Takeaway
Panels of diverse smaller judges can match or beat a single large judge at lower cost (PoLL), but fine-tuned open judges (JudgeLM, PandaLM, Auto-J, Prometheus) behave like task-specific classifiers that generalize poorly and can be worse than random on adversarial sets. 2026 frontier general models are the strongest judges on hard objective benchmarks.

### Cited Findings
- PoLL (Verga et al., Cohere 2024): panel of Command R + Claude Haiku + GPT-3.5 (three families) correlates better with human judgments than GPT-4 alone and is >7x cheaper. KILT-NQ Cohen's κ: PoLL 0.763 vs GPT-4 0.627, Haiku 0.749, Command R 0.734, GPT-3.5 0.726, exact match 0.651; HotPotQA PoLL 0.889 vs best single GPT-3.5 0.910 (κ values via secondary summary). GPT-4 judge was sensitive to small prompt changes — [arXiv 2404.18796](https://arxiv.org/html/2404.18796v2)
- Fine-tuned judges (Huang et al., ACL Findings 2025, "...Fine-tuned Judge Models are Task-specific Classifiers"): JudgeLM, PandaLM, Auto-J, Prometheus underperform GPT-4 on generalizability, fairness, aspect-specific evaluation, and scalability; constrained by their training evaluation scheme, biased toward superficial quality, cannot benefit from prompting strategies; on adversarial test sets "even worse than random-guess." Authors propose a reliability indicator and GPT-4 fallback — [arXiv 2403.02839](https://arxiv.org/html/2403.02839v4); [ACL Findings 2025](https://preview.aclanthology.org/display_plenaries/2025.findings-acl.306.pdf)
- Fine-tuned reward models scored up to 97% on some RewardBench subsets but ~64% on JudgeBench — benchmark saturation does not imply hard-case reliability — [JudgeBench](https://mlanthology.org/iclr/2025/tan2025iclr-judgebench)
- Cascaded judges (cheap → strong on low confidence) retain guarantees while reducing cost — [Trust or Escalate](https://arxiv.org/abs/2407.18370)
- 2026: cheaper open judge Kimi K2.5 reached JudgeBench κ 0.720 with position bias 0.004; frontier closed models (Claude Opus 4.6, Gemini 3.1 Pro) led — [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)

### Inferences
- Juries mainly help by diluting idiosyncratic/self-preference bias and variance; they cannot fix shared blind spots (e.g., all judges fooled by the same "master key" tokens). A 2-3 judge panel from different families, or repeated samples from one strong judge with majority vote, is a defensible design; measure κ of the aggregate.
- Prefer a strong general model over a fine-tuned small judge for rubric grading of out-of-distribution agent transcripts unless the fine-tuned judge is validated on your distribution.

### Gaps
- Debate-based and meta-judging (judge-of-judge) reliability numbers were not retrieved this session.
- Skywork-Reward / newer generative reward model results (2025–2026) not retrieved.

## 6. Adversarial robustness, judge gaming, reward hacking

### Takeaway
LLM judges are easy to game: constant "null" outputs crafted against the judge template top major auto-benchmarks, and single tokens like ":" or "Thought process:" trigger false-positive "correct" verdicts at high rates. Any engine where the graded system can see or optimize against the judge needs adversarial tests and hardened judges.

### Cited Findings
- Cheating automatic benchmarks (Zheng, Pang et al., ICLR 2025 oral): a null model outputting a constant, instruction-irrelevant structured response reached 86.5% LC win rate on AlpacaEval 2.0, 83.0 on Arena-Hard-Auto, 9.55 on MT-Bench; works even without access to private benchmark instructions (prefix tuned on UltraFeedback) by confusing the judge's parsing of the evaluation template — [arXiv 2410.07137](https://arxiv.org/pdf/2410.07137)
- One Token to Fool LLM-as-a-Judge (2025): "master key" responses (non-word symbols like ":", reasoning openers like "Thought process:", "Let's solve this step by step") cause false-positive rates up to 80% (abstract) in generative reward models/judges used for RL with verifiable rewards; GPT-4o up to 35% FPR for a lone ":" and 53% for "Thought process:" on some datasets; LLaMA3-70B-Instruct 73% on "Thought process:"; a specialized verifier 66.8% FPR on a blank-space answer (secondary). Data-augmented Master-RM reduces FPR to near zero — [arXiv 2507.08794](https://arxiv.org/html/2507.08794v1); [BDTechTalks](https://bdtechtalks.com/2025/07/21/llm-as-a-judge-vulnerability/)
- Fine-tuned judges scored worse than random on adversarial test sets — [Huang et al.](https://arxiv.org/html/2403.02839v4)
- CALM robustness: best judge only RR 0.86 across perturbation-based biases (fake authority, distraction, bandwagon, etc.) — [Ye et al.](https://arxiv.org/html/2410.02736v2)
- Verbosity padding attack: 91.3% success on Claude-v1/GPT-3.5 (2023) — [Zheng et al.](https://arxiv.org/html/2306.05685v4)

### Inferences
- For coding-agent evals, the agent's transcript can contain self-assertions ("all tests pass", "task complete") that act like authority/master-key cues; judges should be given ground-truth artifacts (actual test output, diffs) and instructed to verify claims, and the engine should include canary cases (empty/null/self-congratulatory outputs) that must fail.
- If judge scores are used as optimization targets (prompt tuning, RL), expect Goodhart effects; keep a held-out human-audited set.

### Gaps
- No academic study found specifically on prompt-injection attacks against judges from within agent transcripts (e.g., text addressed to the grader), though the null-model and CALM results imply vulnerability.
- No quantified evidence found on whether reasoning/thinking judges are more robust to master-key attacks in 2026.
