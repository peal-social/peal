import { Schema } from "effect";

/**
 * The workspace a channel is moved to does not count its channels with
 * the one it is in: a channel moves only within its pool.
 */
export class ChannelOutsidePool extends Schema.TaggedError<ChannelOutsidePool>()(
  "ChannelOutsidePool",
  {}
) {}
