import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The provider named does not offer that use. */
export class AiCapabilityNotOffered extends Schema.TaggedError<AiCapabilityNotOffered>()(
  "AiCapabilityNotOffered",
  { ...errorEnvelope },
  {
    description:
      "The provider does not offer this use, as Peal's catalogue of providers lists them (`peal-contract/ai-providers`): images, for one, come from OpenAI, Google Gemini, xAI, Together AI, fal or an endpoint of the OpenAI images API only, and ElevenLabs and fal write no text. Nothing was changed.",
    httpApiStatus: 422,
  }
) {}
