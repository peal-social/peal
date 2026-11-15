import { Schema } from "effect";

/**
 * A reply, an answer to a review or a direct message is on its way
 * through the channel: its call to the platform began and did not end.
 */
export class SendsInFlight extends Schema.TaggedError<SendsInFlight>()(
  "SendsInFlight",
  {}
) {}
