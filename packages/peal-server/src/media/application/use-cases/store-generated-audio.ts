import { Effect, Option, Stream } from "effect";

import { GeneratedAudioUnusable } from "#media/application/generated-audio-unusable.ts";
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
 * before a voice-over is made, so a full plan spends nothing
 * (`PlanLimitReached` `mediaStorage`).
 */
export const roomForAudio = Effect.fn("Media.roomForAudio")(
  function* roomForAudio(workspaceId: WorkspaceId, largest: number) {
    yield* roomIn(workspaceId, largest);
  }
);

/**
 * Stores a voice-over the assistant made as media of the workspace,
 * marked as made by AI, with no description: as `storeGenerated` does an
 * image, through the import's second half, the bytes as they came. Bytes
 * that are not an audio file the library takes, or that the probe cannot
 * make `ready`, leave nothing behind and fail with
 * `GeneratedAudioUnusable`.
 */
export const storeGeneratedAudio = Effect.fn("Media.storeGeneratedAudio")(
  function* storeGeneratedAudio(workspaceId: WorkspaceId, bytes: Uint8Array) {
    const room = yield* roomIn(workspaceId, 1);
    const id = yield* newId(MediaAssetIdSchema);

    const item = yield* keepArriving(
      { aiGenerated: true, altText: Option.none(), id, room, workspaceId },
      storeArriving(
        {
          declaredSize: Option.some(bytes.byteLength),
          declaredType: Option.none(),
          rest: Stream.empty,
          start: bytes,
        },
        {
          accepts: (contentType) => kindOf(contentType) === "audio",
          id,
          room,
          workspaceId,
        }
        // A file the assistant made was never called anything.
      ).pipe(Effect.map((stored) => ({ fileName: Option.none(), stored })))
    ).pipe(
      Effect.catchTags({
        MediaTooLarge: () => Effect.fail(new GeneratedAudioUnusable()),
        UnsupportedMediaType: () => Effect.fail(new GeneratedAudioUnusable()),
        UploadRejected: () => Effect.fail(new GeneratedAudioUnusable()),
      })
    );

    // A file the probe could not read is no use to anyone.
    if (item.asset.status._tag !== "ready") {
      yield* deleteMedia({ assetId: id, workspaceId });

      return yield* new GeneratedAudioUnusable();
    }

    return item;
  }
);
