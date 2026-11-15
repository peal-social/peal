import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace tried to connect chats too many times for now. */
export class ChatConnectLimited extends Schema.TaggedError<ChatConnectLimited>()(
  "ChatConnectLimited",
  { ...errorEnvelope },
  {
    description:
      "The workspace tried to connect chats too many times in the last hour. Try again later.",
    httpApiStatus: 429,
  }
) {}
