import type { FlowStep } from "../types.js";
import {
  FlowNormalizer,
  SKILL_NAME,
  SKILL_PREFIX,
  toCommandOrScriptStep,
} from "./normalize.js";

export interface CodexFlow {
  readonly steps: readonly FlowStep[];
  readonly skillTriggered: boolean;
}

const READ_COMMANDS = new Set([
  "cat",
  "head",
  "tail",
  "sed",
  "less",
  "more",
  "nl",
  "bat",
  "type",
  "get-content",
  "gc",
]);
// Searches and listings are minor steps: left out of the flow (they stay in the transcript).
const MINOR_COMMANDS = new Set([
  "ls",
  "dir",
  "rg",
  "grep",
  "find",
  "pwd",
  "tree",
  "get-childitem",
  "gci",
  "select-string",
  "wc",
]);

/**
 * Maps Codex thread items to normalized flow steps.
 * Codex has no explicit "skill loaded" event: it loads a skill by reading its SKILL.md, so that
 * read is the trigger signal (see isSkillLoad).
 */
export function extractCodexFlow(
  items: unknown[],
  workdir: string,
  skillInstallPath: string,
): CodexFlow {
  const norm = new FlowNormalizer(workdir, skillInstallPath);
  const steps: FlowStep[] = [];
  let skillTriggered = false;

  const pushRead = (path: string) => {
    if (isSkillLoad(path)) {
      if (!skillTriggered)
        steps.push({
          kind: "skill-loaded",
          skill: SKILL_NAME,
          via: "skill-md-read",
        });
      skillTriggered = true;
    } else steps.push({ kind: "read", path });
  };

  for (const item of items as Array<Record<string, unknown>>) {
    if (item.type === "command_execution" && typeof item.command === "string") {
      const command = norm.text(unwrapShell(item.command));
      const exitCode =
        typeof item.exit_code === "number" ? item.exit_code : null;
      const reads = readsOnly(command);
      if (reads) reads.map((p) => norm.path(p)).forEach(pushRead);
      else steps.push(toCommandOrScriptStep(command, exitCode));
    } else if (item.type === "file_change" && Array.isArray(item.changes)) {
      for (const change of item.changes as Array<{ path?: unknown }>) {
        if (typeof change.path === "string")
          steps.push({ kind: "write", path: norm.path(change.path) });
      }
    } else if (item.type === "web_search" && typeof item.query === "string") {
      steps.push({ kind: "fetch", url: `search: ${item.query}` });
    }
  }
  return { steps, skillTriggered };
}

/** The single Codex trigger rule: the installed skill's SKILL.md was read. */
function isSkillLoad(normalizedPath: string): boolean {
  return normalizedPath === `${SKILL_PREFIX}/SKILL.md`;
}

/** Strips a shell wrapper such as `bash -lc '...'` or `powershell.exe -Command "..."`. */
export function unwrapShell(command: string): string {
  // The executable may be quoted and contain spaces ("C:\Program Files\PowerShell\7\pwsh.exe").
  const m = /^(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/.exec(command.trim());
  if (!m) return command;
  const exe = (m[1] ?? m[2])!
    .replaceAll("\\", "/")
    .split("/")
    .pop()!
    .toLowerCase();
  const rest = m[3]!;
  const inner = /^(bash|sh|zsh)(\.exe)?$/.test(exe)
    ? /^-l?c\s+([\s\S]+)$/.exec(rest)?.[1]
    : /^(powershell|pwsh)(\.exe)?$/.test(exe)
      ? /^(?:-\w+\s+)*?-Command\s+([\s\S]+)$/i.exec(rest)?.[1]
      : undefined;
  if (inner === undefined) return command;
  const quoted = /^(['"])([\s\S]*)\1$/.exec(inner.trim());
  return quoted ? quoted[2]! : inner.trim();
}

/**
 * When every segment of a command only reads files (or is a minor search/listing),
 * returns the file paths read; otherwise undefined, and the command is kept as a command step.
 */
function readsOnly(command: string): string[] | undefined {
  const segments = command.split(/\s*(?:&&|\|\||;|\|)\s*/).filter(Boolean);
  const paths: string[] = [];
  for (const segment of segments) {
    // Redirections and heredocs (cat > file <<EOF) write files: not a read.
    if (/[<>]/.test(segment.replaceAll(SKILL_PREFIX, ""))) return undefined;
    const words = segment.match(/'[^']*'|"[^"]*"|\S+/g) ?? [];
    const name = (words[0] ?? "").toLowerCase();
    if (MINOR_COMMANDS.has(name)) continue;
    if (!READ_COMMANDS.has(name)) return undefined;
    for (const word of words.slice(1)) {
      const arg = word.replace(/^['"]|['"]$/g, "");
      // Skip flags, sed scripts like "1,200p", and line counts.
      if (/^-/.test(arg) || /^\d+(,\d+)?p?$/.test(arg) || arg === "") continue;
      paths.push(arg);
    }
  }
  return paths;
}
