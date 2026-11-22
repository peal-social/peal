import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The change the agent asked to make no longer waits for an answer: it was
 * answered already, or the chat moved on since.
 */
export class AgentApprovalNotPending extends Schema.TaggedError<AgentApprovalNotPending>()(
  "AgentApprovalNotPending",
  { ...errorEnvelope },
  {
    description:
      "This change no longer waits for your answer: it was approved or declined already, or a message sent since replaced it. Nothing was done.",
    httpApiStatus: 409,
  }
) {}
