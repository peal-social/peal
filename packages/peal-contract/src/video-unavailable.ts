import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The workspace makes no video: it chose no provider and model for
 * videos (`notSet`), or the key of the one it chose can no longer be read
 * (`keyUnreadable`) and must be typed again.
 */
export class VideoUnavailable extends Schema.TaggedError<VideoUnavailable>()(
  "VideoUnavailable",
  {
    ...errorEnvelope,
    reason: Schema.Literals(["notSet", "keyUnreadable"]),
  },
  {
    description:
      "The workspace makes no video: no provider and model are chosen for videos (`notSet`: `PUT .../assistant/models/video`), or the chosen provider's key can no longer be read (`keyUnreadable`: connect the provider again with its key). Nothing was asked or counted.",
    httpApiStatus: 409,
  }
) {}
