import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The workspace makes no voice-over (`speech`) or no transcript
 * (`transcription`): it chose no provider and model for it (`notSet`),
 * or the key of the one it chose can no longer be read (`keyUnreadable`)
 * and must be typed again.
 */
export class AudioUnavailable extends Schema.TaggedError<AudioUnavailable>()(
  "AudioUnavailable",
  {
    ...errorEnvelope,
    capability: Schema.Literals(["speech", "transcription"]),
    reason: Schema.Literals(["notSet", "keyUnreadable"]),
  },
  {
    description:
      "The workspace makes no voice-over (`capability` `speech`) or no transcript (`transcription`): no provider and model are chosen for it (`notSet`: `PUT .../assistant/models/{capability}`), or the chosen provider's key can no longer be read (`keyUnreadable`: connect the provider again with its key). Nothing was asked or counted.",
    httpApiStatus: 409,
  }
) {}
