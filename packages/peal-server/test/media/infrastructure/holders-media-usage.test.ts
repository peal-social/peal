// Deleting a file of the library asks the articles, then the posts, in one
// transaction: the articles' rows are locked before posts are asked, and
// stay locked until the transaction ends, so an article scheduled
// meanwhile waits, then finds the file gone from it.
import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Schema,
} from "effect";
import { SqlClient } from "effect/sql";

import { MediaUsage } from "#media/application/ports/media-usage.ts";
import { HoldersMediaUsage } from "#media/infrastructure/holders-media-usage.ts";
import { Articles } from "#publishing/application/articles.ts";
import { MediaInArticles } from "#publishing/application/media-in-articles.ts";
import { MediaInPosts } from "#publishing/application/media-in-posts.ts";
import { DrizzleArticleStore } from "#publishing/infrastructure/drizzle-article-store.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { coverImage, siteChannel } from "#test/publishing/article-server.ts";
import {
  content,
  onArticles,
  writer,
} from "#test/publishing/article-support.ts";

// What Postgres answers a lock it could not take at once.
const PostgresErrorSchema = Schema.Struct({ code: Schema.String });

// The library's question as the server asks it, with posts that, once
// asked to let the file go, say so (`reached`) and wait for `letGo`.
const holdersPausedAtPosts = (
  reached: Deferred.Deferred<true>,
  letGo: Deferred.Deferred<true>
) =>
  HoldersMediaUsage.pipe(
    Layer.provide(
      Layer.merge(
        Layer.effect(
          MediaInPosts,
          Effect.gen(function* PausedMediaInPosts() {
            const posts = yield* MediaInPosts;

            return MediaInPosts.of({
              release: (workspaceId, mediaId) =>
                Deferred.succeed(reached, true).pipe(
                  Effect.andThen(Deferred.await(letGo)),
                  Effect.andThen(posts.release(workspaceId, mediaId))
                ),
              usage: posts.usage,
            });
          })
        ).pipe(
          Layer.provide(
            MediaInPosts.layer.pipe(Layer.provide(DrizzlePostRepository))
          )
        ),
        MediaInArticles.layer.pipe(Layer.provide(DrizzleArticleStore))
      )
    )
  );

describe("deleting a file an article shows", () => {
  it.effect(
    "locks the article before posts are asked, until the transaction ends",
    () =>
      onArticles(
        Effect.gen(function* lockOrder() {
          const site = yield* fakeWordPress();
          const workspaceId = yield* freshWorkspace;
          const channel = yield* siteChannel(workspaceId, site);
          const articles = yield* Articles;
          const actor = writer(workspaceId);
          const cover = coverImage.media.mediaId;
          const sql = yield* SqlClient.SqlClient;

          const draft = yield* articles.create(
            actor,
            { channelId: channel.id, content: content() },
            Option.none()
          );

          const reached = yield* Deferred.make<true>();
          const letGo = yield* Deferred.make<true>();

          const usage = yield* MediaUsage.pipe(
            Effect.provide(holdersPausedAtPosts(reached, letGo))
          );

          const releasing = yield* usage
            .release(workspaceId, cover)
            .pipe(Effect.forkChild);

          yield* Deferred.await(reached);

          // From this fiber, so on another connection of the pool.
          const lock = sql`SELECT 1 FROM publishing.articles
            WHERE id = ${draft.id} FOR UPDATE NOWAIT`;

          const whileHeld = yield* Effect.exit(lock);

          yield* Deferred.succeed(letGo, true);

          const released = yield* Fiber.join(releasing);

          assert(Exit.isFailure(whileHeld));

          const refused = Cause.findErrorOption(whileHeld.cause);

          assert(Option.isSome(refused));

          const { code } = Schema.decodeUnknownSync(PostgresErrorSchema)(
            refused.value.reason.cause
          );

          assert.strictEqual(refused.value.reason._tag, "LockTimeoutError");
          assert.strictEqual(code, "55P03");
          assert.deepStrictEqual(released, []);

          yield* lock;

          const after = yield* articles.get(actor, draft.id);

          assert.isTrue(Option.isNone(after.content.coverMediaId));
        })
      )
  );
});
