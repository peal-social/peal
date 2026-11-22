import { Schema } from "effect";

/** The person has no chat with this id in this workspace: it never existed, was deleted, expired, or is someone else's. */
export class ChatNotFound extends Schema.TaggedError<ChatNotFound>()(
  "ChatNotFound",
  {}
) {}
