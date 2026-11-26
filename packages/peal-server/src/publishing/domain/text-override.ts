import { Schema } from "effect";

import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { ArticleBodySchema } from "#shared/domain/rich-text/rich-body.ts";

import { MediaAttachment } from "./media-attachment.ts";
import { PostTextSchema } from "./post-text.ts";

/**
 * The most images and videos an override gives its channel: a website's
 * body may show many more than a part does (`maxMediaPerPost`); every
 * other platform's own `maxMedia` still refuses more when the post is
 * scheduled.
 */
export const maxOverrideMedia = 100;

const isUniqueBy =
  <A>(key: (item: A) => string) =>
  (items: readonly A[]): boolean =>
    new Set(items.map(key)).size === items.length;

/** The media an override gives its channel, in order: each file once. */
export const OverrideMediaSchema = Schema.Array(MediaAttachment).check(
  Schema.isMaxLength(maxOverrideMedia),
  Schema.makeFilter(
    isUniqueBy((attachment: MediaAttachment) => attachment.mediaId),
    { expected: "each media attached once" }
  )
);

/**
 * What a part of a post has on one of its channels instead of its own:
 * its text there, and, when `media` is given, the images and videos it
 * shows there instead of its own, in order (none at all when empty).
 * Left out, the channel shows the part's own media.
 *
 * With `body`, the channel's own text is a rich text (a website's): its
 * `text` is the body's plain text and its `media` the body's images,
 * which `richOverride` writes, so every reader of a channel's text reads
 * the body's. Its text may be empty only beside a body (a body of images
 * alone). `body` and `media` are written only when given, so the rows,
 * subjects and digests of posts without stay as they were.
 */
export class TextOverride extends Schema.Class<TextOverride>(
  "peal-server/publishing/domain/TextOverride"
)(
  Schema.Struct({
    body: Schema.optionalKey(ArticleBodySchema),
    channelId: ChannelIdSchema,
    media: Schema.optionalKey(OverrideMediaSchema),
    text: PostTextSchema,
  }).check(
    Schema.makeFilter(({ body, text }) => body !== undefined || text !== "", {
      expected: "a text, unless a body is given",
    })
  )
) {}

/**
 * The override with another text or other media, what it does not change
 * kept: its media stay given only when they were, or are now, and its body
 * when it has one.
 */
export const changedOverride = (
  override: TextOverride,
  change: {
    readonly media?: readonly MediaAttachment[];
    readonly text?: string;
  }
): TextOverride => {
  const media = change.media ?? override.media;
  const text = change.text ?? override.text;
  const { body, channelId } = override;

  if (body === undefined) {
    return new TextOverride(
      media === undefined ? { channelId, text } : { channelId, media, text }
    );
  }

  return new TextOverride(
    media === undefined
      ? { body, channelId, text }
      : { body, channelId, media, text }
  );
};
