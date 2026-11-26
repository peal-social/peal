import { Schema } from "effect";

import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";

/**
 * A post a website already holds for a target before the target went
 * out (`./site-hold.ts`): its id there, its address once the site gave
 * one, and, while the site holds it to publish itself, when (`publishAt`).
 * Without `publishAt` the site keeps it as a draft Peal took back, which
 * the next hand-over, or the post at its time, changes rather than make a
 * second.
 *
 * Kept in `publishing.post_targets` (`platform_post_id`, `permalink` and
 * `site_publish_at` on a row that is not published).
 */
export const SitePostSchema = Schema.Struct({
  permalink: Schema.optionalKey(Schema.String),
  platformPostId: PlatformPostIdSchema,
  publishAt: Schema.optionalKey(Schema.DateTimeUtc),
});

export type SitePost = typeof SitePostSchema.Type;
