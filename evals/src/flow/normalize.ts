import path from "node:path";
import type { FlowStep } from "../types.js";

export const SKILL_NAME = "io-intelligence";
export const SKILL_PREFIX = "<skill>";

/**
 * Rewrites paths and command text so that runs in different temp folders, and different tools'
 * skill install locations, produce identical steps:
 *   - the workdir becomes relative ("src/app.ts"),
 *   - the installed skill folder becomes "<skill>" ("<skill>/references/core.md"),
 *   - backslashes become forward slashes.
 */
export class FlowNormalizer {
  private readonly workdirVariants: readonly string[];
  private readonly skillRel: string;

  public constructor(workdir: string, skillInstallPath: string) {
    const fwd = path.resolve(workdir).replaceAll("\\", "/").replace(/\/$/, "");
    const variants = new Set([fwd]);
    const drive = /^([A-Za-z]):\/(.*)$/.exec(fwd);
    if (drive) variants.add(`/${drive[1]!.toLowerCase()}/${drive[2]}`); // Git Bash form, /c/Users/...
    this.workdirVariants = [...variants].sort((a, b) => b.length - a.length);
    this.skillRel = skillInstallPath.replaceAll("\\", "/").replace(/\/$/, "");
  }

  /** Normalizes free text such as a shell command. */
  public text(value: string): string {
    let out = value.replaceAll("\\", "/");
    for (const v of this.workdirVariants) {
      // "<workdir>/src/a.ts" → "src/a.ts"; a bare "<workdir>" (e.g. "cd <workdir>") → ".".
      out = out
        .replace(new RegExp(escapeRegex(v) + "/", "gi"), "")
        .replace(new RegExp(escapeRegex(v), "gi"), ".");
    }
    out = out.replace(
      new RegExp(`(\\./)?${escapeRegex(this.skillRel)}`, "g"),
      SKILL_PREFIX,
    );
    return out.trim();
  }

  /** Normalizes a file path; paths outside the workdir stay absolute (with forward slashes). */
  public path(value: string): string {
    const normalized = this.text(value).replace(/^\.\//, "");
    return normalized === "" ? "." : normalized;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A command that runs one of the skill's scripts becomes a script step,
 * e.g. "node <skill>/scripts/materialize-template.mjs --template x" → script materialize-template ["--template","x"].
 */
export function toCommandOrScriptStep(
  command: string,
  exitCode: number | null,
): FlowStep {
  const m = new RegExp(
    `${escapeRegex(SKILL_PREFIX)}/scripts/([\\w.-]+?)(?:\\.m?[jt]s)?(?=\\s|$|["'])(.*)$`,
  ).exec(command);
  if (m) {
    const args = m[2]!.trim().split(/\s+/).filter(Boolean).map(stripQuotes);
    return { kind: "script", name: m[1]!, args };
  }
  return { kind: "command", command, exitCode };
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

export function describeStep(step: FlowStep): string {
  switch (step.kind) {
    case "skill-loaded":
      return `skill-loaded ${step.skill} (via ${step.via})`;
    case "read":
      return `read ${step.path}`;
    case "fetch":
      return `fetch ${step.url}`;
    case "script":
      return `script ${[step.name, ...step.args].join(" ")}`;
    case "command":
      return `command ${step.command} → exit ${step.exitCode ?? "?"}`;
    case "write":
      return `write ${step.path}`;
  }
}
