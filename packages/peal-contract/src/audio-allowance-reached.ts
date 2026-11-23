import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The workspace asked for as many voice-overs (`speech`) or transcripts
 * (`transcription`) as a day allows (UTC).
 */
export class AudioAllowanceReached extends Schema.TaggedError<AudioAllowanceReached>()(
  "AudioAllowanceReached",
  {
    ...errorEnvelope,
    capability: Schema.Literals(["speech", "transcription"]),
    // How many a workspace may ask for each day.
    dailyLimit: Schema.Int,
    // Midnight UTC, when the day's count starts again.
    resetsAt: Schema.DateTimeUtc,
  },
  {
    description:
      "The workspace asked for `dailyLimit` voice-overs (`capability` `speech`) or transcripts (`transcription`) today, the most a day allows, whatever each ended with; ask again from `resetsAt`. Nothing was asked.",
    httpApiStatus: 429,
  }
) {}
