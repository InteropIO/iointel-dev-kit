// How agents authenticate inside a runner container. An env-var credential is forwarded by name.
// Without one, the Claude Code login file is copied in as a stopgap. The target is env-var only:
// the copied login can refresh inside the container and go stale on the host, and macOS keeps the
// login in the Keychain, which no container can read.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CredentialPlan } from "./container-sandbox.js";

const CONTAINER_CREDENTIALS_FILE = "/home/node/.claude/.credentials.json";
const SETUP_HINT =
  "run `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY) in evals/.env";

export function containerCredentials(
  tools: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): CredentialPlan {
  if (!tools.includes("claude-code"))
    return { problems: [], files: [], notes: [] };
  if (env.ANTHROPIC_API_KEY || env.CLAUDE_CODE_OAUTH_TOKEN)
    return { problems: [], files: [], notes: [] };

  const configDir = env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
  const file = path.join(configDir, ".credentials.json");
  if (platform !== "darwin" && existsSync(file))
    return {
      problems: [],
      files: [{ host: file, box: CONTAINER_CREDENTIALS_FILE }],
      notes: [
        `claude-code: copying your Claude Code login into each container. Prefer a token: ${SETUP_HINT}.`,
      ],
    };
  return {
    problems: [
      `claude-code: a container can't use your Claude Code login${platform === "darwin" ? " (macOS keeps it in the Keychain)" : ""}; ${SETUP_HINT}.`,
    ],
    files: [],
    notes: [],
  };
}
