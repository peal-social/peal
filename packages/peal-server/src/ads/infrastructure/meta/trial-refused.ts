import { Schema } from "effect";

/**
 * The Marketing API trial refused what the operator asked before sending
 * anything: an activation outside the day or the account it is allowed
 * on, or an argument it cannot use.
 */
export class TrialRefused extends Schema.TaggedError<TrialRefused>()(
  "TrialRefused",
  { reason: Schema.String }
) {}
