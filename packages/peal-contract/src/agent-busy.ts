import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The chat already has a run under way: one at a time, so its messages
 * stay in order.
 */
export class AgentBusy extends Schema.TaggedError<AgentBusy>()(
  "AgentBusy",
  { ...errorEnvelope },
  {
    description:
      "The agent is still answering in this chat: wait for it to finish, or stop it, before sending another message. Nothing was sent.",
    httpApiStatus: 409,
  }
) {}
