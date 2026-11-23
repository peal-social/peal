import { Context } from "effect";
import type { Effect } from "effect";

import type { Slideshow } from "#assistant/domain/slideshow.ts";

/**
 * Tells the member who asked for a slide video that it ended, in the app,
 * once a job: in the caller's transaction. A job a key asked for tells
 * nobody.
 */
export class SlideshowNotices extends Context.Service<
  SlideshowNotices,
  { readonly ended: (slideshow: Slideshow) => Effect.Effect<void> }
>()("peal-server/assistant/application/SlideshowNotices") {}
