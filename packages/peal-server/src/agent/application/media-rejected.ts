import { Schema } from "effect";

/**
 * A file attached to a message cannot be used: not one of the workspace's
 * media the person may read (`notFound`), or not ready yet (`notReady`).
 */
export class MediaRejected extends Schema.TaggedError<MediaRejected>()(
  "MediaRejected",
  {
    mediaId: Schema.String,
    reason: Schema.Literals(["notFound", "notReady"]),
  }
) {}
