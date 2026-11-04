import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkdirGuard } from "../src/adapters/claude-guard.js";

const workdir = path.join(os.tmpdir(), "iointel-eval-x", "work");
const outside = path.join(os.tmpdir(), "elsewhere", "file.txt");
const guard = createWorkdirGuard(workdir);

describe("workdir guard", () => {
  it("allows file tools inside the workdir and denies them outside", () => {
    expect(
      guard("Write", { file_path: path.join(workdir, "src", "a.ts") }).behavior,
    ).toBe("allow");
    expect(guard("Edit", { file_path: "src/a.ts" }).behavior).toBe("allow");
    expect(guard("Write", { file_path: outside }).behavior).toBe("deny");
    expect(guard("Write", { file_path: "../escape.txt" }).behavior).toBe(
      "deny",
    );
    expect(guard("Read", { file_path: outside }).behavior).toBe("deny");
    expect(guard("Grep", { pattern: "x", path: outside }).behavior).toBe(
      "deny",
    );
  });

  it("allows ordinary commands and denies commands naming paths outside the workdir", () => {
    expect(
      guard("Bash", { command: "npm install && npm run build" }).behavior,
    ).toBe("allow");
    expect(
      guard("Bash", { command: `cat ${path.join(workdir, "package.json")}` })
        .behavior,
    ).toBe("allow");
    expect(guard("Bash", { command: "ls > /dev/null 2>&1" }).behavior).toBe(
      "allow",
    );
    expect(guard("Bash", { command: `echo hi > ${outside}` }).behavior).toBe(
      "deny",
    );
    expect(guard("Bash", { command: "rm -rf ../../something" }).behavior).toBe(
      "deny",
    );
    expect(
      guard("PowerShell", { command: "Remove-Item ~/.ssh -Recurse" }).behavior,
    ).toBe("deny");
    expect(
      guard("Bash", { command: "curl https://docs-ai.interop.io/llms.txt" })
        .behavior,
    ).toBe("allow");
  });

  it("allows web tools and network commands", () => {
    expect(
      guard("WebFetch", { url: "https://docs-ai.interop.io" }).behavior,
    ).toBe("allow");
    expect(
      guard("Bash", { command: "curl https://docs-ai.interop.io/llms.txt" })
        .behavior,
    ).toBe("allow");
  });

  it("allows tools that touch no paths, such as Skill", () => {
    expect(guard("Skill", { skill: "io-intelligence" }).behavior).toBe("allow");
  });
});
