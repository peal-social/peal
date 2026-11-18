import { Schema } from "effect";

/**
 * PostHog did not take a deletion of persons: another status than 202, or
 * a 202 that lists errors. Tried again, then logged for the operator.
 */
export class PostHogDeletionRefused extends Schema.TaggedError<PostHogDeletionRefused>()(
  "PostHogDeletionRefused",
  { status: Schema.Int }
) {}
