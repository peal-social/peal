import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace asked for as many videos as a day allows (UTC). */
export class VideoAllowanceReached extends Schema.TaggedError<VideoAllowanceReached>()(
  "VideoAllowanceReached",
  {
    ...errorEnvelope,
    // How many videos a workspace may ask for each day.
    dailyLimit: Schema.Int,
    // Midnight UTC, when the day's count starts again.
    resetsAt: Schema.DateTimeUtc,
  },
  {
    description:
      "The workspace asked for `dailyLimit` videos today, the most a day allows, whatever each ended with; ask again from `resetsAt`. Nothing was asked.",
    httpApiStatus: 429,
  }
) {}
