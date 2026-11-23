import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace has a video on the way already: one is made at a time. */
export class VideoBusy extends Schema.TaggedError<VideoBusy>()(
  "VideoBusy",
  {
    ...errorEnvelope,
    // The video on the way, to follow with `GET .../media/videos/generations/{id}`.
    generationId: Schema.String,
  },
  {
    description:
      "The workspace already has a video queued or being made (`generationId`): one is made at a time. Nothing was asked or counted; ask again once it has ended.",
    httpApiStatus: 429,
  }
) {}
