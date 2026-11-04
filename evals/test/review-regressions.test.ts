import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkdirGuard } from "../src/adapters/claude-guard.js";
import { compileMatcher } from "../src/checks/matcher.js";

describe("matchers", () => {
  it("give the same answer on repeated calls even with the g flag", () => {
    const m = compileMatcher("/core/g");
    expect(["references/core.md", "core.md", "x/core"].map(m)).toEqual([
      true,
      true,
      true,
    ]);
  });
});

describe("workdir guard false positives", () => {
  const guard = createWorkdirGuard(
    path.join(os.tmpdir(), "iointel-eval-g", "work"),
  );

  it("allows slash-prefixed arguments that are not filesystem paths", () => {
    expect(
      guard("Bash", { command: 'grep -rn "/api/users" src' }).behavior,
    ).toBe("allow");
    expect(
      guard("Bash", { command: "sed -i '/debug/d' app.ts" }).behavior,
    ).toBe("allow");
    expect(guard("Bash", { command: "npx vite build --base /" }).behavior).toBe(
      "allow",
    );
  });
});
