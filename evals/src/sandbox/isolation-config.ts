// isolation.json: the network allowlists and resource limits for --isolation container.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { EvalSetupError } from "../engine/errors.js";
import type { Evals } from "../shared/contracts.js";

/** A host name ("github.com") or a subdomain wildcard ("*.example.com", which does not match example.com). */
export const hostPattern = z
  .string()
  .regex(
    /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    'hosts are names like "github.com" or "*.example.com" (no scheme, port or path)',
  );

const configSchema = z
  .object({
    $comment: z.string().optional(),
    network: z
      .object({
        /** Reachable in every run, even network: false: the model APIs and the npm registry. */
        always: z.array(hostPattern),
        /** Also reachable when network is true (or an { allow } list). */
        allow: z.array(hostPattern),
      })
      .strict(),
    limits: z
      .object({
        cpus: z.number().positive(),
        /** Docker's memory syntax: "4g", "512m". Swap is set to the same value (no swap). */
        memory: z.string().regex(/^\d+[kmg]?$/i),
        pids: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export type IsolationConfig = z.infer<typeof configSchema>;

export async function loadIsolationConfig(
  file: string,
): Promise<IsolationConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    throw new EvalSetupError(`Cannot read ${file}: ${(err as Error).message}`);
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success)
    throw new EvalSetupError(
      `${file} is invalid:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`,
    );
  return parsed.data;
}

/**
 * The hosts a run may reach. false: only `always` (model APIs, npm registry). true: `always` and
 * `allow`. { allow }: those plus the case's own hosts. There is no fully open setting.
 */
export function allowedHosts(
  config: IsolationConfig,
  network: Evals.Cases.Network,
): string[] {
  const hosts =
    network === false
      ? config.network.always
      : [
          ...config.network.always,
          ...config.network.allow,
          ...(network === true ? [] : network.allow),
        ];
  return [...new Set(hosts.map((h) => h.toLowerCase()))];
}
