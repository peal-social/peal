import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The chosen provider cannot make this video: an aspect, a length or a
 * first frame it does not take, or a first frame that is not a ready
 * image of the workspace's library.
 */
export class VideoRequestRejected extends Schema.TaggedError<VideoRequestRejected>()(
  "VideoRequestRejected",
  {
    ...errorEnvelope,
    reason: Schema.Literals([
      "aspectNotOffered",
      "durationNotOffered",
      "imageNotOffered",
      "imageNotFound",
    ]),
  },
  {
    description:
      "The provider chosen for videos does not make this aspect (`aspectNotOffered`), does not take this length or takes none (`durationNotOffered`), or takes no first frame (`imageNotOffered`); or `imageMediaId` names no ready image of the workspace's library (`imageNotFound`). What each provider takes is `peal-contract/ai-providers`' `video`. Nothing was asked or counted.",
    httpApiStatus: 422,
  }
) {}
