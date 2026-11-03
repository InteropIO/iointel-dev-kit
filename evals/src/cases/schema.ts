import { z } from "zod";
import { matcherError } from "../checks/matcher.js";
import type { Evals } from "../shared/contracts.js";
import type { Mutable, Same } from "../shared/types.js";

// A matcher is a plain substring, or a regex written as "/pattern/flags" (validated at load time).
const matcher = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    const error = matcherError(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });

const targetId = z
  .string()
  .regex(
    /^[a-z0-9-]+(\/[A-Za-z0-9._:-]+)?$/,
    'target must look like "<tool>/<model>", e.g. "claude-code/claude-sonnet-5-5"',
  );

const common = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
  targets: z
    .array(targetId)
    .min(1, "targets is required and must list at least one target"),
  network: z.boolean().default(true),
  prompt: z.string().min(1),
  expectSkill: z.boolean().default(true),
  repeat: z.number().int().positive().optional(),
  /** Fraction of runs that must pass, 0..1. */
  passThreshold: z.number().gt(0).lte(1).optional(),
  maxTurns: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  flow: z
    .object({
      mustRead: z.array(matcher).default([]),
      mustNotRead: z.array(matcher).default([]),
      mustRun: z.array(matcher).default([]),
    })
    .strict()
    .optional(),
};

const triggerCase = z
  .object({ kind: z.literal("trigger"), ...common })
  .strict();

const answerCase = z
  .object({
    kind: z.literal("answer"),
    ...common,
    mustInclude: z.array(matcher).default([]),
    mustNotInclude: z.array(matcher).default([]),
    rubric: z.string().optional(),
  })
  .strict();

const dependencyMap = z.record(z.string(), z.string());

const taskCase = z
  .object({
    kind: z.literal("task"),
    ...common,
    setup: z
      .union([
        z.object({ template: z.string().min(1) }).strict(),
        z.object({ fixture: z.string().min(1) }).strict(),
        z.object({}).strict(),
      ])
      .default({}),
    checks: z
      .object({
        files: z.array(z.string()).default([]),
        packageJson: z
          .object({
            dependencies: dependencyMap.optional(),
            devDependencies: dependencyMap.optional(),
          })
          .strict()
          .optional(),
        commands: z.array(z.string()).default([]),
        reviewRubric: z.string().optional(),
      })
      .strict()
      .default({ files: [], commands: [] }),
  })
  .strict();

export const caseSchema = z.discriminatedUnion("kind", [
  triggerCase,
  answerCase,
  taskCase,
]);

// Compile-time check that the schema produces exactly the Evals.Cases contract:
// fails to compile when a field is added, removed or retyped on one side only.
const schemaMatchesContract: Same<
  z.infer<typeof caseSchema>,
  Mutable<Evals.Cases.Case>
> = true;
void schemaMatchesContract;
