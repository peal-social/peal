import { Schema } from "effect";

import { MessageAbilitySchema } from "#engagement/domain/message-abilities.ts";

/**
 * The channel cannot do this with its messages: the server reads none on
 * its platform, or its account must be connected again to allow it; or,
 * `reason` `windowClosed`, the platform takes no answer to the
 * conversation any more since `closedAt` (Meta's 24 hours).
 */
export class MessageAbilityUnavailable extends Schema.TaggedError<MessageAbilityUnavailable>()(
  "MessageAbilityUnavailable",
  {
    ability: MessageAbilitySchema,
    closedAt: Schema.optionalKey(Schema.DateTimeUtc),
    reason: Schema.optionalKey(Schema.Literals(["windowClosed"])),
    standing: Schema.Literals(["reconnect", "unsupported"]),
  }
) {}
