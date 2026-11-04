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

// Strict: a field the engine no longer supports (kind, targets, repeat, flow…) is an error, not ignored.
export const caseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
    prompt: z.string().min(1),
    mustInclude: z.array(matcher).default([]),
    mustNotInclude: z.array(matcher).default([]),
    rubric: z.string().optional(),
  })
  .strict();

// Compile-time check that the schema produces exactly the Evals.Cases contract:
// fails to compile when a field is added, removed or retyped on one side only.
const schemaMatchesContract: Same<
  z.infer<typeof caseSchema>,
  Mutable<Evals.Cases.Case>
> = true;
void schemaMatchesContract;
