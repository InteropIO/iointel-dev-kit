import {
  FlowNormalizer,
  SKILL_NAME,
  toCommandOrScriptStep,
} from "./normalize.js";
import type { Evals } from "../shared/contracts.js";
import type { ClaudeToolResult, ClaudeToolUse } from "../shared/types.js";

const COMMAND_TOOLS = new Set(["Bash", "PowerShell"]);
const WRITE_TOOLS: Record<string, string> = {
  Write: "file_path",
  Edit: "file_path",
  MultiEdit: "file_path",
  NotebookEdit: "notebook_path",
};

/** Maps Claude Agent SDK messages to normalized flow steps. Triggering = a Skill tool call naming the skill. */
export function extractClaudeFlow(
  messages: unknown[],
  workdir: string,
  skillInstallPath: string,
): Evals.Flow.Extraction {
  const norm = new FlowNormalizer(workdir, skillInstallPath);
  const uses: ClaudeToolUse[] = [];
  const results = new Map<string, ClaudeToolResult>();

  for (const msg of messages as Array<{
    type?: string;
    message?: { content?: unknown };
  }>) {
    const content = msg.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as Array<Record<string, unknown>>) {
      if (msg.type === "assistant" && block.type === "tool_use") {
        uses.push({
          id: String(block.id),
          name: String(block.name),
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      } else if (msg.type === "user" && block.type === "tool_result") {
        results.set(String(block.tool_use_id), {
          isError: block.is_error === true,
          text: resultText(block.content),
        });
      }
    }
  }

  const steps: Evals.Flow.Step[] = [];
  let skillTriggered = false;
  for (const use of uses) {
    const str = (key: string) =>
      typeof use.input[key] === "string"
        ? (use.input[key] as string)
        : undefined;
    if (use.name === "Skill") {
      const skill = str("skill") ?? str("command") ?? str("name") ?? "";
      if (skill.replace(/^\//, "") === SKILL_NAME) skillTriggered = true;
      steps.push({
        kind: "skill-loaded",
        skill: skill.replace(/^\//, ""),
        via: "skill-tool",
      });
    } else if (use.name === "Read" && str("file_path")) {
      steps.push({ kind: "read", path: norm.path(str("file_path")!) });
    } else if (use.name === "WebFetch" && str("url")) {
      steps.push({ kind: "fetch", url: str("url")! });
    } else if (use.name === "WebSearch" && str("query")) {
      steps.push({ kind: "fetch", url: `search: ${str("query")}` });
    } else if (COMMAND_TOOLS.has(use.name) && str("command")) {
      steps.push(
        toCommandOrScriptStep(
          norm.text(str("command")!),
          exitCode(results.get(use.id)),
        ),
      );
    } else if (WRITE_TOOLS[use.name] && str(WRITE_TOOLS[use.name]!)) {
      steps.push({
        kind: "write",
        path: norm.path(str(WRITE_TOOLS[use.name]!)!),
      });
    }
  }
  return { steps, skillTriggered };
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) =>
        c && typeof c === "object" && "text" in c
          ? String((c as { text: unknown }).text)
          : "",
      )
      .join("\n");
  return "";
}

/** Claude Code reports a failing command as an error result containing "Exit code N". */
function exitCode(result: ClaudeToolResult | undefined): number | null {
  if (!result) return null;
  const m = /Exit code:?\s*(-?\d+)/i.exec(result.text);
  if (m) return Number(m[1]);
  return result.isError ? 1 : 0;
}
