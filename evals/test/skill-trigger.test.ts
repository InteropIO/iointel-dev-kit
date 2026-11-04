import { describe, expect, it } from "vitest";
import { skillTriggered } from "../src/adapters/skill-trigger.js";

const INSTALL = ".claude/skills/io-intelligence";

const toolUse = (name: string, input: Record<string, unknown>) => ({
  type: "assistant",
  message: {
    content: [
      { type: "text", text: "Let me check." },
      { type: "tool_use", id: "t1", name, input },
    ],
  },
});

describe("skill trigger detection", () => {
  it("detects a Skill tool call naming the skill", () => {
    expect(
      skillTriggered([toolUse("Skill", { skill: "io-intelligence" })], INSTALL),
    ).toBe(true);
    expect(
      skillTriggered(
        [toolUse("Skill", { command: "/io-intelligence" })],
        INSTALL,
      ),
    ).toBe(true);
  });

  it("detects a Read of the skill's SKILL.md, relative or absolute, with either slash", () => {
    for (const file_path of [
      ".claude/skills/io-intelligence/SKILL.md",
      "/tmp/iointel-eval-x/work/.claude/skills/io-intelligence/SKILL.md",
      "C:\\Temp\\iointel-eval-x\\work\\.claude\\skills\\io-intelligence\\SKILL.md",
    ])
      expect(skillTriggered([toolUse("Read", { file_path })], INSTALL)).toBe(
        true,
      );
  });

  it("takes the skill name from the install path", () => {
    expect(
      skillTriggered(
        [toolUse("Skill", { skill: "io-intelligence" })],
        ".claude/skills/renamed",
      ),
    ).toBe(false);
    expect(
      skillTriggered(
        [toolUse("Skill", { skill: "renamed" })],
        ".claude/skills/renamed",
      ),
    ).toBe(true);
  });

  it("ignores other skills, other files of the skill, and look-alike paths", () => {
    expect(skillTriggered([toolUse("Skill", { skill: "pdf" })], INSTALL)).toBe(
      false,
    );
    for (const file_path of [
      ".claude/skills/io-intelligence/references/core.md",
      ".claude/skills/other-io-intelligence/SKILL.md",
    ])
      expect(skillTriggered([toolUse("Read", { file_path })], INSTALL)).toBe(
        false,
      );
  });

  it("ignores tool_use blocks outside assistant messages, and malformed messages", () => {
    expect(
      skillTriggered(
        [
          { ...toolUse("Skill", { skill: "io-intelligence" }), type: "user" },
          null,
          { type: "assistant" },
          { type: "assistant", message: { content: "text only" } },
          { type: "result", subtype: "success" },
        ],
        INSTALL,
      ),
    ).toBe(false);
  });
});
