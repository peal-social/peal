import { Schema } from "effect";

/**
 * The provider chosen for videos cannot make this one: an aspect, a
 * length or a first frame it does not take, or a first frame that is no
 * ready image of the workspace.
 */
export class VideoRejected extends Schema.TaggedError<VideoRejected>()(
  "VideoRejected",
  {
    reason: Schema.Literals([
      "aspectNotOffered",
      "durationNotOffered",
      "imageNotOffered",
      "imageNotFound",
    ]),
  }
) {}
