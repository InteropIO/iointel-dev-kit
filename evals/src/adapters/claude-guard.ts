import { existsSync } from "node:fs";
import path from "node:path";

export type GuardDecision =
  { behavior: "allow" } | { behavior: "deny"; message: string };

const PATH_KEYS = ["file_path", "notebook_path", "path"];
const COMMAND_TOOLS = new Set(["Bash", "PowerShell"]);
const WEB_TOOLS = new Set(["WebFetch", "WebSearch"]);
const NETWORK_COMMAND =
  /\b(curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|irm)\b|\bgit\s+(clone|fetch|pull)\b/i;
const HARMLESS_PATHS = new Set(["/dev/null", "nul"]);

/**
 * Keeps an agent inside its workdir. File tools may not touch paths outside it, and shell
 * commands may not name absolute paths outside it or climb out with "..". This catches a
 * confused agent, not a determined one: it is a heuristic, not a sandbox.
 */
export function createWorkdirGuard(
  workdir: string,
  options: { network: boolean },
) {
  const root = path.resolve(workdir);
  const inside = (p: string) => {
    const resolved = path.resolve(root, toNativePath(p));
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };

  return (toolName: string, input: Record<string, unknown>): GuardDecision => {
    if (WEB_TOOLS.has(toolName) && !options.network)
      return deny("network access is disabled for this case");

    if (COMMAND_TOOLS.has(toolName) && typeof input.command === "string") {
      const command = input.command;
      if (!options.network && NETWORK_COMMAND.test(command))
        return deny("network access is disabled for this case");
      for (const token of pathTokens(command)) {
        if (HARMLESS_PATHS.has(token.toLowerCase())) continue;
        if (!inside(token))
          return deny(`commands must stay inside the workspace (${token})`);
      }
      return { behavior: "allow" };
    }

    for (const key of PATH_KEYS) {
      const value = input[key];
      if (typeof value === "string" && !inside(value))
        return deny(`${toolName} may only access files inside the workspace`);
    }
    return { behavior: "allow" };
  };
}

function deny(message: string): GuardDecision {
  return { behavior: "deny", message };
}

/** Absolute paths (C:\x, C:/x, /c/x, /x, ~/x) and relative paths that climb with "..". */
function pathTokens(command: string): string[] {
  const tokens = command.match(/[^\s"'`|;&<>()=]+/g) ?? [];
  return tokens.filter((t) => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return false; // URLs
    if (/^-/.test(t)) return false; // flags
    if (
      /^[A-Za-z]:[\\/]/.test(t) ||
      t.startsWith("~") ||
      /(^|[\\/])\.\.([\\/]|$)/.test(t)
    )
      return true;
    return t.startsWith("/") && isRootedPath(t);
  });
}

/**
 * "/x/..." is only treated as a filesystem path when "/x" really exists at the root, so arguments
 * like "/api/users" (grep) or "/debug/d" (sed) are not mistaken for paths outside the workdir.
 */
function isRootedPath(token: string): boolean {
  const first = token.split("/")[1];
  if (!first) return false;
  if (process.platform === "win32" && /^[a-zA-Z]$/.test(first)) return true; // Git Bash drive, /c/...
  return existsSync(`/${first}`);
}

/** Turns Git Bash (/c/Users) and home (~) forms into native paths before resolving. */
function toNativePath(p: string): string {
  const msys = /^\/([a-zA-Z])\/(.*)$/.exec(p);
  if (msys && process.platform === "win32")
    return `${msys[1]!.toUpperCase()}:/${msys[2]}`;
  if (p.startsWith("~"))
    return path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? "/",
      p.slice(1),
    );
  return p;
}
