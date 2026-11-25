// Opt-in contract tests for --isolation container against a real Docker daemon:
// `npm run test:contract`. They're skipped when Docker isn't running. The sandbox tests use no model
// API. The agent tests also need credentials, like adapters.test.ts.
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/adapters/claude-code.js";
import { CodexAdapter } from "../../src/adapters/codex.js";
import { ContainerSandbox } from "../../src/sandbox/container-sandbox.js";
import { containerCredentials } from "../../src/sandbox/credentials.js";
import { SpawnDockerCli } from "../../src/sandbox/docker-cli.js";
import { loadIsolationConfig } from "../../src/sandbox/isolation-config.js";
import { agentCliVersions } from "../../src/sandbox/runner-image.js";
import { GitWorkspaceManager } from "../../src/workspace/workspace.js";
import type { Evals } from "../../src/shared/contracts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const evalsRoot = path.resolve(here, "../..");
const SKILL = "io-intelligence";
const dockerUp =
  spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    timeout: 20_000,
  }).status === 0;

async function newSandbox(tools: readonly string[]) {
  const sandbox = new ContainerSandbox({
    docker: new SpawnDockerCli(),
    image: {
      contextDir: path.join(evalsRoot, "docker"),
      buildArgs: await agentCliVersions(evalsRoot),
    },
    config: await loadIsolationConfig(path.join(evalsRoot, "isolation.json")),
    workdirRoot: os.tmpdir(),
    credentials: containerCredentials,
    log: (line) => console.log(line),
  });
  await sandbox.start(tools);
  return sandbox;
}

describe.skipIf(!dockerUp)("container sandbox (real Docker)", () => {
  let sandbox: ContainerSandbox;
  beforeAll(async () => {
    sandbox = await newSandbox([]);
  }, 1_200_000);
  afterAll(async () => {
    await sandbox?.stop();
  });

  it("keeps writes outside the workdir inside the container, and the root read-only", async () => {
    const box = await sandbox.open({ network: true });
    try {
      await box.writeFile(box.resolve("inside.txt"), "hello");
      const outside = await box.shell(
        "echo escaped > ../outside.txt && echo escaped > /home/node/outside.txt",
        box.workdir,
        30_000,
      );
      expect(outside.exitCode).toBe(0); // allowed: it is the container's own folder
      const root = await box.shell("touch /etc/escape", box.workdir, 30_000);
      expect(root.exitCode).not.toBe(0);
      const hostPath = await box.shell(
        `test -e "${os.homedir().replaceAll("\\", "/")}"`,
        box.workdir,
        30_000,
      );
      expect(hostPath.exitCode).not.toBe(0); // the host's folders are not mounted

      await box.sync();
      expect(
        await readFile(path.join(box.hostWorkdir, "inside.txt"), "utf8"),
      ).toBe("hello");
      await expect(
        access(path.join(box.hostWorkdir, "..", "outside.txt")),
      ).rejects.toThrow();
    } finally {
      await box.close();
    }
  });

  it("prepares a workspace from an official template, diffs the agent's changes and runs commands", async () => {
    const workspace = new GitWorkspaceManager({
      skillDir: path.resolve(evalsRoot, "../skills", SKILL),
      localTemplatesDir: path.resolve(evalsRoot, "templates"),
      sandbox,
    });
    const options = {
      template: { official: "ai-web-vanilla" },
      skillInstallPath: `.claude/skills/${SKILL}`,
      withSkill: true,
    };
    const ws = await workspace.prepare(options);
    const again = await workspace.prepare(options); // seeded from the per-run copy
    try {
      expect(await ws.box.exists(ws.box.resolve("package.json"))).toBe(true);
      expect(await again.box.exists(again.box.resolve("package.json"))).toBe(
        true,
      );
      expect(
        await ws.box.exists(ws.box.resolve(`.claude/skills/${SKILL}/SKILL.md`)),
      ).toBe(true);
      await ws.box.writeFile(ws.box.resolve("added.txt"), "new\n");
      const diff = await ws.diff();
      expect(diff).toContain("+++ b/added.txt");
      expect(diff).not.toContain(".claude/skills");
      const npm = await ws.box.shell("npm --version", ws.workdir, 60_000);
      expect(npm.exitCode).toBe(0);
    } finally {
      await ws.cleanup();
      await again.cleanup();
      await workspace.stop();
      sandbox = await newSandbox([]); // workspace.stop() stopped the shared sandbox
    }
  });

  it("lets allowlisted hosts through the proxy and blocks the rest, fast, with a log", async () => {
    const box = await sandbox.open({ network: false });
    try {
      await box.writeFile(box.resolve(".keep"), ""); // a workspace would have created the workdir
      const allowed = await box.shell(
        "curl -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/",
        box.workdir,
        60_000,
      );
      expect(allowed.output).toContain("200");

      const started = Date.now();
      const blocked = await box.shell(
        "curl -sS -o /dev/null https://github.com/",
        box.workdir,
        60_000,
      );
      expect(blocked.exitCode).not.toBe(0);
      expect(Date.now() - started).toBeLessThan(15_000);

      const direct = await box.shell(
        "curl -sS --noproxy '*' --max-time 20 -o /dev/null https://registry.npmjs.org/",
        box.workdir,
        60_000,
      );
      expect(direct.exitCode).not.toBe(0); // no way out but the proxy

      expect(await box.networkLog()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            host: "registry.npmjs.org",
            allowed: true,
          }),
          expect.objectContaining({ host: "github.com", allowed: false }),
        ]),
      );
    } finally {
      await box.close();
    }
  });
});

for (const adapter of [
  ClaudeCodeAdapter.getInstance(),
  CodexAdapter.getInstance(),
]) {
  const credentialProblem =
    adapter.checkReady() ?? containerCredentials([adapter.tool]).problems[0];
  describe.skipIf(!dockerUp || credentialProblem !== undefined)(
    `${adapter.tool} in a container (real Docker and model)`,
    () => {
      let sandbox: ContainerSandbox;
      let workspace: GitWorkspaceManager;
      beforeAll(async () => {
        sandbox = await newSandbox([adapter.tool]);
        workspace = new GitWorkspaceManager({
          skillDir: path.resolve(evalsRoot, "../skills", SKILL),
          localTemplatesDir: path.resolve(evalsRoot, "templates"),
          sandbox,
        });
      }, 1_200_000);
      afterAll(async () => {
        await sandbox?.stop();
      });

      async function run(prompt: string) {
        const skillInstallPath = `${adapter.skillsDir}/${SKILL}`;
        const ws = await workspace.prepare({
          skillInstallPath,
          withSkill: true,
        });
        try {
          const input: Evals.Agent.RunInput = {
            prompt,
            model: undefined,
            workdir: ws.workdir,
            skillInstallPath,
            network: true,
            maxTurns: 15,
            timeoutMs: 300_000,
            box: ws.box,
          };
          return {
            result: await adapter.run(input),
            network: await ws.box.networkLog(),
          };
        } finally {
          await ws.cleanup();
        }
      }

      it("triggers the skill and finishes, with its traffic through the proxy", async () => {
        const { result, network } = await run(
          "In my io.Connect browser app, which @interopio package do I use to expose an MCP tool to io.Assist? Answer briefly.",
        );
        expect(result.error).toBeUndefined();
        expect(result.stopReason).toBe("done");
        expect(result.skillTriggered).toBe(true);
        expect(network?.some((r) => r.allowed)).toBe(true);
      });

      it("cannot write to the host", async () => {
        const outside = path.join(
          os.tmpdir(),
          `iointel-eval-escape-${adapter.tool}-${Date.now()}.txt`,
        );
        await run(
          `Create the file ${outside} containing the word hello. Do not ask for confirmation.`,
        );
        await expect(access(outside)).rejects.toThrow();
      });
    },
  );
}
