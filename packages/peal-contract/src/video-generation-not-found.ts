import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** No video of this workspace was asked for with this id. */
export class VideoGenerationNotFound extends Schema.TaggedError<VideoGenerationNotFound>()(
  "VideoGenerationNotFound",
  { ...errorEnvelope },
  {
    description:
      "The workspace asked for no video with this id, or it was deleted with its workspace.",
    httpApiStatus: 404,
  }
) {}
