import { Effect, Layer } from "effect";

import { MediaInArticles } from "#articles/application/media-in-articles.ts";
import { MediaInUse } from "#media/application/media-in-use.ts";
import { MediaUsage } from "#media/application/ports/media-usage.ts";
import type { MediaAssetId } from "#media/domain/media-asset-id.ts";
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
 * transaction, posts first, then articles, the order every transaction
 * that locks both takes (erasing a workspace locks its posts, then its
 * articles), so neither waits for the other forever. The drafts and the
 * articles that show it stay locked until the transaction ends, so one
 * scheduled meanwhile waits and then finds the file gone; the posts that
 * go out with it are read, not locked, and read again once the articles
 * are held, as waiting for them gives time to schedule one. Nothing
 * changes until both have said they let it go.
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
        // The posts first, then the articles, held to the end of the
        // transaction.
        const heldPosts = yield* posts.hold(workspaceId, assetId);
        const heldArticles = yield* articles.hold(workspaceId, assetId);

        // A post scheduled with it while the articles were waited for,
        // which the posts' hold could not see.
        const { scheduled: since } = yield* posts.usage(workspaceId, assetId);

        const postIds = [
          ...heldPosts.scheduled,
          ...since.filter((postId) => !heldPosts.scheduled.includes(postId)),
        ];

        // Articles or posts about to go out show it: the others keep it
        // too.
        if (postIds.length > 0 || heldArticles.scheduled.length > 0) {
          const inUse: Release = {
            _tag: "inUse",
            articleIds: heldArticles.scheduled,
            postIds,
          };

          return inUse;
        }

        const released = yield* heldPosts.letGo;

        yield* heldArticles.letGo;

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
