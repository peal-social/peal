import { Schema } from "effect";

/**
 * How far a call to a website got, on its journal row
 * (`publication_calls.progress`): `committing`, recorded and committed
 * just before the one request that makes the post, with when. A row
 * without it never reached that request, so its article is sent anew; one
 * with it may have made the post, which is looked for on the site from
 * `at` less a minute, never made again. Persisted contract: add members,
 * never rename one.
 */
export const SiteProgressSchema = Schema.Union([
  Schema.TaggedStruct("committing", { at: Schema.DateTimeUtc }),
]);

export type SiteProgress = typeof SiteProgressSchema.Type;
