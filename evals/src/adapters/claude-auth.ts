// Shared Claude Code credentials for the Claude Code adapter and the judge, which both run through the CLI.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CLIENT_APP = "io-intelligence-evals/0.1.0";
const CREDENTIAL_VARS = ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"];

/**
 * Says why Claude Code can't authenticate, or undefined when it can.
 * An API key or OAuth token in the environment wins; otherwise the CLI uses the local Claude Code login.
 */
export function claudeAuthProblem(): string | undefined {
  if (CREDENTIAL_VARS.some((name) => process.env[name])) return undefined;
  // macOS keeps the login in the Keychain, which can't be checked without a prompt: let the CLI report it.
  if (process.platform === "darwin") return undefined;
  const configDir =
    process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
  if (existsSync(path.join(configDir, ".credentials.json"))) return undefined;
  return "no Claude credentials: log in with `claude` (subscription), or set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in evals/.env";
}

/** The environment for a Claude Code process. Empty credential variables are dropped so they don't hide the local login. */
export function claudeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP,
  };
  for (const name of CREDENTIAL_VARS) if (!env[name]) delete env[name];
  return env;
}
