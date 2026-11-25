import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { CodexAdapter } from "../src/adapters/codex.js";
import type { Evals } from "../src/shared/contracts.js";

/** A container box whose only working part is spawn: it replays scripted Codex JSON events. */
function fakeBox(lines: string[], exitCode = 0) {
  const spawned: Evals.Sandbox.SpawnRequest[] = [];
  let stdin = "";
  const box = {
    isolation: "container",
    workdir: "/home/node/project/work",
    spawn(request: Evals.Sandbox.SpawnRequest) {
      spawned.push(request);
      const child = new EventEmitter() as ChildProcess & EventEmitter;
      const stdout = new PassThrough();
      const input = new PassThrough();
      input.on("data", (c: Buffer) => (stdin += c.toString()));
      Object.assign(child, {
        stdin: input,
        stdout,
        stderr: new PassThrough(),
        exitCode: null,
        kill: () => true,
      });
      setImmediate(() => {
        stdout.end(lines.map((l) => l + "\n").join(""));
        stdout.on("end", () => {
          Object.assign(child, { exitCode });
          child.emit("close", exitCode);
        });
      });
      return child;
    },
  } as unknown as Evals.Sandbox.Box;
  return { box, spawned, stdin: () => stdin };
}

const input = (box: Evals.Sandbox.Box): Evals.Agent.RunInput => ({
  prompt: "Add Code Mode",
  model: "gpt-5-codex",
  workdir: box.workdir,
  skillInstallPath: ".agents/skills/io-intelligence",
  network: false,
  maxTurns: 10,
  timeoutMs: 60_000,
  box,
});

describe("Codex in a container", () => {
  const key = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  });

  it("runs codex exec in the box with danger-full-access and reads its events", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { box, spawned, stdin } = fakeBox([
      JSON.stringify({ type: "thread.started", thread_id: "t" }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "1", type: "agent_message", text: "Done." },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      }),
    ]);

    const result = await CodexAdapter.getInstance().run(input(box));

    expect(result.stopReason).toBe("done");
    expect(result.finalMessage).toBe("Done.");
    expect(result.transcript).toHaveLength(3);
    expect(spawned[0]!.command).toBe("codex");
    expect(spawned[0]!.args).toEqual([
      "exec",
      "--experimental-json",
      "--model",
      "gpt-5-codex",
      "--sandbox",
      "danger-full-access",
      "--cd",
      "/home/node/project/work",
      "--skip-git-repo-check",
      "--config",
      'web_search="disabled"',
      "--config",
      'approval_policy="never"',
    ]);
    expect(spawned[0]!.env).toEqual({ CODEX_API_KEY: "sk-test" });
    expect(stdin()).toBe("Add Code Mode");
  });

  it("reports a failed codex exit as an error", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { box } = fakeBox([], 2);
    const result = await CodexAdapter.getInstance().run(input(box));
    expect(result.stopReason).toBe("error");
    expect(result.error).toMatch(/Codex exited with code 2/);
  });
});
