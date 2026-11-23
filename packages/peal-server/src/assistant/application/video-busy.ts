import { Schema } from "effect";

import { VideoGenerationIdSchema } from "#assistant/domain/video-generation.ts";

/** The workspace has a video on the way already: one at a time. */
export class VideoBusy extends Schema.TaggedError<VideoBusy>()("VideoBusy", {
  generationId: VideoGenerationIdSchema,
}) {}
