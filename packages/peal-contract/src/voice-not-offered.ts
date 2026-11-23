import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * A voice was named for a provider that takes none from Peal: its model
 * speaks with its own.
 */
export class VoiceNotOffered extends Schema.TaggedError<VoiceNotOffered>()(
  "VoiceNotOffered",
  { ...errorEnvelope },
  {
    description:
      "A `voice` was named, but the provider chosen for voice-overs takes none (`voices` null in its `speech` offer of `peal-contract/ai-providers`): leave it out. Nothing was asked or counted.",
    httpApiStatus: 422,
  }
) {}
