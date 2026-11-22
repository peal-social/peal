import { Effect, Layer, Option, Schema } from "effect";

import { MediaRejected } from "#agent/application/media-rejected.ts";
import { AttachedFiles } from "#agent/application/ports/attached-files.ts";
import type { AgentMedia } from "#agent/domain/agent-parts.ts";
import { MediaLibrary } from "#media/application/media-library.ts";
import type { Actor } from "#shared/domain/access.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";

const decodeAssetId = Schema.decodeUnknownOption(MediaAssetIdSchema);

/**
 * AttachedFiles through the media context's library, as the person reads
 * it: an id that is not an asset of the workspace, or one they may not
 * read (no `media:read`), is `notFound`; one not ready yet (uploading,
 * being checked, refused) is `notReady`. Each id once, in the order
 * given; a store that fails is the server's failure.
 */
export const LibraryAttachedFilesLive = Layer.effect(
  AttachedFiles,
  Effect.gen(function* LibraryAttachedFiles() {
    const library = yield* MediaLibrary;

    const one = (actor: Actor, mediaId: string) => {
      const notFound = new MediaRejected({ mediaId, reason: "notFound" });

      return Option.match(decodeAssetId(mediaId), {
        onNone: () => Effect.fail(notFound),
        onSome: (assetId) =>
          library.getMedia(actor, assetId).pipe(
            Effect.catchTags({
              MediaAssetNotFound: () => Effect.fail(notFound),
              MediaStorageFailed: Effect.die,
              MissingPermission: () => Effect.fail(notFound),
            }),
            Effect.flatMap(({ asset }) =>
              asset.status._tag === "ready"
                ? Effect.succeed<AgentMedia>({
                    id: asset.id,
                    kind: asset.kind,
                    name: Option.getOrNull(asset.fileName),
                  })
                : Effect.fail(
                    new MediaRejected({ mediaId, reason: "notReady" })
                  )
            )
          ),
      });
    };

    return AttachedFiles.of({
      read: (actor, mediaIds) =>
        Effect.all(
          [...new Set(mediaIds)].map((mediaId) => one(actor, mediaId))
        ).pipe(Effect.withSpan("AttachedFiles.read")),
    });
  })
);
