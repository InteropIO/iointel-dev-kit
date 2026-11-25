// The runner image: built locally from evals/docker, tagged by a content hash so it is rebuilt
// exactly when the Dockerfile, the proxy or the agent CLI versions change.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DockerCli } from "./docker-cli.js";

export const IMAGE_REPOSITORY = "iointel-evals-runner";
const BUILD_TIMEOUT_MS = 20 * 60_000;

export interface RunnerImageSpec {
  /** The build context: evals/docker. */
  readonly contextDir: string;
  readonly buildArgs: Readonly<Record<string, string>>;
}

/**
 * The CLI versions the installed SDKs were built against: the Agent SDK's `claudeCodeVersion` and
 * the Codex SDK's `@openai/codex` dependency. Pinning the image to them keeps host and container
 * runs on the same agent versions.
 */
export async function agentCliVersions(
  evalsRoot: string,
): Promise<Record<string, string>> {
  // Read by path: the SDKs' "exports" don't expose their package.json to require.resolve.
  const readPkg = async (name: string) =>
    JSON.parse(
      await readFile(
        path.join(evalsRoot, "node_modules", name, "package.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
  const claude = await readPkg("@anthropic-ai/claude-agent-sdk");
  const codex = await readPkg("@openai/codex-sdk");
  const claudeVersion = claude.claudeCodeVersion;
  const codexVersion = (
    codex.dependencies as Record<string, string> | undefined
  )?.["@openai/codex"];
  if (typeof claudeVersion !== "string" || !codexVersion)
    throw new Error(
      "Cannot tell which Claude Code and Codex CLI versions the installed SDKs expect (run npm install in evals/).",
    );
  return { CLAUDE_CODE_VERSION: claudeVersion, CODEX_VERSION: codexVersion };
}

/** iointel-evals-runner:<12 hex chars of the context files and build args>. */
export async function imageTag(spec: RunnerImageSpec): Promise<string> {
  const hash = createHash("sha256");
  const files = (await readdir(spec.contextDir)).sort();
  for (const file of files) {
    hash.update(file);
    // Line endings normalised, so a Windows checkout hashes like a Linux one.
    hash.update(
      (await readFile(path.join(spec.contextDir, file), "utf8")).replace(
        /\r\n/g,
        "\n",
      ),
    );
  }
  hash.update(JSON.stringify(Object.entries(spec.buildArgs).sort()));
  return `${IMAGE_REPOSITORY}:${hash.digest("hex").slice(0, 12)}`;
}

/** Builds the image unless that tag already exists. Returns the tag. */
export async function ensureImage(
  docker: DockerCli,
  spec: RunnerImageSpec,
  log: (line: string) => void,
): Promise<string> {
  const tag = await imageTag(spec);
  const existing = await docker.run(["image", "inspect", tag]);
  if (existing.code === 0) return tag;

  log(
    `Building the runner image ${tag} (first container run, or its inputs changed)…`,
  );
  const built = await docker.run(
    [
      "build",
      "--tag",
      tag,
      "--label",
      "iointel-evals.image=runner",
      ...Object.entries(spec.buildArgs).flatMap(([k, v]) => [
        "--build-arg",
        `${k}=${v}`,
      ]),
      spec.contextDir,
    ],
    { timeoutMs: BUILD_TIMEOUT_MS },
  );
  if (built.code !== 0)
    throw new Error(
      `Building the runner image failed:\n${(built.stderr || built.stdout).slice(-4000)}`,
    );
  return tag;
}
