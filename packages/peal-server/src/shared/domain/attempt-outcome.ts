import { Schema } from "effect";

import { PublishFailureSchema } from "./publish-failure.ts";
import { PublishResultSchema } from "./publish-result.ts";

/** How a publishing attempt ended: a result, or the platform's refusal. */
export const AttemptOutcomeSchema = Schema.Union([
  PublishResultSchema,
  PublishFailureSchema,
]);

export type AttemptOutcome = typeof AttemptOutcomeSchema.Type;
