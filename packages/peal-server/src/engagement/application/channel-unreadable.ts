import { Schema } from "effect";

import { PlatformSchema } from "#shared/domain/platform.ts";

/**
 * Nothing can be read or sent on the channel:
 *
 * - `disconnected`: it left the workspace.
 * - `paused`: it is turned off or needs reconnecting; it may work again.
 * - `unsupported`: Peal reads no comments on its platform.
 */
export class ChannelUnreadable extends Schema.TaggedError<ChannelUnreadable>()(
  "ChannelUnreadable",
  {
    /**
     * The channel's platform, where it is known and reconnecting would
     * make the channel work again (its token ran out).
     */
    platform: Schema.optionalKey(PlatformSchema),
    reason: Schema.Literals(["disconnected", "paused", "unsupported"]),
  }
) {}
