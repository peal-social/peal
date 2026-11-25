// Deleting a file of the library asks the posts, then the articles, in one
// transaction, the order erasing a workspace locks them in: the posts'
// rows are locked before articles are asked, and both stay locked until
// the transaction ends, so a post or an article scheduled meanwhile
// waits, then finds the file gone from it, and a workspace erased
// meanwhile waits for the deletion instead of deadlocking with it.
import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  DateTime,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Ref,
  Result,
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
import { ArticleStore } from "#articles/application/article-store.ts";
import { Articles } from "#articles/application/articles.ts";
import { MediaInArticles } from "#articles/application/media-in-articles.ts";
import type { Article } from "#articles/domain/article.ts";
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
import { createDraft, schedulePost } from "#publishing/domain/post.ts";
import { DrizzleLivePostChangeStore } from "#publishing/infrastructure/drizzle-live-post-change-store.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { DrizzleWorkspacePostStore } from "#publishing/infrastructure/drizzle-workspace-post-store.ts";
import { WorkflowLivePostJobs } from "#publishing/infrastructure/workflow-live-post-jobs.ts";
import { ReviewRecords } from "#review/application/review-records.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { newId } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";
import type { PostId, WorkspaceId } from "#shared/domain/ids.ts";
import { Schedule } from "#shared/domain/schedule.ts";
import { ShortLinkRecords } from "#shortlinks/application/short-link-records.ts";
import { StaffRecords } from "#staff/application/staff-records.ts";
import { coverImage, siteChannel } from "#test/articles/article-server.ts";
import {
  content,
  onArticles,
  writer,
  zone,
} from "#test/articles/article-support.ts";
import { PlainPseudonymsTest } from "#test/billing/support.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { contentOf } from "#test/publishing/support.ts";
import { WebhookRecords } from "#webhooks/application/webhook-records.ts";
import { ContextRecords } from "#workspace/application/context-records.ts";
import { ContextRecordsLive } from "#workspace/infrastructure/context-records.ts";

// When a post scheduled in a test goes out: never, as it gets no job.
const later = new Schedule({
  at: DateTime.makeUnsafe("2026-06-20T09:30:00Z"),
  timeZone: zone,
});

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

// A draft article of a new workspace, showing the cover.
const articleShowingTheCover = Effect.gen(function* articleShowingTheCover() {
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

  return { actor, articleId: article.id, channelId: channel.id, workspaceId };
});

// A post of the workspace showing the cover, scheduled with no job (the
// test removes it) or a draft.
const postShowingTheCover = Effect.fn("test.postShowingTheCover")(
  function* postShowingTheCover(
    workspaceId: WorkspaceId,
    status: "draft" | "scheduled"
  ) {
    const postId = yield* newId(PostIdSchema);

    const draft = createDraft(
      postId,
      workspaceId,
      contentOf("A synthetic post showing the cover", {
        media: [coverImage.media.mediaId],
      }),
      Option.none()
    );

    const post =
      status === "draft"
        ? draft
        : Result.getOrThrow(schedulePost(draft, later, yield* DateTime.now));

    yield* PostRepository.use((posts) => posts.insert(post, [])).pipe(
      Effect.provide(DrizzlePostRepository)
    );

    return postId;
  }
);

const removePost = (postId: PostId) =>
  PostRepository.use((posts) => posts.remove(postId)).pipe(
    Effect.provide(DrizzlePostRepository)
  );

// A draft article and a draft post of the workspace, both showing the
// cover.
const showingTheCover = Effect.gen(function* showingTheCover() {
  const article = yield* articleShowingTheCover;
  const postId = yield* postShowingTheCover(article.workspaceId, "draft");

  return { ...article, postId };
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

  it.effect(
    "is refused for a post scheduled with the file while the articles were waited for",
    () =>
      onArticles(
        Effect.gen(function* scheduledMeanwhile() {
          const { actor, articleId, workspaceId } =
            yield* articleShowingTheCover;

          const articles = yield* Articles;

          const afterFirst = yield* gate;
          const afterSecond = yield* gate;

          yield* Deferred.succeed(afterSecond.open, true);

          const usage = yield* MediaUsage.pipe(
            Effect.provide(holdersStoppedAt(afterFirst, afterSecond))
          );

          // No post shows the file when the deletion asks the posts.
          const releasing = yield* usage
            .release(workspaceId, coverImage.media.mediaId)
            .pipe(Effect.flip, Effect.forkChild);

          yield* Deferred.await(afterFirst.reached);

          // One is scheduled with it before the articles are held.
          const postId = yield* postShowingTheCover(workspaceId, "scheduled");

          yield* Deferred.succeed(afterFirst.open, true);

          const refused = yield* Fiber.join(releasing);

          yield* removePost(postId);

          assert.strictEqual(refused._tag, "MediaInUse");
          assert.deepStrictEqual(refused.postIds, [postId]);
          assert.deepStrictEqual(refused.articleIds, []);

          // Nothing was taken off the draft article.
          const kept = yield* articles.get(actor, articleId);

          assert.deepStrictEqual(
            kept.content.coverMediaId,
            Option.some(coverImage.media.mediaId)
          );
        })
      )
  );
});

// Posts' records with a draft that is scheduled once the posts that show
// the cover are first read, as a member scheduling it then would.
const postsScheduledAfterFirstRead = (postId: PostId) =>
  MediaInPosts.layer.pipe(
    Layer.provide(
      Layer.effect(
        PostRepository,
        Effect.gen(function* SchedulingPostRepository() {
          const posts = yield* PostRepository;
          const reads = yield* Ref.make(0);

          const schedule = Effect.gen(function* schedule() {
            const stored = yield* posts.find(postId);

            assert(Option.isSome(stored));

            const { post } = stored.value;

            const scheduled = Result.getOrThrow(
              schedulePost(post, later, yield* DateTime.now)
            );

            assert.isTrue(yield* posts.update(scheduled, post));
          });

          return PostRepository.of({
            ...posts,
            showing: (workspaceId, mediaId, statuses) =>
              posts
                .showing(workspaceId, mediaId, statuses)
                .pipe(
                  Effect.tap(() =>
                    Ref.getAndUpdate(reads, (count) => count + 1).pipe(
                      Effect.flatMap((before) =>
                        before === 0 ? schedule : Effect.void
                      )
                    )
                  )
                ),
          });
        })
      ).pipe(Layer.provide(DrizzlePostRepository))
    )
  );

describe("the posts that show a file", () => {
  it.effect("count a draft scheduled while they are read as scheduled", () =>
    onArticles(
      Effect.gen(function* readOnce() {
        const workspaceId = yield* freshWorkspace;
        const postId = yield* postShowingTheCover(workspaceId, "draft");
        const { transaction } = yield* TransactionRunner;

        const posts = yield* transaction(
          MediaInPosts.use((inPosts) =>
            inPosts.hold(workspaceId, coverImage.media.mediaId)
          )
        ).pipe(Effect.provide(postsScheduledAfterFirstRead(postId)));

        yield* removePost(postId);

        assert.deepStrictEqual(posts.scheduled, [postId]);
      })
    )
  );
});

// Two articles of a new workspace showing the cover, kept in the table in
// the reverse of their ids' order, so that a statement that names no order
// would come to the later id first.
const articlesInReverse = Effect.gen(function* articlesInReverse() {
  const first = yield* articleShowingTheCover;
  const articles = yield* Articles;
  const sql = yield* SqlClient.SqlClient;

  const second = yield* articles.create(
    first.actor,
    { channelId: first.channelId, content: content() },
    Option.none()
  );

  const [low, high] = [first.articleId, second.id].toSorted();

  assert(low !== undefined && high !== undefined);

  yield* sql`
    WITH taken AS (
      DELETE FROM publishing.articles
      WHERE id IN (${low}, ${high})
      RETURNING *
    )
    INSERT INTO publishing.articles SELECT * FROM taken ORDER BY id DESC
  `;

  return { high, low, workspaceId: first.workspaceId };
});

// Locks the workspace's two articles, in the order the statement takes
// them, while another transaction holds the earlier one: it then waits
// for that one first, holding nothing, and ends with both, earlier first.
const inIdOrder = (
  lock: (
    workspaceId: WorkspaceId
  ) => Effect.Effect<readonly Article[], DatabaseError, ArticleStore>
) =>
  onArticles(
    Effect.gen(function* idOrder() {
      const { high, low, workspaceId } = yield* articlesInReverse;
      const sql = yield* SqlClient.SqlClient;
      const { transaction } = yield* TransactionRunner;
      const holding = yield* gate;

      const holder = yield* transaction(
        sql`SELECT 1 FROM publishing.articles
          WHERE id = ${low} FOR UPDATE`.pipe(Effect.andThen(stopAt(holding)))
      ).pipe(Effect.forkChild);

      const holderPid = yield* Deferred.await(holding.reached);

      // Read from the table itself, which keeps them in the reverse of
      // their ids: an index would happen to give their order.
      const locking = yield* transaction(
        sql`SET LOCAL enable_indexscan = off`.pipe(
          Effect.andThen(sql`SET LOCAL enable_bitmapscan = off`),
          Effect.andThen(lock(workspaceId))
        )
      ).pipe(Effect.forkChild);

      // A poll that gives up lets the holder go, so both transactions end
      // and the test says why instead of waiting for its timeout.
      yield* blockedBy(holderPid).pipe(
        Effect.onError(() => Deferred.succeed(holding.open, true))
      );

      const higher = yield* tryLock(
        sql`SELECT 1 FROM publishing.articles
          WHERE id = ${high} FOR UPDATE NOWAIT`
      );

      yield* Deferred.succeed(holding.open, true);
      yield* Fiber.join(holder);

      const locked = yield* Fiber.join(locking);

      assert.strictEqual(higher, "free");
      assert.deepStrictEqual(
        locked.map(({ id }) => id),
        [low, high]
      );
    })
  );

describe("the articles' locks", () => {
  it.effect("are taken in the order of their ids for a file they show", () =>
    inIdOrder((workspaceId) =>
      ArticleStore.use((store) =>
        store.lockShowing(workspaceId, coverImage.media.mediaId)
      )
    )
  );

  it.effect("are taken in the order of their ids for their workspace", () =>
    inIdOrder((workspaceId) =>
      ArticleStore.use((store) => store.lockWorkspace(workspaceId))
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

          // Whichever comes first, a poll that gave up included; the gates
          // open however it ends, so both transactions end and a test that
          // fails says why instead of waiting for its timeout.
          yield* Effect.raceFirst(
            Deferred.await(erasureGate.reached),
            blockedBy(deletion)
          ).pipe(
            Effect.ensuring(
              Deferred.succeed(deletionGate.open, true).pipe(
                Effect.andThen(Deferred.succeed(erasureGate.open, true))
              )
            )
          );

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
