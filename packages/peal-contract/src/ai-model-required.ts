import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * A model is needed and none was sent: testing a provider Peal knows no
 * model of, or choosing one for a use that takes one.
 */
export class AiModelRequired extends Schema.TaggedError<AiModelRequired>()(
  "AiModelRequired",
  { ...errorEnvelope },
  {
    description:
      "No `model` was sent and Peal knows none to use: to test a provider whose model the workspace's text is not written with and that Peal suggests none for, or to choose a provider for a use that takes a model (every use but `composition`). Send `model` in the same request. Nothing was sent or saved.",
    httpApiStatus: 422,
  }
) {}
