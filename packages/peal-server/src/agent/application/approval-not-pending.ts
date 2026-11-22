import { Schema } from "effect";

/** The change named no longer waits for the person's answer: answered already, or replaced by a message sent since. */
export class ApprovalNotPending extends Schema.TaggedError<ApprovalNotPending>()(
  "ApprovalNotPending",
  {}
) {}
