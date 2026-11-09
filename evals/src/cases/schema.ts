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

// A fraction in (0, 1], for thresholds.
const share = z.number().gt(0).lte(1);

const targetId = z
  .string()
  .regex(
    /^[a-z0-9-]+(\/[A-Za-z0-9._:-]+)?$/,
    'target must look like "<tool>/<model>", e.g. "claude-code/claude-sonnet-5-5"',
  );

const template = z.union([
  z.object({ official: z.string().min(1) }).strict(),
  z.object({ local: z.string().min(1) }).strict(),
]);

const input = z
  .object({
    prompt: z.string().min(1),
    template: template.optional(),
    reply: z.string().min(1).optional(),
  })
  .strict();

const common = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
  note: z.string().optional(),
  targets: z
    .array(targetId)
    .min(1, "targets is required and must list at least one target"),
  network: z.boolean().default(true),
  repeat: z.number().int().positive().optional(),
  /** Fraction of runs that must pass, 0..1. */
  passThreshold: share.optional(),
  maxTurns: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  input,
};

// Deterministic checks shared by every kind.
const deterministicCommon = {
  expectSkill: z.boolean().default(true),
  flow: z
    .object({
      mustRead: z.array(matcher).default([]),
      mustNotRead: z.array(matcher).default([]),
      mustRun: z.array(matcher).default([]),
      mustFetch: z.array(matcher).default([]),
    })
    .strict()
    .optional(),
};

const judge = z
  .object({
    rubric: z
      .array(z.string().trim().min(1, "rubric items must not be empty"))
      .min(1, "judge.rubric must list at least one item"),
    threshold: share.optional(),
  })
  .strict();

// Omitted output blocks use prefault (not default), so they are parsed and get their inner defaults.
const triggerCase = z
  .object({
    kind: z.literal("trigger"),
    ...common,
    output: z
      .object({
        deterministic: z.object(deterministicCommon).strict().prefault({}),
      })
      .strict()
      .prefault({}),
  })
  .strict();

const answerCase = z
  .object({
    kind: z.literal("answer"),
    ...common,
    output: z
      .object({
        deterministic: z
          .object({
            ...deterministicCommon,
            mustInclude: z.array(matcher).default([]),
            mustNotInclude: z.array(matcher).default([]),
          })
          .strict()
          .prefault({}),
        judge: judge.optional(),
      })
      .strict()
      .prefault({}),
  })
  .strict();

const dependencyMap = z.record(z.string(), z.string());

const taskCase = z
  .object({
    kind: z.literal("task"),
    ...common,
    output: z
      .object({
        deterministic: z
          .object({
            ...deterministicCommon,
            files: z.array(z.string()).default([]),
            packageJson: z
              .object({
                dependencies: dependencyMap.optional(),
                devDependencies: dependencyMap.optional(),
              })
              .strict()
              .optional(),
            commands: z.array(z.string()).default([]),
          })
          .strict()
          .prefault({}),
        judge: judge.optional(),
      })
      .strict()
      .prefault({}),
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
