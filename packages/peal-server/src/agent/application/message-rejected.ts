import { Schema } from "effect";

/** The person's message holds nothing but white space. */
export class MessageRejected extends Schema.TaggedError<MessageRejected>()(
  "MessageRejected",
  { reason: Schema.Literal("empty") }
) {}
