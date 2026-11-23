import { Effect, Layer, Option } from "effect";

import { SlideshowMedia } from "#assistant/application/ports/slideshow-media.ts";
import type { SlideshowSource } from "#assistant/application/ports/slideshow-media.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import { maxSlideshowBytes } from "#assistant/domain/slideshow-limits.ts";
import { GeneratedMedia } from "#media/application/generated-media.ts";

const failed = (reason: SlideshowFailed["reason"]) =>
  Effect.fail(new SlideshowFailed({ reason }));

/**
 * SlideshowMedia in the media context's library (`GeneratedMedia`): a
 * ready file described, a presigned GET of it for the service, the room
 * for the largest video, and the video kept as it came, not marked as made
 * by AI. The composition root provides it.
 */
export const LibrarySlideshowMediaLive = Layer.effect(
  SlideshowMedia,
  Effect.gen(function* LibrarySlideshowMediaLive() {
    const generated = yield* GeneratedMedia;

    return SlideshowMedia.of({
      describe: (workspaceId, assetId) =>
        generated.describeSource(workspaceId, assetId).pipe(
          Effect.map(
            Option.map((file): SlideshowSource => ({
              contentType: file.contentType,
              durationSeconds: file.durationSeconds,
              kind: file.kind,
            }))
          )
        ),
      linkTo: (workspaceId, assetId, expiresIn) =>
        generated.sourceLink(workspaceId, assetId, expiresIn).pipe(
          // Why, for whoever runs the server: the failure names the store,
          // never the file or its link.
          Effect.catchTag("MediaStorageFailed", (failure) =>
            Effect.logWarning("The media store failed", failure).pipe(
              Effect.as(Option.none<string>())
            )
          )
        ),
      roomFor: (workspaceId) =>
        generated.roomForVideo(workspaceId, maxSlideshowBytes),
      store: (workspaceId, bytes) =>
        generated.storeVideo(workspaceId, bytes, { aiGenerated: false }).pipe(
          Effect.map((item) => item.asset.id),
          Effect.catchTags({
            GeneratedVideoUnusable: () => failed("unusableAnswer"),
            MediaStorageFailed: (failure) =>
              Effect.logWarning("The media store failed", failure).pipe(
                Effect.andThen(failed("notStored"))
              ),
            PlanLimitReached: () => failed("storageFull"),
          })
        ),
    });
  })
);
