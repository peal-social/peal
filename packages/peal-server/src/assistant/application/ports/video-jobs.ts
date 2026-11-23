import { Context } from "effect";
import type { Effect } from "effect";

import type { VideoGenerationId } from "#assistant/domain/video-generation.ts";

/**
 * Starts the durable job that makes a video. Inside a TransactionRunner
 * transaction the start commits, or rolls back, with the job's row, and
 * the job runs after the commit.
 */
export class VideoJobs extends Context.Service<
  VideoJobs,
  { readonly start: (id: VideoGenerationId) => Effect.Effect<void> }
>()("peal-server/assistant/application/VideoJobs") {}
