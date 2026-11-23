import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace asked for as many slide videos as a day allows (UTC). */
export class CompositionAllowanceReached extends Schema.TaggedError<CompositionAllowanceReached>()(
  "CompositionAllowanceReached",
  {
    ...errorEnvelope,
    // How many slide videos a workspace may ask for each day.
    dailyLimit: Schema.Int,
    // Midnight UTC, when the day's count starts again.
    resetsAt: Schema.DateTimeUtc,
  },
  {
    description:
      "The workspace asked for `dailyLimit` slide videos today, the most a day allows, whatever each ended with; ask again from `resetsAt`. Nothing was asked.",
    httpApiStatus: 429,
  }
) {}
