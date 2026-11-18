import { Schema } from "effect";

/**
 * The analytics provider did not delete an erasure's persons: it refused
 * (`status`), or did not answer (none). Tried again later; never fatal to
 * the erasure itself.
 */
export class AnalyticsErasureFailed extends Schema.TaggedError<AnalyticsErasureFailed>()(
  "AnalyticsErasureFailed",
  { status: Schema.optionalKey(Schema.Int) }
) {}
