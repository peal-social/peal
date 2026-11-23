import { Schema } from "effect";

import { VideoFailureReasonSchema } from "#assistant/domain/video-generation.ts";

/**
 * No video came of a job, for `reason` alone: it carries no cause, as the
 * provider's error holds the request's body, with the prompt, and the
 * provider's words.
 */
export class VideoFailed extends Schema.TaggedError<VideoFailed>()(
  "VideoFailed",
  { reason: VideoFailureReasonSchema }
) {}
