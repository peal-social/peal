import { Effect, Layer } from "effect";

import { ArticleMedia } from "#publishing/application/article-media.ts";
import { AttachableMedia } from "#publishing/application/attachable-media.ts";

/**
 * The files articles may show: those publishing's AttachableMedia finds
 * ready in the library for the actor, by their id and type alone.
 */
export const LibraryArticleMedia = Layer.effect(
  ArticleMedia,
  Effect.gen(function* LibraryArticleMedia() {
    const media = yield* AttachableMedia;

    return ArticleMedia.of({
      lookUp: (actor, mediaIds) =>
        media.lookUp(actor, mediaIds).pipe(
          Effect.map((files) =>
            files.map(({ contentType, mediaId }) => ({
              contentType,
              mediaId,
            }))
          )
        ),
    });
  })
);
