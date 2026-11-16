// Meta's events for accounts Peal holds, through the route as the server
// runs it: the account's channels and boxes on Postgres, the intake, the
// job that reads a box started through the workflow engine (on an
// in-memory cluster, driven by TestClock), and a read of the box that
// waits for the end of the event's slot, so every event of the slot is in
// it. The read itself is a fake that records what it was asked.
import { assert, describe, it } from "@effect/vitest";
import {
  ConfigProvider,
  DateTime,
  Duration,
  Effect,
  Layer,
  Metric,
  Option,
  Ref,
} from "effect";
import { MessageStorage, Sharding } from "effect/cluster";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";
import { HttpRouter, HttpServerRequest } from "effect/http";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import {
  platformEvents,
  PlatformEventsLive,
} from "#app/platform-events/route.ts";
import { DrizzleChannelDirectory } from "#channels/infrastructure/drizzle-channel-directory.ts";
import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { ReceiveMessageEvents } from "#engagement/application/receive-message-events.ts";
import { followBox, recordBoxRead } from "#engagement/domain/message-box.ts";
import { ChannelsMessageAccounts } from "#engagement/infrastructure/channels-message-accounts.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { WorkflowMessageJobs } from "#engagement/infrastructure/workflow-message-jobs.ts";
import { ReadMessageBoxV1Live } from "#engagement/infrastructure/workflows/read-message-box.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import { DatabaseTest } from "#test/channels/support.ts";
import {
  clusterOver,
  eventually,
} from "#test/publishing/infrastructure/harness.ts";
import { seedChannel } from "#test/workspace/integration/seed.ts";

const mainSecret = "synthetic-meta-app-secret-taken";
const instagramSecret = "synthetic-instagram-app-secret-taken";

const settings = ConfigProvider.layerAdd(
  ConfigProvider.fromUnknown({
    INSTAGRAM_APP_ID: "1002",
    INSTAGRAM_APP_SECRET: instagramSecret,
    META_APP_ID: "1001",
    META_APP_SECRET: mainSecret,
    META_WEBHOOK_VERIFY_TOKEN: "synthetic-verify-token-for-taken-events-01",
  }),
  { asPrimary: true }
);

// The boxes the job was asked to read, in order.
const reads = Ref.makeUnsafe<readonly ChannelId[]>([]);

const RecordedReads = Layer.succeed(
  CollectMessages,
  CollectMessages.of({
    readBox: (channelId) =>
      Ref.update(reads, (read) => [...read, channelId]).pipe(
        Effect.as("read" as const)
      ),
    run: () => Effect.die("not used by the events"),
  })
);

// The route over the engagement adapters on Postgres, and `store` for the
// boxes, with the job registered on the cluster.
const serverWith = <E, R>(
  accounts: Layer.Layer<MessageChannelsOfAccount, E, R>
) =>
  Layer.mergeAll(
    ReceiveMessageEvents.layer.pipe(
      Layer.provide(
        Layer.mergeAll(DrizzleMessageStore, accounts, WorkflowMessageJobs)
      )
    ),
    DrizzleMessageStore,
    ReadMessageBoxV1Live.pipe(Layer.provide(RecordedReads))
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(IdsLive, TransactionRunnerLive)),
    Layer.provideMerge(clusterOver(MessageStorage.layerMemory)),
    Layer.provideMerge(DatabaseTest),
    Layer.provide(settings)
  );

const Server = serverWith(
  ChannelsMessageAccounts.pipe(Layer.provide(DrizzleChannelDirectory))
);

// A database that refuses the account's lookup.
const ServerWithoutDatabase = serverWith(
  Layer.succeed(
    MessageChannelsOfAccount,
    MessageChannelsOfAccount.of({
      channelsOf: () =>
        Effect.fail(new DatabaseError({ cause: "synthetic outage" })),
    })
  )
);

const encoder = new TextEncoder();

const signatureOf = (secret: string, body: Uint8Array) =>
  Effect.gen(function* signing() {
    const mac = yield* Mac.Mac;
    const key = yield* Mac.key(Mac.hmacSha256, encoder.encode(secret));

    return `sha256=${Hex.encode(yield* mac.sign(key, body))}`;
  }).pipe(
    Effect.provide(
      Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
    ),
    Effect.orDie
  );

const pageEvent = (pageId: string) =>
  encoder.encode(
    JSON.stringify({
      entry: [
        {
          id: pageId,
          messaging: [{ message: { mid: "m_synthetic_taken" } }],
        },
      ],
      object: "page",
    })
  );

// The route, run here, on the test's clock and services.
const post = (app: string, body: Uint8Array, secret: string) =>
  Effect.gen(function* posting() {
    const handle = yield* HttpRouter.toHttpEffect(
      PlatformEventsLive.pipe(Layer.provide(settings))
    );

    const request = HttpServerRequest.fromWeb(
      new Request(`http://localhost/api/platform-events/meta/${app}`, {
        body: new Uint8Array(body),
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": yield* signatureOf(secret, body),
        },
        method: "POST",
      })
    );

    const response = yield* handle.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request)
    );

    return response.status;
  }).pipe(Effect.scoped);

const counted = (app: string, outcome: string) =>
  Metric.value(Metric.withAttributes(platformEvents, { app, outcome })).pipe(
    Effect.map(({ count }) => count)
  );

// Two workspaces that connected the same Page, each with its messages on
// and its box read a moment ago, due again in an hour.
const connectedPage = (at: DateTime.Utc) =>
  Effect.gen(function* connecting() {
    const sql = yield* SqlClient.SqlClient;
    const store = yield* MessageStore;
    const page = `synthetic-page-${crypto.randomUUID()}`;

    const workspaces: WorkspaceId[] = [
      WorkspaceIdSchema.make(crypto.randomUUID()),
      WorkspaceIdSchema.make(crypto.randomUUID()),
    ];

    const channels: ChannelId[] = [];

    for (const workspaceId of workspaces) {
      const channelId = ChannelIdSchema.make(
        yield* seedChannel(workspaceId, "Page", { platform: "facebook" })
      );

      yield* sql`UPDATE channels.channels SET account_id = ${page} WHERE id = ${channelId}`;

      const box = followBox({ channelId, workspaceId }, at);

      yield* store.follow([box]);
      yield* store.saveBox(recordBoxRead(box, Option.none(), at, at));
      channels.push(channelId);
    }

    yield* Effect.addFinalizer(() =>
      Effect.forEach(
        workspaces,
        (workspaceId) =>
          Effect.all([
            sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
            sql`DELETE FROM channels.channels WHERE workspace_id = ${workspaceId}`,
          ]),
        { discard: true }
      ).pipe(Effect.orDie)
    );

    return { channels, page };
  }).pipe(Effect.orDie);

const nextReadOf = (channelId: ChannelId) =>
  MessageStore.use((store) => store.box(channelId)).pipe(
    Effect.map(Option.map((box) => DateTime.formatIso(box.nextReadAt))),
    Effect.orDie
  );

// Lets the cluster work at this instant, for checks that nothing happened.
const settle = Effect.gen(function* settling() {
  const sharding = yield* Sharding.Sharding;

  for (let round = 0; round < 10; round += 1) {
    yield* sharding.pollStorage;
    yield* TestClock.withLive(Effect.sleep(Duration.millis(20)));
  }
});

// Three seconds into a slot of ten.
const start = DateTime.makeUnsafe("2049-03-01T10:00:03.000Z");

const atStart = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(DateTime.toEpochMillis(start)).pipe(Effect.andThen(effect));

describe("Meta's events for a Page Peal holds", () => {
  it.effect(
    "bring both workspaces' boxes forward and read each once, after the slot's last event",
    () =>
      atStart(
        Effect.gen(function* taken() {
          yield* Ref.set(reads, []);

          const { channels, page } = yield* connectedPage(
            DateTime.subtractDuration(start, Duration.minutes(1))
          );

          const before = yield* counted("facebook", "taken");
          const body = pageEvent(page);

          assert.strictEqual(yield* post("facebook", body, mainSecret), 200);

          for (const channelId of channels) {
            assert.deepStrictEqual(
              yield* nextReadOf(channelId),
              Option.some("2049-03-01T10:00:03.000Z")
            );
          }

          // A second message four seconds later, in the same slot.
          yield* TestClock.adjust(Duration.seconds(4));

          assert.strictEqual(yield* post("facebook", body, mainSecret), 200);
          assert.strictEqual((yield* counted("facebook", "taken")) - before, 2);

          // Not before the slot ends, so the second event is in the read.
          yield* TestClock.adjust(Duration.seconds(2));
          yield* settle;

          assert.deepStrictEqual(yield* Ref.get(reads), []);

          yield* TestClock.adjust(Duration.seconds(2));

          yield* eventually(
            "each box is read",
            Ref.get(reads).pipe(Effect.map((read) => read.length >= 2))
          );

          // Once a box: the second event started nothing new.
          yield* TestClock.adjust(Duration.seconds(30));
          yield* settle;

          assert.deepStrictEqual(
            (yield* Ref.get(reads)).toSorted(),
            channels.toSorted()
          );
        }).pipe(Effect.scoped, Effect.provide(Server))
      ),
    { timeout: 60_000 }
  );

  it.effect("are not taken from Instagram Login's app for a Page", () =>
    atStart(
      Effect.gen(function* notMeant() {
        yield* Ref.set(reads, []);

        const { channels, page } = yield* connectedPage(
          DateTime.subtractDuration(start, Duration.minutes(1))
        );

        assert.strictEqual(
          yield* post("instagram", pageEvent(page), instagramSecret),
          200
        );

        for (const channelId of channels) {
          assert.deepStrictEqual(
            yield* nextReadOf(channelId),
            Option.some("2049-03-01T10:59:03.000Z")
          );
        }
      }).pipe(Effect.scoped, Effect.provide(Server))
    )
  );

  it.effect(
    "answer 503 when the database fails, so Meta sends them again",
    () =>
      atStart(
        Effect.gen(function* outage() {
          assert.strictEqual(
            yield* post(
              "facebook",
              pageEvent("synthetic-page-outage"),
              mainSecret
            ),
            503
          );
        }).pipe(Effect.provide(ServerWithoutDatabase))
      )
  );
});
