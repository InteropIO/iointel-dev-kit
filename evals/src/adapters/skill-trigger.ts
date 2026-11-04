/**
 * True when a Claude Agent SDK transcript shows the skill under test being loaded: a Skill tool call
 * naming it, or a Read of its SKILL.md. The skill name is the last segment of `skillInstallPath`.
 */
export function skillTriggered(
  messages: readonly unknown[],
  skillInstallPath: string,
): boolean {
  const installPath = toSlashes(skillInstallPath).replace(/\/+$/, "");
  const skillName = installPath.split("/").at(-1)!;
  const skillMd = `${installPath}/SKILL.md`;

  for (const msg of messages as Array<{
    type?: string;
    message?: { content?: unknown };
  }>) {
    const content = msg?.message?.content;
    if (msg?.type !== "assistant" || !Array.isArray(content)) continue;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      if (block.name === "Skill") {
        const skill = input.skill ?? input.command ?? input.name;
        if (typeof skill === "string" && skill.replace(/^\//, "") === skillName)
          return true;
      } else if (block.name === "Read" && typeof input.file_path === "string") {
        const file = toSlashes(input.file_path);
        if (file === skillMd || file.endsWith(`/${skillMd}`)) return true;
      }
    }
  }
  return false;
}

function toSlashes(p: string): string {
  return p.replaceAll("\\", "/");
}
