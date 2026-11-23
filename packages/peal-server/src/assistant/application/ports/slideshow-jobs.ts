import { Context } from "effect";
import type { Effect } from "effect";

import type { SlideshowId } from "#assistant/domain/slideshow.ts";

/**
 * Starts the durable job that composes a slide video. Inside a
 * TransactionRunner transaction the start commits, or rolls back, with
 * the job's row, and the job runs after the commit.
 */
export class SlideshowJobs extends Context.Service<
  SlideshowJobs,
  { readonly start: (id: SlideshowId) => Effect.Effect<void> }
>()("peal-server/assistant/application/SlideshowJobs") {}
