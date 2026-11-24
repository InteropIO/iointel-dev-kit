// Writes evidence.md in an item folder: the evidence as the judge reads it (numbered rubric, final
// message, diff, compacted transcript), for a human to label from. It never shows the judge's verdicts.
// The content is the judge's, laid out as Markdown sections for reading; the verbatim prompt is in
// the run's judge-input file.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compactTranscript,
  type TranscriptEntry,
} from "../judge/compact-transcript.js";
import { fenced } from "../report/judge-input-markdown.js";
import type { Evals } from "../shared/contracts.js";
import { FILES } from "./store.js";

export async function writeEvidenceMarkdown(
  dir: string,
  evidence: Evals.Calibration.Evidence,
): Promise<void> {
  await writeFile(
    path.join(dir, FILES.evidenceMarkdown),
    renderEvidenceMarkdown(evidence),
  );
}

export function renderEvidenceMarkdown(
  evidence: Evals.Calibration.Evidence,
): string {
  const s = evidence.source;
  const transcript = compactTranscript(evidence.transcript);
  return [
    `# Evidence: ${s.caseId}, run ${s.run}`,
    "",
    `From results run \`${s.runId}\`, target \`${s.target}\`.${evidence.note ? ` ${evidence.note}` : ""}`,
    "",
    `Label every line in \`${FILES.labels}\` from this evidence alone${evidence.workspaceAccess ? `, plus the files in \`${FILES.workspace}/\` (the judge can read them too)` : ""}. Leave \`${FILES.verdicts}\` closed until you're done.`,
    "",
    `Generated from \`${FILES.evidence}\` on every \`npm run eval:calibrate\`; edit that file, not this one.`,
    "",
    "**Contents:** [Rubric](#rubric) · [Final message](#final-message)" +
      (evidence.diff !== undefined
        ? " · [Workspace diff](#workspace-diff)"
        : "") +
      " · [Transcript](#transcript)",
    "",
    "## Rubric",
    "",
    rubric(evidence),
    "",
    "## Final message",
    "",
    evidence.finalMessage.trim() ? quoted(evidence.finalMessage) : "_(empty)_",
    "",
    ...(evidence.diff !== undefined
      ? ["## Workspace diff", "", diffSections(evidence.diff), ""]
      : []),
    "## Transcript",
    "",
    transcriptSection(transcript),
    "",
  ].join("\n");
}

function rubric(evidence: Evals.Calibration.Evidence): string {
  return evidence.rubric
    .map((line, i) => {
      const tags = [
        ...(evidence.critical.includes(line) ? ["**critical**"] : []),
        ...(evidence.reportOnly.includes(line) ? ["_report only_"] : []),
      ];
      return `${i}. ${line}${tags.length ? ` (${tags.join(", ")})` : ""}`;
    })
    .join("\n");
}

/** One subsection per changed file, each in a diff fence. */
function diffSections(diff: string): string {
  if (!diff.trim()) return "_(no changes)_";
  const files = diff.split(/^(?=diff --git )/m).filter((f) => f.trim());
  return files
    .map((file) => {
      const header = /^diff --git a\/(.+?) b\/(.+)$/m.exec(file);
      const name = header
        ? header[1] === header[2]
          ? header[1]
          : `${header[1]} → ${header[2]}`
        : undefined;
      return [
        ...(name ? [`### \`${name}\``, ""] : []),
        fence(file.trimEnd(), "diff"),
      ].join("\n");
    })
    .join("\n\n");
}

function transcriptSection(transcript: ReturnType<typeof compactTranscript>) {
  const st = transcript.stats;
  const summary = [
    `${st.entries} entries`,
    ...(st.entriesShortened
      ? [`${st.entriesShortened} shortened to their start and end`]
      : []),
    ...(st.trimmed ? ["**trimmed** to fit the judge's budget"] : []),
  ].join(", ");
  const head = `The compacted log the judge reads: ${summary}. A \`[… N chars cut …]\` marker shows where an entry was shortened.`;
  if (!transcript.entries)
    return [head, "", fence(transcript.text, "text")].join("\n");
  return [head, "", ...transcript.entries.map(entry)].join("\n");
}

function entry(e: TranscriptEntry, i: number): string {
  const title = `### #${i + 1} · ${e.kind}${e.label ? ` · ${e.label}` : ""}`;
  return [title, "", entryBody(e), ""].join("\n");
}

function entryBody(e: TranscriptEntry): string {
  if (!e.text.trim()) return "_(empty)_";
  switch (e.kind) {
    case "assistant":
    case "thinking":
      return quoted(e.text);
    case "user":
      // Injected text (a loaded skill, a reminder) is long Markdown of its own: keep it fenced so
      // its headings don't break this document's outline.
      return e.label ? fence(e.text, "markdown") : quoted(e.text);
    case "tool call":
      return toolCall(e);
    default:
      return fence(e.text, "text");
  }
}

// Fields that hold a file's content or a command, shown as their own code blocks.
const SHELL_KEYS = new Set(["command", "cmd"]);

/** A tool call's input as a field list, with multi-line values as code blocks. */
function toolCall(e: TranscriptEntry): string {
  if (e.label === "shell") return fence(e.text, "bash");
  let input: unknown;
  try {
    input = JSON.parse(e.text);
  } catch {
    // Shortened past valid JSON, or not JSON at all.
    return fence(e.text, "json");
  }
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return fence(JSON.stringify(input, null, 2), "json");
  const fields = Object.entries(input as Record<string, unknown>);
  if (!fields.length) return "_(no input)_";
  const filePath = fields.find(
    ([k, v]) => /path$/i.test(k) && typeof v === "string",
  )?.[1] as string | undefined;
  const inline: string[] = [];
  const blocks: string[] = [];
  for (const [key, value] of fields) {
    if (
      typeof value === "string" &&
      (value.includes("\n") || value.length > 160)
    ) {
      const lang = SHELL_KEYS.has(key) ? "bash" : languageOf(filePath);
      blocks.push(`**${key}**`, "", fence(value, lang), "");
    } else if (typeof value === "string" && SHELL_KEYS.has(key)) {
      blocks.push(`**${key}**`, "", fence(value, "bash"), "");
    } else if (typeof value === "object" && value !== null) {
      blocks.push(
        `**${key}**`,
        "",
        fence(JSON.stringify(value, null, 2), "json"),
        "",
      );
    } else {
      inline.push(
        `- **${key}**: ${code(typeof value === "string" ? value : JSON.stringify(value))}`,
      );
    }
  }
  return [...inline, ...(inline.length && blocks.length ? [""] : []), ...blocks]
    .join("\n")
    .trimEnd();
}

const LANGUAGES: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  py: "python",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
};

function languageOf(filePath: string | undefined): string {
  const ext = filePath && path.extname(filePath).slice(1).toLowerCase();
  return (ext && LANGUAGES[ext]) || "text";
}

/** A Markdown blockquote: the text still renders as Markdown, set apart from the document. */
function quoted(text: string): string {
  return text
    .trimEnd()
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

/** A code fence in the given language, longer than any backtick run inside. */
function fence(text: string, lang: string): string {
  return fenced(text).replace(/^(`+)text\n/, `$1${lang}\n`);
}

/** Inline code that survives backticks in the value. */
function code(value: string): string {
  if (!value) return "_(empty)_";
  const longest = Math.max(
    0,
    ...(value.match(/`+/g) ?? []).map((r) => r.length),
  );
  const ticks = "`".repeat(longest + 1);
  const pad = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${ticks}${pad}${value}${pad}${ticks}`;
}
