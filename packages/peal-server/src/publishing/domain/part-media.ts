import { Schema } from "effect";

import { MediaAttachment } from "./media-attachment.ts";
import { maxOverrideMedia } from "./text-override.ts";

/**
 * The most images and videos a part holds: what the largest carousels
 * take. Requests are held to it (the contract's bound), and a platform
 * that states no count of its own is held to it when a post is scheduled.
 */
export const maxMediaPerPost = 20;

const isUniqueBy =
  <A>(key: (item: A) => string) =>
  (items: readonly A[]): boolean =>
    new Set(items.map(key)).size === items.length;

/**
 * The media one part shows, in order: each file once. A part as one
 * channel gets it (`sentTo`) shows its override's media, so the bound
 * here is an override's (`maxOverrideMedia`), and each platform's rules
 * hold it to theirs.
 */
export const PartMediaSchema = Schema.Array(MediaAttachment).check(
  Schema.isMaxLength(maxOverrideMedia),
  Schema.makeFilter(
    isUniqueBy((attachment: MediaAttachment) => attachment.mediaId),
    { expected: "each media attached once" }
  )
);
