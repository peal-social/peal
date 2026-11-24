import { assert, describe, it } from "@effect/vitest";
import {
  Cron,
  DateTime,
  Deferred,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Ref,
  Schema,
  Scope,
} from "effect";
import { ClusterCron, RunnerAddress } from "effect/cluster";
import type { Sharding } from "effect/cluster";
import { SqlClient } from "effect/sql";

import { ActivityLog } from "#activity/application/activity-log.ts";
import { RequestLimiter } from "#activity/application/request-limiter.ts";
import { BoostFollowUp } from "#ads/application/boost-follow-up.ts";
import { PurgeAdData } from "#ads/application/purge-ad-data.ts";
import { SyncAdAccounts } from "#ads/application/sync-ad-accounts.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { CollectAccounts } from "#analytics/application/collect-accounts.ts";
import { CollectMetrics } from "#analytics/application/collect-metrics.ts";
import { PurgeAnalytics } from "#analytics/application/purge-analytics.ts";
import { clusterLayer } from "#app/cluster.ts";
import { CronsLive } from "#app/crons.ts";
import { BillingMode } from "#billing/application/ports/billing-mode.ts";
import { PurgeContractRecords } from "#billing/application/purge-contract-records.ts";
import { ReceiveContractRequest } from "#billing/application/receive-contract-request.ts";
import { ReportUsage } from "#billing/application/report-usage.ts";
import { SendBillingReminders } from "#billing/application/send-billing-reminders.ts";
import { SnapshotUsage } from "#billing/application/snapshot-usage.ts";
import { StartAccountDays } from "#billing/application/start-account-days.ts";
import { ConnectChannel } from "#channels/application/connect-channel.ts";
import { ForgetTokenOwners } from "#channels/application/forget-token-owners.ts";
import { PurgeConnectLinks } from "#channels/application/purge-connect-links.ts";
import { RefreshChannelTokens } from "#channels/application/refresh-channel-tokens.ts";
import { WarnChannelsNeedingReconnect } from "#channels/application/warn-channels-needing-reconnect.ts";
import { CollectComments } from "#engagement/application/collect-comments.ts";
import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { CollectReviews } from "#engagement/application/collect-reviews.ts";
import { CommentRules } from "#engagement/application/comment-rules.ts";
import { MessageJobs } from "#engagement/application/ports/message-jobs.ts";
import { PurgeEngagement } from "#engagement/application/purge-engagement.ts";
import { PurgeMessages } from "#engagement/application/purge-messages.ts";
import { PurgeReviews } from "#engagement/application/purge-reviews.ts";
import { slotOf } from "#engagement/application/receive-message-events.ts";
import { SendPrivateReply } from "#engagement/application/send-private-reply.ts";
import { SendReply } from "#engagement/application/send-reply.ts";
import { WorkflowMessageJobs } from "#engagement/infrastructure/workflow-message-jobs.ts";
import {
  ReadMessageBoxV1,
  ReadMessageBoxV1Live,
} from "#engagement/infrastructure/workflows/read-message-box.ts";
import { PurgeLegalRecords } from "#legal/application/purge-legal-records.ts";
import { MediaSweeps } from "#media/application/media-sweeps.ts";
import { SendWeeklyDigests } from "#notifications/application/send-weekly-digests.ts";
import { Feeds } from "#publishing/application/feeds.ts";
import { FollowUps } from "#publishing/application/follow-ups.ts";
import { PostRepository } from "#publishing/application/post-repository.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { PublicationScheduler } from "#publishing/application/publication-scheduler.ts";
import { Recycling } from "#publishing/application/recycling.ts";
import { publishingWith, publishingWorkers } from "#publishing/container.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import { createTarget } from "#publishing/domain/post-target.ts";
import { createDraft, schedulePost } from "#publishing/domain/post.ts";
import { Schedule } from "#publishing/domain/schedule.ts";
import {
  FakePlatform,
  FakePlatformPublisher,
} from "#publishing/infrastructure/fake-platform-publisher.ts";
import { PublishPostV1 } from "#publishing/infrastructure/workflows/publish-post.ts";
import { PurgeReviewData } from "#review/application/purge-review-data.ts";
import { newId } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type { PostId } from "#shared/domain/ids.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import { purgeFinishedClusterRows } from "#shared/infrastructure/cluster-retention.ts";
import { DatabaseLive } from "#shared/infrastructure/database.ts";
import type { Drizzle } from "#shared/infrastructure/database.ts";
import { MigrationsLive } from "#shared/infrastructure/migrations.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import { PurgeClicks } from "#shortlinks/application/purge-clicks.ts";
import { PurgeAuditLog } from "#staff/application/purge-audit-log.ts";
import { RecordingPublicationOutcomes } from "#test/publishing/infrastructure/recorded-outcomes.ts";
import {
  actorIn,
  ReferencesTest,
  syntheticContent,
} from "#test/publishing/support.ts";
import { PurgeDeliveries } from "#webhooks/application/purge-deliveries.ts";
import { MeterPartnerUsage } from "#workspace/application/meter-partner-usage.ts";

// The cluster as the server runs it: SingleRunner with SQL message and
// runner storage, on the Postgres that DATABASE_URL names, with the real
// clock. Only this file runs a SQL runner, since runners on one database
// share its shards. Each server here is a restart of the same runner, whose
// address stays the same from run to run. Tests leave no job waiting behind,
// as a dev server on the same database would run it.

const runner = RunnerAddress.make("peal-server-test", 34_431);

const Cluster = clusterLayer({
  entityMessagePollInterval: Duration.millis(100),
  entityTerminationTimeout: Duration.zero,
  runnerAddress: Option.some(runner),
});

const Database = MigrationsLive.pipe(Layer.provideMerge(DatabaseLive));

// A cron that ticks every second, to leave finished cron runs behind. Its
// rows are deleted after the test that runs it: a server that does not
// register it would retry its pending run forever.
const tickName = "test.tick";

// Where the ticks' runs pass, so a test can stop them on the real clock:
// once it is shut, the next run waits there (`held`) until the test lets
// it go (`released`), and no run is processed meanwhile.
const tickGate = Effect.all({
  held: Deferred.make<boolean>(),
  open: Ref.make(true),
  released: Deferred.make<boolean>(),
});

type TickGate = Effect.Success<typeof tickGate>;

const ticksThrough = (gate: TickGate) =>
  ClusterCron.make({
    cron: Cron.parseUnsafe("* * * * * *", "UTC"),
    execute: Ref.get(gate.open).pipe(
      Effect.flatMap((open) =>
        open
          ? Effect.void
          : Deferred.succeed(gate.held, true).pipe(
              Effect.andThen(Deferred.await(gate.released))
            )
      )
    ),
    name: tickName,
  });

// The jobs the server's crons call, doing nothing: a real sweep would
// refresh, or mark, the channels other suites keep in this database, a
// real collection read their posts, a real purge delete their audit
// events, and real reminders tell their members.
const swept = {
  bytes: 0,
  failed: 0,
  left: false,
  refused: Option.none(),
  swept: 0,
};

const ChannelJobsTest = Layer.mergeAll(
  // A server that does not bill: the reporter of usage is not registered.
  Layer.succeed(
    BillingMode,
    BillingMode.of({
      enabled: false,
      graceSince: Option.none(),
      graceUntil: Option.none(),
    })
  ),
  Layer.mock(ReportUsage, {}),
  Layer.mock(StartAccountDays, {}),
  Layer.succeed(PurgeAuditLog, PurgeAuditLog.of({ purge: Effect.succeed(0) })),
  Layer.succeed(
    SendBillingReminders,
    SendBillingReminders.of({ run: Effect.succeed(0) })
  ),
  Layer.succeed(
    PurgeContractRecords,
    PurgeContractRecords.of({ run: Effect.succeed(0) })
  ),
  Layer.succeed(
    SnapshotUsage,
    SnapshotUsage.of({
      run: Effect.succeed({
        accountDays: 0,
        accountDaysPurged: 0,
        day: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
        purged: 0,
        workspaces: 0,
      }),
    })
  ),
  Layer.succeed(
    ReceiveContractRequest,
    ReceiveContractRequest.of({
      catchUp: Effect.succeed(0),
      process: () => Effect.void,
      receive: () => Effect.die("not used by the crons"),
    })
  ),
  Layer.succeed(
    PurgeLegalRecords,
    PurgeLegalRecords.of({ purge: Effect.succeed(0) })
  ),
  Layer.succeed(PurgeClicks, PurgeClicks.of({ purge: Effect.succeed(0) })),
  Layer.succeed(
    PurgeConnectLinks,
    PurgeConnectLinks.of({ run: Effect.succeed(0) })
  ),
  Layer.succeed(
    ForgetTokenOwners,
    ForgetTokenOwners.of({ run: Effect.succeed(0) })
  ),
  Layer.succeed(
    MeterPartnerUsage,
    MeterPartnerUsage.of({
      run: Effect.succeed({ days: 0, keys: 0, partners: 0 }),
    })
  ),
  Layer.succeed(
    PurgeReviewData,
    PurgeReviewData.of({ purge: Effect.succeed({ emails: 0, names: 0 }) })
  ),
  Layer.succeed(
    PurgeDeliveries,
    PurgeDeliveries.of({ purge: Effect.succeed(0) })
  ),
  Layer.succeed(
    PurgeAnalytics,
    PurgeAnalytics.of({
      purge: () => Effect.succeed({ accountDays: 0, paidReads: 0, posts: 0 }),
    })
  ),
  Layer.succeed(
    CollectAccounts,
    CollectAccounts.of({
      run: () =>
        Effect.succeed({
          deferred: 0,
          discovered: 0,
          ended: 0,
          left: 0,
          read: 0,
          skipped: 0,
        }),
    })
  ),
  Layer.succeed(
    SyncAdAccounts,
    SyncAdAccounts.of({
      run: () =>
        Effect.succeed({
          gone: 0,
          halted: 0,
          left: 0,
          postponed: 0,
          reconnectNeeded: 0,
          synced: 0,
          unread: 0,
        }),
    })
  ),
  Layer.succeed(
    BoostFollowUp,
    BoostFollowUp.of({
      afterSync: () => Effect.void,
      endDue: Effect.succeed(0),
    })
  ),
  Layer.succeed(
    PurgeAdData,
    PurgeAdData.of({
      purge: Effect.succeed({ auditLines: 0, days: 0, signIns: 0 }),
    })
  ),
  Layer.succeed(
    CollectMetrics,
    CollectMetrics.of({
      run: () =>
        Effect.succeed({
          deferred: 0,
          discovered: 0,
          ended: 0,
          left: 0,
          read: 0,
          skipped: 0,
        }),
    })
  ),
  Layer.succeed(
    CollectComments,
    CollectComments.of({
      run: () =>
        Effect.succeed({
          discovered: 0,
          ended: 0,
          failed: 0,
          left: 0,
          postponed: 0,
          read: 0,
          received: 0,
        }),
    })
  ),
  Layer.succeed(
    CommentRules,
    CommentRules.of({
      change: () => Effect.die("No comment rule changes here"),
      get: () => Effect.die("No comment rule is read here"),
      list: () => Effect.succeed([]),
      runDue: Effect.succeed({
        ended: 0,
        looked: 0,
        privateReplied: 0,
        replied: 0,
      }),
      start: () => Effect.die("No comment rule starts here"),
      stop: () => Effect.die("No comment rule stops here"),
    })
  ),
  Layer.succeed(
    CollectReviews,
    CollectReviews.of({
      run: () =>
        Effect.succeed({
          checked: 0,
          deferred: 0,
          followed: 0,
          left: 0,
          read: 0,
          stranded: 0,
        }),
    })
  ),
  Layer.succeed(
    PurgeReviews,
    PurgeReviews.of({ purge: Effect.succeed({ reviews: 0, threads: 0 }) })
  ),
  Layer.succeed(
    CollectMessages,
    CollectMessages.of({
      readBox: () => Effect.succeed("missing"),
      run: () =>
        Effect.succeed({
          deferred: 0,
          followed: 0,
          left: 0,
          read: 0,
          stranded: 0,
        }),
    })
  ),
  Layer.succeed(
    PurgeMessages,
    PurgeMessages.of({
      purge: Effect.succeed({ conversations: 0, messages: 0 }),
    })
  ),
  Layer.succeed(
    SendReply,
    SendReply.of({
      run: () => Effect.succeed("superseded"),
      settleStranded: Effect.succeed(0),
    })
  ),
  Layer.succeed(
    SendPrivateReply,
    SendPrivateReply.of({
      run: () => Effect.succeed("superseded"),
      settleStranded: Effect.succeed(0),
    })
  ),
  Layer.succeed(
    PurgeEngagement,
    PurgeEngagement.of({
      forgetExpired: Effect.succeed(0),
      purge: Effect.succeed(0),
    })
  ),
  Layer.succeed(
    RefreshChannelTokens,
    RefreshChannelTokens.of({
      refresh: () => Effect.succeed("skipped"),
      sweep: () =>
        Effect.succeed({
          due: 0,
          failed: 0,
          left: 0,
          reconnectRequired: 0,
          refreshed: 0,
          unavailable: 0,
        }),
    })
  ),
  // The store's sweeps reach the bucket other suites write to.
  Layer.succeed(
    MediaSweeps,
    MediaSweeps.of({
      folders: Effect.succeed(swept),
      orphans: Effect.succeed(swept),
      pending: Effect.succeed(swept),
      uploads: Effect.succeed(swept),
    })
  ),
  Layer.succeed(
    SendWeeklyDigests,
    SendWeeklyDigests.of({
      run: () =>
        Effect.succeed({
          deferred: 0,
          failed: 0,
          nothingToTell: 0,
          readers: 0,
          sent: 0,
          skipped: 0,
          stopped: false,
        }),
    })
  ),
  Layer.succeed(
    WarnChannelsNeedingReconnect,
    WarnChannelsNeedingReconnect.of({
      run: Effect.succeed({
        expired: 0,
        reconnectRequired: 0,
        reconnectSoon: 0,
      }),
    })
  ),
  Layer.succeed(
    RequestLimiter,
    RequestLimiter.of({
      admit: () => Effect.die("not used by the crons"),
      purge: Effect.succeed(0),
    })
  ),
  Layer.succeed(
    ActivityLog,
    ActivityLog.of({
      list: () => Effect.die("not used by the crons"),
      purge: Effect.succeed(0),
      record: () => Effect.die("not used by the crons"),
    })
  ),
  Layer.succeed(
    ConnectChannel,
    ConnectChannel.of({
      choose: () => Effect.die("not used by the crons"),
      complete: () => Effect.die("not used by the crons"),
      connectable: () => Effect.die("not used by the crons"),
      purgeExpired: Effect.succeed(0),
      reconnect: () => Effect.die("not used by the crons"),
      start: () => Effect.die("not used by the crons"),
    })
  )
);

// The publishing crons' work, done on nothing: on the real clock, a run
// would make the occurrences of the rules other suites keep in this
// database, read their feeds, and a purge delete their idempotency keys.
const PublishingCronWorkTest = Layer.mergeAll(
  Layer.effect(
    Feeds,
    Feeds.use((feeds) =>
      Effect.succeed(
        Feeds.of({
          ...feeds,
          overdue: () => Effect.succeed(0),
          poll: () =>
            Effect.succeed({
              failed: 0,
              left: 0,
              made: 0,
              read: 0,
              stopped: 0,
              unfinished: false,
            }),
          prune: Effect.succeed({ items: 0, reads: 0 }),
        })
      )
    )
  ),
  Layer.effect(
    FollowUps,
    FollowUps.use((followUps) =>
      Effect.succeed(
        FollowUps.of({
          ...followUps,
          runDue: Effect.succeed({
            armed: 0,
            cancelled: 0,
            channelGone: 0,
            completed: 0,
            expired: 0,
            left: 0,
            told: 0,
            triggered: 0,
          }),
          settleStranded: Effect.succeed(0),
        })
      )
    )
  ),
  Layer.effect(
    Recycling,
    Recycling.use((rules) =>
      Effect.succeed(
        Recycling.of({
          ...rules,
          makeDue: Effect.succeed({
            ended: 0,
            left: 0,
            made: 0,
            waitingSince: [],
          }),
          overdue: () => Effect.succeed(0),
        })
      )
    )
  ),
  Layer.effect(
    PostScheduling,
    PostScheduling.use((scheduling) =>
      Effect.succeed(
        PostScheduling.of({
          ...scheduling,
          forgetExpiredKeys: Effect.succeed(0),
        })
      )
    )
  )
);

// The agent's retention, which would delete the chats other suites keep
// in this database: it deletes nothing here.
const AgentRecordsTest = Layer.succeed(
  AgentRecords,
  AgentRecords.of({
    eraseMember: () => Effect.void,
    eraseUser: () => Effect.void,
    eraseWorkspace: () => Effect.void,
    exportSkills: () => Effect.succeed([]),
    exportUser: () => Effect.succeed([]),
    purge: Effect.succeed(0),
  })
);

// The server's crons, their work as `PublishingCronWorkTest` does it.
const CronsTest = CronsLive.pipe(
  Layer.provide(PublishingCronWorkTest),
  Layer.provide(AgentRecordsTest)
);

const serverWith = <E, R>(
  platforms: Layer.Layer<Layer.Success<typeof FakePlatformPublisher>, E, R>,
  crons: Layer.Layer<
    never,
    never,
    | Layer.Success<typeof ChannelJobsTest>
    | Feeds
    | FollowUps
    | PostScheduling
    | Recycling
    | Drizzle
    | Sharding.Sharding
    | SqlClient.SqlClient
  > = CronsTest
) =>
  Layer.mergeAll(publishingWorkers(platforms), crons).pipe(
    Layer.provideMerge(publishingWith(ReferencesTest)),
    Layer.provideMerge(RecordingPublicationOutcomes),
    Layer.provideMerge(ChannelJobsTest),
    Layer.provideMerge(Layer.mergeAll(IdsLive, TransactionRunnerLive)),
    Layer.provideMerge(Cluster),
    Layer.provideMerge(platforms)
  );

const live = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.timeout(Duration.seconds(20)));

const waitUntil = <E, R>(
  label: string,
  condition: Effect.Effect<boolean, E, R>
) =>
  Effect.gen(function* waiting() {
    for (let round = 0; round < 200; round += 1) {
      if (yield* condition) {
        return;
      }

      yield* Effect.sleep(Duration.millis(50));
    }

    assert.fail(`Timed out waiting until ${label}`);
  });

const CountSchema = Schema.Tuple([Schema.Struct({ count: Schema.Int })]);

const count = (
  query: Effect.Effect<readonly unknown[], unknown, SqlClient.SqlClient>
) =>
  query.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(CountSchema)),
    Effect.map(([{ count: rows }]) => rows)
  );

const messagesOf = (entityId: string) =>
  SqlClient.SqlClient.use((sql) =>
    count(
      sql`SELECT count(*)::int AS count FROM cluster_messages WHERE entity_id = ${entityId}`
    )
  );

// Whether the execution's run ended: it has a final reply, other than the
// one a sleeping run gets, as the purge reads it. A post is finished a
// moment before its job's reply is written.
const hasEnded = (execution: string) =>
  SqlClient.SqlClient.use((sql) =>
    count(
      sql`SELECT count(*)::int AS count FROM cluster_messages m JOIN cluster_replies r ON r.request_id = m.id AND r.kind = 0 WHERE m.entity_id = ${execution} AND m.kind = 0 AND m.tag = 'run' AND NOT r.payload::jsonb @> '{"_tag":"Success","value":{"_tag":"Suspended"}}'`
    )
  ).pipe(Effect.map((ended) => ended > 0));

const cronRuns = (processed: boolean) =>
  SqlClient.SqlClient.use((sql) =>
    count(
      sql`SELECT count(*)::int AS count FROM cluster_messages WHERE entity_type = ${`ClusterCron/${tickName}`} AND processed = ${processed}`
    )
  );

const forgetTicks = SqlClient.SqlClient.use((sql) =>
  sql.withTransaction(
    Effect.gen(function* forgettingTicks() {
      const entityType = `ClusterCron/${tickName}`;

      yield* sql`DELETE FROM cluster_replies WHERE request_id IN (SELECT id FROM cluster_messages WHERE entity_type = ${entityType})`;
      yield* sql`DELETE FROM cluster_messages WHERE entity_type = ${entityType}`;
    })
  )
);

// The rows of every job whose payload names one of `ids` (a post, a
// channel) or a target of those posts: their runs, the runs they started,
// their clocks, and the replies to them.
const forgetJobsOf = (ids: readonly string[]) =>
  SqlClient.SqlClient.use((sql) =>
    sql.withTransaction(
      Effect.gen(function* forgetJobs() {
        const listed = ids.join(",");

        const targets = yield* sql<{
          readonly id: string;
        }>`SELECT id::text AS id FROM publishing.post_targets WHERE post_id::text = ANY(string_to_array(${listed}, ','))`;

        const named = [...ids, ...targets.map(({ id }) => id)]
          .map((id) => `%${id}%`)
          .join(",");

        yield* sql`DELETE FROM cluster_replies WHERE request_id IN (SELECT id FROM cluster_messages WHERE entity_id IN (SELECT entity_id FROM cluster_messages WHERE entity_type LIKE 'Workflow/%' AND payload LIKE ANY(string_to_array(${named}, ','))))`;
        yield* sql`DELETE FROM cluster_messages WHERE entity_id IN (SELECT entity_id FROM cluster_messages WHERE entity_type LIKE 'Workflow/%' AND payload LIKE ANY(string_to_array(${named}, ',')))`;
      })
    )
  );

/**
 * Runs `test`, which says the posts and channels it starts jobs for
 * (`started`), and once it ended and its server stopped, deletes what is
 * left of those jobs, however it ended: a test that failed or timed out
 * part way leaves a job due, which the next server on this database runs,
 * the next test's (a post published twice) or a dev server's.
 */
const forgettingJobs = <A, E, R>(
  test: (started: Ref.Ref<readonly string[]>) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* forgetting() {
    const started = yield* Ref.make<readonly string[]>([]);

    return yield* test(started).pipe(
      Effect.ensuring(
        Ref.get(started).pipe(
          Effect.flatMap((ids) =>
            ids.length === 0 ? Effect.void : forgetJobsOf(ids)
          ),
          Effect.provide(Database),
          Effect.orDie
        )
      )
    );
  });

// The calls the fake platform took for `postId`. A run killed part way
// leaves its jobs due, which the next run's servers publish through the
// same fake: a test counts the calls of its own post, never every call.
const callsFor = (platform: FakePlatform["Service"], postId: PostId) =>
  platform.calls.pipe(
    Effect.map((calls) =>
      calls.filter(({ request }) => request.postId === postId)
    )
  );

const isFinished = (postId: PostId) =>
  PostRepository.use((posts) => posts.find(postId)).pipe(
    Effect.map(
      (stored) =>
        Option.isSome(stored) && stored.value.post.status._tag === "finished"
    )
  );

const scheduleSoon = (
  delay: Duration.Duration,
  started: Ref.Ref<readonly string[]>
) =>
  Effect.gen(function* schedulingSoon() {
    const workspaceId = yield* newId(WorkspaceIdSchema);
    const channelId = yield* newId(ChannelIdSchema);
    const at = DateTime.addDuration(yield* DateTime.now, delay);

    const { post } = yield* PostScheduling.use((scheduling) =>
      scheduling.schedule(actorIn(workspaceId), {
        channelIds: [channelId],
        content: syntheticContent,
        schedule: new Schedule({
          at,
          timeZone: TimeZoneIdSchema.make("Europe/Paris"),
        }),
      })
    );

    yield* Ref.update(started, (ids) => [...ids, post.id]);

    const execution = yield* PostRepository.use((posts) =>
      posts.find(post.id)
    ).pipe(
      Effect.map((stored) =>
        Option.getOrThrowWith(
          stored.pipe(Option.flatMap(({ execution: job }) => job)),
          () => new Error("The post has no job")
        )
      )
    );

    return { execution, post };
  });

const regclass = (name: string) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql<{
        readonly name: string | null;
      }>`SELECT to_regclass(${name})::text AS name`
  ).pipe(Effect.map((rows) => rows[0]?.name ?? null));

describe("the cluster on Postgres", () => {
  it.live(
    "creates its tables and registers its runner",
    () =>
      live(
        Effect.gen(function* createsTables() {
          for (const table of [
            "cluster_messages",
            "cluster_replies",
            "cluster_runners",
          ]) {
            assert.strictEqual(yield* regclass(table), table);
          }

          // The runner registers itself in the background once the cluster is
          // up, so under load the row can appear a moment after the tables.
          const runners = SqlClient.SqlClient.use((sql) =>
            count(
              sql`SELECT count(*)::int AS count FROM cluster_runners WHERE address = ${`${runner.host}:${runner.port}`}`
            )
          );

          yield* waitUntil(
            "the runner is registered",
            runners.pipe(Effect.map((registered) => registered > 0))
          );

          assert.strictEqual(yield* runners, 1);
        }).pipe(
          Effect.provide(
            serverWith(FakePlatformPublisher).pipe(Layer.provideMerge(Database))
          )
        )
      ),
    30_000
  );

  it.live(
    "commits a post and the start of its job together, or neither",
    () =>
      forgettingJobs((started) =>
        live(
          Effect.gen(function* outbox() {
            const { transaction } = yield* TransactionRunner;
            const posts = yield* PostRepository;
            const scheduler = yield* PublicationScheduler;
            const platform = yield* FakePlatform;

            const now = yield* DateTime.now;
            const postId = yield* newId(PostIdSchema);
            const at = DateTime.addDuration(now, Duration.seconds(1));

            const post = yield* Effect.fromResult(
              schedulePost(
                createDraft(
                  postId,
                  yield* newId(WorkspaceIdSchema),
                  syntheticContent,
                  Option.none()
                ),
                new Schedule({
                  at,
                  timeZone: TimeZoneIdSchema.make("Europe/Paris"),
                }),
                now
              )
            );

            const target = createTarget(
              yield* newId(PostTargetIdSchema),
              postId,
              yield* newId(ChannelIdSchema)
            );

            const execution = yield* PublishPostV1.executionId({
              codeVersion: 1,
              postId,
              revision: post.scheduleRevision,
              scheduledAt: at,
            });

            const rolledBack = yield* transaction(
              Effect.gen(function* insertStartAndFail() {
                yield* posts.insert(post, [target]);
                yield* scheduler.schedule({
                  postId,
                  revision: post.scheduleRevision,
                  scheduledAt: at,
                });

                return yield* Effect.fail<"rolledBack">("rolledBack");
              })
            ).pipe(Effect.flip);

            assert.strictEqual(rolledBack, "rolledBack");
            assert.isTrue(Option.isNone(yield* posts.find(postId)));
            assert.strictEqual(yield* messagesOf(execution), 0);

            const scheduled = yield* scheduleSoon(Duration.seconds(1), started);

            assert.isAbove(yield* messagesOf(scheduled.execution), 0);

            yield* waitUntil(
              "the post finishes",
              isFinished(scheduled.post.id)
            );

            assert.lengthOf(yield* callsFor(platform, scheduled.post.id), 1);
          }).pipe(
            Effect.provide(
              serverWith(FakePlatformPublisher).pipe(
                Layer.provideMerge(Database)
              )
            )
          )
        )
      ),
    30_000
  );

  it.live(
    "publishes a due post once, across a restart while it sleeps",
    () =>
      forgettingJobs((started) =>
        live(
          Effect.gen(function* survivesRestart() {
            const database = yield* Layer.build(Database);
            const platforms = yield* Layer.build(FakePlatformPublisher);
            const server = serverWith(Layer.succeedContext(platforms));

            const platform = yield* FakePlatform.pipe(
              Effect.provideContext(platforms)
            );

            // Each server stops with the test, however it ends, before the
            // database it runs on.
            const before = yield* Scope.make();

            yield* Effect.addFinalizer(() => Scope.close(before, Exit.void));

            const first = yield* Layer.buildWithScope(server, before).pipe(
              Effect.provideContext(database)
            );

            const { execution, post } = yield* scheduleSoon(
              Duration.seconds(2),
              started
            ).pipe(Effect.provideContext(first));

            // Its wake-up is stored: the job sleeps durably.
            yield* waitUntil(
              "the job sleeps",
              SqlClient.SqlClient.use((sql) =>
                count(
                  sql`SELECT count(*)::int AS count FROM cluster_messages WHERE entity_type = 'Workflow/-/DurableClock' AND entity_id = ${execution}`
                )
              ).pipe(
                Effect.map((clocks) => clocks === 1),
                Effect.provideContext(database)
              )
            );
            yield* Scope.close(before, Exit.void);

            const after = yield* Scope.make();

            yield* Effect.addFinalizer(() => Scope.close(after, Exit.void));

            const second = yield* Layer.buildWithScope(server, after).pipe(
              Effect.provideContext(database)
            );

            yield* waitUntil(
              "the post finishes",
              isFinished(post.id).pipe(Effect.provideContext(second))
            );

            assert.lengthOf(yield* callsFor(platform, post.id), 1);

            yield* Scope.close(after, Exit.void);
          }).pipe(Effect.scoped)
        )
      ),
    30_000
  );

  it.live(
    "purges finished executions and cron runs, and keeps what still waits",
    () =>
      forgettingJobs((started) =>
        live(
          Effect.gen(function* purges() {
            const gate = yield* tickGate;

            yield* Effect.gen(function* purging() {
              const finished = yield* scheduleSoon(Duration.zero, started);
              const waiting = yield* scheduleSoon(Duration.hours(1), started);

              yield* waitUntil("a post finishes", isFinished(finished.post.id));
              yield* waitUntil("its job ends", hasEnded(finished.execution));
              yield* waitUntil(
                "a cron run is processed",
                cronRuns(true).pipe(Effect.map((runs) => runs > 0))
              );

              // The ticks stop: the next run waits at the gate, the one before
              // it is processed, and none is until the test ends, however long
              // a loaded machine takes between the purges and their counts.
              yield* Ref.set(gate.open, false);
              yield* Deferred.await(gate.held);
              yield* waitUntil(
                "only the held run is left to process",
                cronRuns(false).pipe(Effect.map((runs) => runs === 1))
              );

              // Younger than a day: kept.
              yield* purgeFinishedClusterRows(Duration.days(1));

              assert.isAbove(yield* messagesOf(finished.execution), 0);
              assert.isAbove(yield* cronRuns(true), 0);

              const purged = yield* purgeFinishedClusterRows(Duration.zero);

              assert.isAtLeast(purged.executions, 1);
              assert.isAtLeast(purged.cronRuns, 1);
              assert.strictEqual(yield* messagesOf(finished.execution), 0);
              assert.isAbove(yield* messagesOf(waiting.execution), 0);
              assert.strictEqual(yield* cronRuns(true), 0);
              // The next run of each cron is still scheduled.
              assert.isAbove(yield* cronRuns(false), 0);

              const retention = yield* SqlClient.SqlClient.use((sql) =>
                count(
                  sql`SELECT count(*)::int AS count FROM cluster_messages WHERE entity_type = 'ClusterCron/cluster.retention' AND NOT processed`
                )
              );

              assert.isAbove(retention, 0);

              // Leaves no job waiting for a dev server to run.
              yield* PostScheduling.use((scheduling) =>
                scheduling.cancel(
                  actorIn(waiting.post.workspaceId),
                  waiting.post.id
                )
              );
            }).pipe(
              // The held run goes on before the server stops.
              Effect.ensuring(Deferred.succeed(gate.released, true)),
              Effect.provide(
                serverWith(
                  FakePlatformPublisher,
                  Layer.merge(CronsTest, ticksThrough(gate))
                )
              )
            );
          }).pipe(
            // What a run stopped part way left of the ticks first, as a
            // second chain of them would tick on; this run's once the server
            // has stopped.
            (test) => Effect.orDie(forgetTicks).pipe(Effect.andThen(test)),
            Effect.ensuring(Effect.orDie(forgetTicks)),
            Effect.provide(Database)
          )
        )
      ),
    30_000
  );

  it.live(
    "starts a box's read in the event's transaction, once a channel and slot",
    () =>
      forgettingJobs((started) =>
        live(
          Effect.gen(function* boxReads() {
            const { transaction } = yield* TransactionRunner;
            const jobs = yield* MessageJobs;
            const channelId = yield* newId(ChannelIdSchema);

            yield* Ref.update(started, (ids) => [...ids, channelId]);

            // A slot over already: the job reads at once (a box it finds
            // missing), and leaves nothing waiting.
            const slot = slotOf(
              DateTime.subtractDuration(
                yield* DateTime.now,
                Duration.minutes(1)
              )
            );

            const execution = yield* ReadMessageBoxV1.executionId({
              channelId,
              slot,
            });

            const rolledBack = yield* transaction(
              jobs
                .readBox(channelId, slot)
                .pipe(Effect.andThen(Effect.fail("rolledBack" as const)))
            ).pipe(Effect.flip);

            assert.strictEqual(rolledBack, "rolledBack");
            assert.strictEqual(yield* messagesOf(execution), 0);

            // The execution's own requests to run, which a second start of
            // the same slot would add to: the run may write others meanwhile.
            const runs = SqlClient.SqlClient.use((sql) =>
              count(
                sql`SELECT count(*)::int AS count FROM cluster_messages WHERE entity_id = ${execution} AND kind = 0 AND tag = 'run'`
              )
            );

            yield* transaction(jobs.readBox(channelId, slot));
            yield* transaction(jobs.readBox(channelId, slot));
            yield* jobs.readBox(channelId, slot);

            assert.strictEqual(yield* runs, 1);

            yield* waitUntil("the read ends", hasEnded(execution));
          }).pipe(
            Effect.provide(
              Layer.mergeAll(ReadMessageBoxV1Live, WorkflowMessageJobs).pipe(
                Layer.provideMerge(serverWith(FakePlatformPublisher)),
                Layer.provideMerge(Database)
              )
            )
          )
        )
      ),
    30_000
  );
});
