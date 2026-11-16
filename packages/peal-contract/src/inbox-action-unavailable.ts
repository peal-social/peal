import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why an inbox action is unavailable, where the standing does not say it
 * all: `windowClosed`, a direct message past the time its platform takes
 * an answer.
 */
export const InboxActionUnavailableReasonSchema = Schema.Literal(
  "windowClosed"
).annotate({ identifier: "InboxActionUnavailableReason" });

export type InboxActionUnavailableReason =
  typeof InboxActionUnavailableReasonSchema.Type;

/** The channel cannot do this: its platform does not offer it to the account (`unsupported`), or the account must be connected again to allow it (`reconnect`). Nothing was asked of the platform. */
export class InboxActionUnavailable extends Schema.TaggedError<InboxActionUnavailable>()(
  "InboxActionUnavailable",
  {
    ...errorEnvelope,
    // read, reply, withdraw, like, hide or delete.
    ability: Schema.String,
    // When the platform's answer window shut (`reason` `windowClosed`):
    // present only then.
    closedAt: Schema.optionalKey(Schema.DateTimeUtc),
    // Why, when the standing does not say it all: `windowClosed`, a
    // direct message past the time the platform takes an answer (24 hours
    // after the person's last message on Messenger and Instagram).
    reason: Schema.optionalKey(InboxActionUnavailableReasonSchema),
    standing: Schema.Literals(["reconnect", "unsupported"]),
  },
  {
    description:
      "The channel cannot do this: its platform does not offer it to the account (`unsupported`), or the account must be connected again to allow it (`reconnect`). Nothing was asked of the platform. A direct message past the time its platform takes an answer is `unsupported` with `reason` `windowClosed` and `closedAt`, when the window shut.",
    httpApiStatus: 409,
  }
) {}
