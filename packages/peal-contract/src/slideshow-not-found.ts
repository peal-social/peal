import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** No slide video of this workspace was asked for with this id. */
export class SlideshowNotFound extends Schema.TaggedError<SlideshowNotFound>()(
  "SlideshowNotFound",
  { ...errorEnvelope },
  {
    description:
      "The workspace asked for no slide video with this id, or it was deleted with its workspace.",
    httpApiStatus: 404,
  }
) {}
