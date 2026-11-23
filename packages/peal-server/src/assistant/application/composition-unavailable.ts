import { Schema } from "effect";

/**
 * The workspace composes no slide video: no service is chosen for it
 * (`notSet`), or its key no longer opens (`keyUnreadable`).
 */
export class CompositionUnavailable extends Schema.TaggedError<CompositionUnavailable>()(
  "CompositionUnavailable",
  { reason: Schema.Literals(["notSet", "keyUnreadable"]) }
) {}
