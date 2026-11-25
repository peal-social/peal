// Deleting a file of the library asks the posts, then the articles, in one
// transaction, the order erasing a workspace locks them in: the posts'
// rows are locked before articles are asked, and both stay locked until
// the transaction ends, so a post or an article scheduled meanwhile
// waits, then finds the file gone from it, and a workspace erased
// meanwhile waits for the deletion instead of deadlocking with it.
import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Ref,
  Schema,
} from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql";
import { TestClock } from "effect/testing";

import { ActivityRecords } from "#activity/application/activity-records.ts";
import { AdRecords } from "#ads/application/ad-records.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { AnalyticsRecords } from "#analytics/application/analytics-records.ts";
import { ArticleRecords } from "#articles/application/article-records.ts";
import { Articles } from "#articles/application/articles.ts";
import { MediaInArticles } from "#articles/application/media-in-articles.ts";
import { DrizzleArticleStore } from "#articles/infrastructure/drizzle-article-store.ts";
import { UsageRecords } from "#assistant/application/ports/usage-records.ts";
import { BillingRecords } from "#billing/application/billing-records.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { LegalRecords } from "#legal/application/legal-records.ts";
import { MediaRecords } from "#media/application/media-records.ts";
import { MediaUsage } from "#media/application/ports/media-usage.ts";
import { HoldersMediaUsage } from "#media/infrastructure/holders-media-usage.ts";
import { NoticeRecords } from "#notifications/application/notice-records.ts";
import { MediaInPosts } from "#publishing/application/media-in-posts.ts";
import { PostRecords } from "#publishing/application/post-records.ts";
import { PostRepository } from "#publishing/application/post-repository.ts";
import { PublicationScheduler } from "#publishing/application/publication-scheduler.ts";
import { createDraft } from "#publishing/domain/post.ts";
import { DrizzleLivePostChangeStore } from "#publishing/infrastructure/drizzle-live-post-change-store.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { DrizzleWorkspacePostStore } from "#publishing/infrastructure/drizzle-workspace-post-store.ts";
import { WorkflowLivePostJobs } from "#publishing/infrastructure/workflow-live-post-jobs.ts";
import { ReviewRecords } from "#review/application/review-records.ts";
import { newId } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";
import { ShortLinkRecords } from "#shortlinks/application/short-link-records.ts";
import { StaffRecords } from "#staff/application/staff-records.ts";
import { coverImage, siteChannel } from "#test/articles/article-server.ts";
import { content, onArticles, writer } from "#test/articles/article-support.ts";
import { PlainPseudonymsTest } from "#test/billing/support.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { contentOf } from "#test/publishing/support.ts";
import { WebhookRecords } from "#webhooks/application/webhook-records.ts";
import { ContextRecords } from "#workspace/application/context-records.ts";
import { ContextRecordsLive } from "#workspace/infrastructure/context-records.ts";

// What Postgres answers a lock it could not take at once.
const PostgresErrorSchema = Schema.Struct({ code: Schema.String });

// A gate a transaction stops at once it holds some locks: it says so with
// its connection's backend (`reached`) and waits for `open`.
interface Gate {
  readonly open: Deferred.Deferred<true>;
  readonly reached: Deferred.Deferred<number>;
}

const gate = Effect.all({
  open: Deferred.make<true>(),
  reached: Deferred.make<number>(),
});

const BackendSchema = Schema.Struct({ pid: Schema.Number });

// Stops at the gate, on the transaction's own connection.
const stopAt = ({ open, reached }: Gate) =>
  Effect.gen(function* stopping() {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql`SELECT pg_backend_pid() AS pid`;
    const { pid } = Schema.decodeUnknownSync(BackendSchema)(row);

    yield* Deferred.succeed(reached, pid);
    yield* Deferred.await(open);
  }).pipe(Effect.orDie);

// The library's question as the server asks it, stopped at `first` once
// its first hold returns, whichever context it asked, and at `second` once
// the other does: the gates follow the order it asks in.
const holdersStoppedAt = (first: Gate, second: Gate) =>
  Layer.unwrap(
    Effect.gen(function* stoppedHolders() {
      const sql = yield* SqlClient.SqlClient;
      const holds = yield* Ref.make(0);

      // The gate of this hold, by the holds before it.
      const stop = Ref.getAndUpdate(holds, (count) => count + 1).pipe(
        Effect.flatMap((before) => stopAt(before === 0 ? first : second)),
        Effect.provideService(SqlClient.SqlClient, sql)
      );

      return HoldersMediaUsage.pipe(
        Layer.provide(
          Layer.merge(
            Layer.effect(
              MediaInPosts,
              Effect.gen(function* StoppedMediaInPosts() {
                const posts = yield* MediaInPosts;

                return MediaInPosts.of({
                  ...posts,
                  hold: (workspaceId, mediaId) =>
                    posts
                      .hold(workspaceId, mediaId)
                      .pipe(Effect.tap(() => stop)),
                });
              })
            ).pipe(
              Layer.provide(
                MediaInPosts.layer.pipe(Layer.provide(DrizzlePostRepository))
              )
            ),
            Layer.effect(
              MediaInArticles,
              Effect.gen(function* StoppedMediaInArticles() {
                const articles = yield* MediaInArticles;

                return MediaInArticles.of({
                  ...articles,
                  hold: (workspaceId, mediaId) =>
                    articles
                      .hold(workspaceId, mediaId)
                      .pipe(Effect.tap(() => stop)),
                });
              })
            ).pipe(
              Layer.provide(
                MediaInArticles.layer.pipe(Layer.provide(DrizzleArticleStore))
              )
            )
          )
        )
      );
    })
  );

// A draft article and a draft post of the workspace, both showing the
// cover.
const showingTheCover = Effect.gen(function* showingTheCover() {
  const site = yield* fakeWordPress();
  const workspaceId = yield* freshWorkspace;
  const channel = yield* siteChannel(workspaceId, site);
  const articles = yield* Articles;
  const actor = writer(workspaceId);

  const article = yield* articles.create(
    actor,
    { channelId: channel.id, content: content() },
    Option.none()
  );

  const postId = yield* newId(PostIdSchema);

  yield* PostRepository.use((posts) =>
    posts.insert(
      createDraft(
        postId,
        workspaceId,
        contentOf("A synthetic post showing the cover", {
          media: [coverImage.media.mediaId],
        }),
        Option.none()
      ),
      []
    )
  ).pipe(Effect.provide(DrizzlePostRepository));

  return { actor, articleId: article.id, postId, workspaceId };
});

// What a lock from another connection met: `free`, or how Postgres
// refused it (`LockTimeoutError 55P03` while a transaction holds the row,
// as NOWAIT does not wait).
const tryLock = (lock: Effect.Effect<unknown, SqlError.SqlError>) =>
  Effect.exit(lock).pipe(
    Effect.map((exit) => {
      if (Exit.isSuccess(exit)) {
        return "free";
      }

      const refused = Cause.findErrorOption(exit.cause);

      assert(Option.isSome(refused));

      const { code } = Schema.decodeUnknownSync(PostgresErrorSchema)(
        refused.value.reason.cause
      );

      return `${refused.value.reason._tag} ${code}`;
    })
  );

const held = "LockTimeoutError 55P03";

describe("deleting a file posts and articles show", () => {
  it.effect(
    "locks the posts before articles are asked, then the articles, until the transaction ends",
    () =>
      onArticles(
        Effect.gen(function* lockOrder() {
          const { actor, articleId, postId, workspaceId } =
            yield* showingTheCover;

          const articles = yield* Articles;
          const sql = yield* SqlClient.SqlClient;

          const afterFirst = yield* gate;
          const afterSecond = yield* gate;

          const usage = yield* MediaUsage.pipe(
            Effect.provide(holdersStoppedAt(afterFirst, afterSecond))
          );

          const releasing = yield* usage
            .release(workspaceId, coverImage.media.mediaId)
            .pipe(Effect.forkChild);

          // From this fiber, so on another connection of the pool.
          const lockPost = sql`SELECT 1 FROM publishing.posts
            WHERE id = ${postId} FOR UPDATE NOWAIT`;

          const lockArticle = sql`SELECT 1 FROM publishing.articles
            WHERE id = ${articleId} FOR UPDATE NOWAIT`;

          yield* Deferred.await(afterFirst.reached);

          const whilePostsHeld = [
            yield* tryLock(lockPost),
            yield* tryLock(lockArticle),
          ];

          yield* Deferred.succeed(afterFirst.open, true);
          yield* Deferred.await(afterSecond.reached);

          const whileBothHeld = [
            yield* tryLock(lockPost),
            yield* tryLock(lockArticle),
          ];

          yield* Deferred.succeed(afterSecond.open, true);

          const released = yield* Fiber.join(releasing);

          // The posts first, the articles not yet; then both, until the
          // transaction ends.
          assert.deepStrictEqual(whilePostsHeld, [held, "free"]);
          assert.deepStrictEqual(whileBothHeld, [held, held]);
          assert.deepStrictEqual(released, [postId]);

          yield* lockPost;
          yield* lockArticle;

          const after = yield* articles.get(actor, articleId);

          assert.isTrue(Option.isNone(after.content.coverMediaId));
        })
      )
  );
});

// The erasure as the server runs it, on the posts' and the articles' own
// records, stopped at the gate between the two; the other contexts hold
// nothing of the workspace.
const erasureStoppedAt = (stop: Gate) =>
  ContextRecordsLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        PostRecords.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              DrizzleWorkspacePostStore,
              DrizzleLivePostChangeStore,
              WorkflowLivePostJobs,
              // Drafts have no job to stop.
              Layer.mock(PublicationScheduler, {})
            )
          )
        ),
        Layer.effect(
          ArticleRecords,
          Effect.gen(function* StoppedArticleRecords() {
            const records = yield* ArticleRecords;
            const sql = yield* SqlClient.SqlClient;

            return ArticleRecords.of({
              ...records,
              eraseWorkspace: (workspaceId) =>
                stopAt(stop).pipe(
                  Effect.provideService(SqlClient.SqlClient, sql),
                  Effect.andThen(records.eraseWorkspace(workspaceId))
                ),
            });
          })
        ),
        Layer.mock(ReviewRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(AnalyticsRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(EngagementRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(ChannelRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(MediaRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(NoticeRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(AgentRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(UsageRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(WebhookRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(ActivityRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(ShortLinkRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(AdRecords, {
          ensureErasable: () => Effect.void,
          eraseWorkspace: () => Effect.void,
        }),
        Layer.mock(BillingRecords, { eraseWorkspace: () => Effect.void }),
        Layer.mock(StaffRecords, {}),
        Layer.mock(LegalRecords, {})
      )
    ),
    Layer.provide(PlainPseudonymsTest)
  );

// Until a backend waits for a lock the one at `pid` holds, asked on the
// real clock, as the test's is still.
const blockedBy = (pid: number) =>
  Effect.gen(function* blocked() {
    const sql = yield* SqlClient.SqlClient;

    for (let round = 0; round < 1000; round += 1) {
      const rows = yield* sql`SELECT 1 FROM pg_stat_activity
        WHERE ${pid} = ANY(pg_blocking_pids(pid))`;

      if (rows.length > 0) {
        return;
      }

      yield* TestClock.withLive(Effect.sleep(Duration.millis(10)));
    }

    assert.fail("Nothing waited for the deletion's locks");
  }).pipe(Effect.orDie);

// Why an exit failed, readably, for the assertion's message.
const failureOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";

describe("deleting a file while its workspace is erased", () => {
  it.effect(
    "takes the posts and the articles in the erasure's order, so neither waits for the other forever",
    () =>
      onArticles(
        Effect.gen(function* oneOrder() {
          const { actor, articleId, postId, workspaceId } =
            yield* showingTheCover;

          const articles = yield* Articles;
          const { transaction } = yield* TransactionRunner;

          const deletionGate = yield* gate;
          const afterSecond = yield* gate;
          const erasureGate = yield* gate;

          // The deletion stops once it holds its first locks alone.
          yield* Deferred.succeed(afterSecond.open, true);

          const usage = yield* MediaUsage.pipe(
            Effect.provide(holdersStoppedAt(deletionGate, afterSecond))
          );

          const records = yield* ContextRecords.pipe(
            Effect.provide(erasureStoppedAt(erasureGate))
          );

          // The deletion takes its first locks and stops.
          const deleting = yield* usage
            .release(workspaceId, coverImage.media.mediaId)
            .pipe(Effect.exit, Effect.forkChild);

          const deletion = yield* Deferred.await(deletionGate.reached);

          // The erasure, in its own transaction as deleting the workspace
          // runs it, takes its first locks and stops, unless it already
          // waits for what the deletion holds.
          const erasing = yield* transaction(
            records.eraseWorkspace(workspaceId)
          ).pipe(Effect.exit, Effect.forkChild);

          yield* Effect.race(
            Deferred.await(erasureGate.reached),
            blockedBy(deletion)
          );

          yield* Deferred.succeed(deletionGate.open, true);
          yield* Deferred.succeed(erasureGate.open, true);

          const deleted = yield* Fiber.join(deleting);
          const erased = yield* Fiber.join(erasing);

          assert(Exit.isSuccess(deleted), failureOf(deleted));
          assert(Exit.isSuccess(erased), failureOf(erased));

          // The deletion went first: the draft lost the file, then the
          // erasure took everything.
          assert.deepStrictEqual(deleted.value, [postId]);

          const post = yield* PostRepository.use((posts) =>
            posts.find(postId)
          ).pipe(Effect.provide(DrizzlePostRepository));

          const gone = yield* articles.get(actor, articleId).pipe(Effect.flip);

          assert.isTrue(Option.isNone(post));
          assert.strictEqual(gone._tag, "ArticleNotFound");
        })
      )
  );
});
