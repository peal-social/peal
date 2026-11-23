import { Effect, Option, Stream } from "effect";

import { GeneratedVideoUnusable } from "#media/application/generated-video-unusable.ts";
import {
  keepArriving,
  roomIn,
  storeArriving,
} from "#media/application/use-cases/arrived-file.ts";
import { deleteMedia } from "#media/application/use-cases/delete-media.ts";
import { MediaAssetIdSchema } from "#media/domain/media-asset-id.ts";
import { kindOf } from "#media/domain/media-format.ts";
import { newId } from "#shared/application/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * Whether the workspace's storage has room for `largest` bytes: asked
 * before a video is made, so a full plan spends nothing
 * (`PlanLimitReached` `mediaStorage`).
 */
export const roomForVideo = Effect.fn("Media.roomForVideo")(
  function* roomForVideo(workspaceId: WorkspaceId, largest: number) {
    yield* roomIn(workspaceId, largest);
  }
);

/**
 * Stores a video the assistant made as media of the workspace, marked as
 * made by AI unless `aiGenerated` is false (a slide video, composed of the
 * workspace's own files), with no description: as `storeGenerated` does an image,
 * through the import's second half, the bytes as they came. Bytes that
 * are not a video the library takes, or that the probe cannot make
 * `ready`, leave nothing behind and fail with `GeneratedVideoUnusable`.
 */
export const storeGeneratedVideo = Effect.fn("Media.storeGeneratedVideo")(
  function* storeGeneratedVideo(
    workspaceId: WorkspaceId,
    bytes: Uint8Array,
    { aiGenerated = true }: { readonly aiGenerated?: boolean } = {}
  ) {
    const room = yield* roomIn(workspaceId, 1);
    const id = yield* newId(MediaAssetIdSchema);

    const item = yield* keepArriving(
      { aiGenerated, altText: Option.none(), id, room, workspaceId },
      storeArriving(
        {
          declaredSize: Option.some(bytes.byteLength),
          declaredType: Option.none(),
          rest: Stream.empty,
          start: bytes,
        },
        {
          accepts: (contentType) => kindOf(contentType) === "video",
          id,
          room,
          workspaceId,
        }
        // A file the assistant made was never called anything.
      ).pipe(Effect.map((stored) => ({ fileName: Option.none(), stored })))
    ).pipe(
      Effect.catchTags({
        MediaTooLarge: () => Effect.fail(new GeneratedVideoUnusable()),
        UnsupportedMediaType: () => Effect.fail(new GeneratedVideoUnusable()),
        UploadRejected: () => Effect.fail(new GeneratedVideoUnusable()),
      })
    );

    // A video the probe could not read is no use to anyone.
    if (item.asset.status._tag !== "ready") {
      yield* deleteMedia({ assetId: id, workspaceId });

      return yield* new GeneratedVideoUnusable();
    }

    return item;
  }
);
