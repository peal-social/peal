import { Effect, Layer, Option, Stream } from "effect";

import { GeneratedVideos } from "#assistant/application/ports/generated-videos.ts";
import type { FirstFrame } from "#assistant/application/ports/own-video-model.ts";
import { VideoFailed } from "#assistant/application/video-failed.ts";
import { maxImageBytes } from "#assistant/domain/image-limits.ts";
import { maxVideoBytes } from "#assistant/domain/video-limits.ts";
import { GeneratedMedia } from "#media/application/generated-media.ts";
import { MediaForPlatforms } from "#media/application/media-for-platforms.ts";
import type { PlatformMedia } from "#media/application/media-for-platforms.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";

const failed = (reason: VideoFailed["reason"]) =>
  Effect.fail(new VideoFailed({ reason }));

// The chunks as one array of bytes.
const joined = (chunks: readonly Uint8Array[]): Uint8Array => {
  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  );

  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

/**
 * GeneratedVideos in the media context's library: a video arrives there as
 * an image the assistant made does (`GeneratedMedia.storeVideo`), and a
 * first frame is read as publishing reads a post's media
 * (`MediaForPlatforms`): a ready image of the workspace, at most an
 * image's largest size. The composition root provides both.
 */
export const LibraryGeneratedVideosLive = Layer.effect(
  GeneratedVideos,
  Effect.gen(function* LibraryGeneratedVideosLive() {
    const generated = yield* GeneratedMedia;
    const media = yield* MediaForPlatforms;

    const readyImage = (workspaceId: WorkspaceId, assetId: MediaAssetId) =>
      media.describe(workspaceId, assetId).pipe(
        Effect.map((described): Option.Option<PlatformMedia> =>
          described.kind === "image" ? Option.some(described) : Option.none()
        ),
        Effect.catchTag("MediaNotPublishable", () =>
          Effect.succeed(Option.none<PlatformMedia>())
        )
      );

    const firstFrame = Effect.fn("GeneratedVideos.firstFrame")(
      function* firstFrame(workspaceId: WorkspaceId, assetId: MediaAssetId) {
        const image = yield* readyImage(workspaceId, assetId);

        if (Option.isNone(image)) {
          return Option.none<FirstFrame>();
        }

        const chunks = yield* media.read(workspaceId, assetId).pipe(
          Stream.runCollect,
          Effect.map(Option.some),
          // Why, for whoever runs the server: the failure names the
          // store, never the image.
          Effect.catchTag("MediaStorageFailed", (failure) =>
            Effect.logWarning("The media store failed", failure).pipe(
              Effect.as(Option.none<readonly Uint8Array[]>())
            )
          ),
          Effect.catchTag("MediaNotPublishable", () =>
            Effect.succeed(Option.none<readonly Uint8Array[]>())
          )
        );

        return chunks.pipe(
          Option.map(joined),
          Option.filter((bytes) => bytes.byteLength <= maxImageBytes),
          Option.map((bytes): FirstFrame => ({
            bytes,
            mediaType: image.value.contentType,
          }))
        );
      }
    );

    return GeneratedVideos.of({
      firstFrame,
      isImage: (workspaceId, assetId) =>
        readyImage(workspaceId, assetId).pipe(Effect.map(Option.isSome)),
      roomFor: (workspaceId) =>
        generated.roomForVideo(workspaceId, maxVideoBytes),
      store: (workspaceId, bytes) =>
        generated.storeVideo(workspaceId, bytes).pipe(
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
