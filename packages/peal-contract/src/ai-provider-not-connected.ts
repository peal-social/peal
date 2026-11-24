import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace has not connected the provider the request names. */
export class AiProviderNotConnected extends Schema.TaggedError<AiProviderNotConnected>()(
  "AiProviderNotConnected",
  { ...errorEnvelope },
  {
    description:
      "The workspace has not connected this provider: connect it first (`PUT /api/v1/assistant/providers/{provider}`). Nothing was changed.",
    httpApiStatus: 404,
  }
) {}
