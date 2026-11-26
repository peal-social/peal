import { Schema } from "effect";

import { isWithoutNul } from "./post-text.ts";

/** The longest id of its own a caller gives a post. */
export const maxPostExternalIdLength = 255;

/**
 * The caller's own id for a post: a record of another system, of its
 * choosing, compared exactly. It finds the post again, and makes a creation
 * sent twice make one post: unique in a workspace among posts that are not
 * cancelled. It is the caller's content, never logged nor sent to product
 * analytics, and no copy of the post takes it.
 */
export const PostExternalIdSchema = Schema.String.check(
  Schema.isBetweenLength(1, maxPostExternalIdLength),
  isWithoutNul
).pipe(Schema.brand("PostExternalId"));

export type PostExternalId = typeof PostExternalIdSchema.Type;
