// Writes evidence.md in an item folder: the evidence as the judge reads it (numbered rubric, final
// message, diff, compacted transcript), for a human to label from. It never shows the judge's verdicts.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { AnthropicJudge } from "../judge/anthropic-judge.js";
import { fenced } from "../report/judge-input-markdown.js";
import type { Evals } from "../shared/contracts.js";
import { FILES } from "./store.js";

export async function writeEvidenceMarkdown(
  dir: string,
  evidence: Evals.Calibration.Evidence,
): Promise<void> {
  const request = AnthropicJudge.buildRequest({
    rubric: evidence.rubric,
    finalMessage: evidence.finalMessage,
    transcript: evidence.transcript,
    ...(evidence.diff !== undefined ? { diff: evidence.diff } : {}),
  });
  const s = evidence.source;
  const md = [
    `# Evidence: ${s.caseId}, run ${s.run}`,
    "",
    `From results run \`${s.runId}\`, target \`${s.target}\`.${evidence.note ? ` ${evidence.note}` : ""}`,
    "",
    `Label every line in \`${FILES.labels}\` from this evidence alone${evidence.workspaceAccess ? `, plus the files in \`${FILES.workspace}/\` (the judge can read them too)` : ""}. Leave \`${FILES.verdicts}\` closed until you're done.`,
    "",
    `Generated from \`${FILES.evidence}\` on every \`npm run eval:calibrate\`; edit that file, not this one.`,
    "",
    fenced(request.prompt),
    "",
  ].join("\n");
  await writeFile(path.join(dir, FILES.evidenceMarkdown), md);
}
