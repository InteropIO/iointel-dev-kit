// Renders judge/<case>__<target>__<n>.md: exactly what the judge model was sent for one run,
// so a reviewer can see the evidence behind its verdicts (and what the compaction kept or cut).
import type { Evals } from "../shared/contracts.js";
import type { RunUnit } from "../shared/types.js";

export function renderJudgeInput(
  unit: RunUnit,
  request: Evals.Judge.Request,
): string {
  const t = request.transcript;
  const saved = t.rawChars
    ? Math.round((1 - t.sentChars / t.rawChars) * 100)
    : 0;
  const tools = request.tools.length
    ? `${request.tools.join(", ")} (read-only, inside \`${request.workdir ?? "the workspace"}\`)`
    : "none";
  return [
    `# Judge input: ${unit.case.id}`,
    "",
    `Target \`${unit.target}\`, run ${unit.index + 1}${unit.withSkill ? "" : " (without skill)"}. This is the exact text sent to the judge; the system prompt and the prompt below are verbatim.`,
    "",
    "| | |",
    "|---|---|",
    `| Model | \`${request.model}\` |`,
    `| Tools | ${tools} |`,
    `| Transcript | ${fmt(t.rawChars)} chars raw → ${fmt(t.sentChars)} chars sent (${saved}% smaller), ${t.entries} entries |`,
    `| Shortened | ${t.entriesShortened} entries cut to their start and end (normal per-entry caps) |`,
    `| Trimmed | ${t.trimmed ? `**yes**: ${t.entriesTrimmed} older entries cut further to fit the budget` : "no"} |`,
    "",
    "## System prompt",
    "",
    fenced(request.system),
    "",
    "## Prompt",
    "",
    fenced(request.prompt),
    "",
  ].join("\n");
}

/** A code fence longer than any backtick run inside, so the content can't close it early. */
function fenced(text: string): string {
  const longest = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
