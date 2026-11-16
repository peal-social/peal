import { Schema } from "effect";

/** The workspace tried to connect chats too many times for now. */
export class ChatConnectLimited extends Schema.TaggedError<ChatConnectLimited>()(
  "ChatConnectLimited",
  {}
) {}
