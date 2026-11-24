import { Effect, Layer } from "effect";

import { MediaInUse } from "#media/application/media-in-use.ts";
import { MediaUsage } from "#media/application/ports/media-usage.ts";
import type { MediaAssetId } from "#media/domain/media-asset-id.ts";
import { MediaInArticles } from "#publishing/application/media-in-articles.ts";
import { MediaInPosts } from "#publishing/application/media-in-posts.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { PostId, WorkspaceId } from "#shared/domain/ids.ts";

// What releasing an asset came to, inside its transaction: refused while
// articles or posts about to go out show it, or the drafts that let go.
type Release =
  | {
      readonly _tag: "inUse";
      readonly articleIds: readonly string[];
      readonly postIds: readonly PostId[];
    }
  | { readonly _tag: "released"; readonly drafts: readonly PostId[] };

/**
 * Where articles and posts show assets, as the articles' MediaInArticles
 * and publishing's MediaInPosts tell. Releasing an asset asks them in one
 * transaction, articles first: their rows stay locked from then until it
 * ends, so one scheduled meanwhile waits and then finds the file gone,
 * and posts are asked after, as they always were.
 * The database failing is the server's own failure, as for the media
 * context's own tables.
 */
export const HoldersMediaUsage = Layer.effect(
  MediaUsage,
  Effect.gen(function* HoldersMediaUsage() {
    const posts = yield* MediaInPosts;
    const articles = yield* MediaInArticles;
    const { transaction } = yield* TransactionRunner;

    const releasing = Effect.fn("HoldersMediaUsage.release")(
      function* releasing(workspaceId: WorkspaceId, assetId: MediaAssetId) {
        // The articles first, held to the end of the transaction.
        const held = yield* articles.hold(workspaceId, assetId);

        if (held.scheduled.length > 0) {
          const { scheduled } = yield* posts.usage(workspaceId, assetId);

          const inUse: Release = {
            _tag: "inUse",
            articleIds: held.scheduled,
            postIds: scheduled,
          };

          return inUse;
        }

        // Its own transaction joins this one.
        const released = yield* posts.release(workspaceId, assetId);

        // Posts about to go out show it: the articles keep it too.
        if (released._tag === "inUse") {
          const inUse: Release = {
            _tag: "inUse",
            articleIds: [],
            postIds: released.scheduled,
          };

          return inUse;
        }

        yield* held.letGo;

        const done: Release = {
          _tag: "released",
          drafts: released._tag === "released" ? released.drafts : [],
        };

        return done;
      }
    );

    return MediaUsage.of({
      of: (workspaceId, assetId) =>
        Effect.all([
          posts.usage(workspaceId, assetId).pipe(Effect.orDie),
          articles.usage(workspaceId, assetId).pipe(Effect.orDie),
        ]).pipe(
          Effect.map(([{ drafts, scheduled }, shown]) => ({
            draftArticles: shown.drafts,
            drafts,
            scheduled,
            scheduledArticles: shown.scheduled,
          }))
        ),
      // Computed in the transaction, refused after it: an asset in use
      // commits a transaction that wrote nothing, and is refused then.
      release: (workspaceId, assetId) =>
        transaction(releasing(workspaceId, assetId)).pipe(
          Effect.orDie,
          Effect.flatMap((release) =>
            release._tag === "inUse"
              ? Effect.fail(
                  new MediaInUse({
                    articleIds: release.articleIds,
                    assetId,
                    postIds: release.postIds,
                  })
                )
              : Effect.succeed(release.drafts)
          )
        ),
    });
  })
);
