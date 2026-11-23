import { Context } from "effect";
import type { Effect } from "effect";

import type { VideoGeneration } from "#assistant/domain/video-generation.ts";

/**
 * Tells the member who asked for a video that it ended, in the app, once
 * a job: in the caller's transaction. A job a key asked for tells nobody.
 */
export class VideoNotices extends Context.Service<
  VideoNotices,
  { readonly ended: (generation: VideoGeneration) => Effect.Effect<void> }
>()("peal-server/assistant/application/VideoNotices") {}
