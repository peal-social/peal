import { setTimeout as delay } from "node:timers/promises";

import { assert, layer } from "@effect/vitest";
import {
  Context,
  Effect,
  Fiber,
  Layer,
  Logger,
  Metric,
  Option,
  Redacted,
  Ref,
  References,
} from "effect";
import { TestClock } from "effect/testing";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import type { DepartureOutcome } from "#channels/application/channel-departures.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import {
  channelsLeftSubscribed,
  DrizzleChannelRecords,
  releaseLimit,
  releaseWait,
} from "#channels/infrastructure/drizzle-channel-records.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  TokenCipherTest,
} from "#test/channels/support.ts";

// Workspaces about to be erased let go, with each channel's tokens, what
// their channels set up on their platforms for Peal (Meta's message
// events), every channel of them counted as leaving with it: eight side by
// side, in a fiber of their own, which the erasure waits for ten seconds
// at most and never cuts short. Each channel its platform did not let go
// by the end is logged by its id and counted.

// The departures begun, and those that ended.
class Departures extends Context.Service<
  Departures,
  {
    readonly started: Ref.Ref<readonly string[]>;
    readonly finished: Ref.Ref<readonly string[]>;
  }
>()("test/Departures") {}

/** How the platform answers a departure. */
type Platform = "answering" | "refusing" | "silent" | "slow";

const recordedDepartures = (platform: Platform) =>
  Layer.effect(
    ChannelDepartures,
    Effect.gen(function* RecordedDepartures() {
      const { finished, started: departed } = yield* Departures;

      const answer: Effect.Effect<DepartureOutcome> = {
        answering: Effect.succeed("done" as const),
        refusing: Effect.succeed("failed" as const),
        silent: Effect.never,
        // Fifteen seconds a channel: past the erasure's wait.
        slow: Effect.sleep("15 seconds").pipe(Effect.as("done" as const)),
      }[platform];

      return ChannelDepartures.of({
        departed: (channel, tokens, leaving = []) =>
          Ref.update(departed, (all) => [
            ...all,
            `${channel.id}:${Redacted.value(tokens.accessToken)}:${String(leaving.length)}`,
          ]).pipe(
            Effect.andThen(answer),
            Effect.tap(() =>
              Ref.update(finished, (all) => [...all, channel.id])
            )
          ),
      });
    })
  );

const recordsTest = (platform: Platform) =>
  DrizzleChannelRecords.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        DrizzleChannelRepository,
        TokenCipherTest,
        recordedDepartures(platform)
      )
    ),
    Layer.provideMerge(
      Layer.effect(
        Departures,
        Effect.all({
          finished: Ref.make<readonly string[]>([]),
          started: Ref.make<readonly string[]>([]),
        })
      )
    ),
    Layer.provideMerge(DatabaseTest)
  );

// A channel of the workspace with a token of its own.
const connected = Effect.fn("connected")(function* connected(
  workspaceId: WorkspaceId,
  platform: "facebook" | "mastodon"
) {
  const channel = yield* freshChannel(workspaceId, { platform });

  const credentials = yield* encryptTokens(
    {
      accessToken: Redacted.make(`synthetic-token-${channel.id}`),
      expiresAt: Option.none(),
      refreshToken: Option.none(),
      renewable: false,
      scopes: channel.scopes,
    },
    channel.id
  );

  yield* ChannelRepository.use((channels) =>
    channels.insert(channel, credentials)
  );

  return channel;
});

// Twelve channels of two workspaces, about to be erased.
const twelve = Effect.gen(function* twelve() {
  const workspaceId = yield* freshWorkspace;
  const otherId = yield* freshWorkspace;
  const ids: string[] = [];

  for (let n = 0; n < 6; n += 1) {
    ids.push(
      (yield* connected(workspaceId, "facebook")).id,
      (yield* connected(otherId, "facebook")).id
    );
  }

  return { ids, workspaceIds: [workspaceId, otherId] };
});

const started = Departures.use(({ started: begun }) => Ref.get(begun)).pipe(
  Effect.map((all) => all.length)
);

const finished = Departures.use(({ finished: ended }) => Ref.get(ended)).pipe(
  Effect.map((all) => all.length)
);

// Real time for the database, which works on its own clock, until `until`.
const settle = Effect.fnUntraced(function* settle(
  until: Effect.Effect<boolean, never, Departures>
) {
  for (let tries = 0; tries < 250 && !(yield* until); tries += 1) {
    yield* Effect.promise(async () => {
      await delay(10);
    });
  }
});

const left = Metric.value(channelsLeftSubscribed).pipe(
  Effect.map(({ count }) => count)
);

// The lines that name a channel left subscribed, by its id.
const capture = (lines: string[]) =>
  Logger.layer([
    Logger.make(({ fiber, message }) => {
      const { channelId } = fiber.getRef(References.CurrentLogAnnotations);

      if (JSON.stringify(message).includes("still sends")) {
        lines.push(`${String(channelId)}:${JSON.stringify(message)}`);
      }
    }),
  ]);

layer(recordsTest("answering"))("workspaces about to be erased", (it) => {
  it.effect(
    "let each channel's platform go with its token, the others leaving with it",
    () =>
      Effect.gen(function* releases() {
        const workspaceId = yield* freshWorkspace;
        const otherId = yield* freshWorkspace;
        const page = yield* connected(workspaceId, "facebook");
        const status = yield* connected(workspaceId, "mastodon");
        const theirs = yield* connected(otherId, "facebook");

        yield* connected(yield* freshWorkspace, "facebook");

        yield* ChannelRecords.use((records) =>
          records.releaseWorkspaces([workspaceId, otherId])
        );

        assert.deepStrictEqual(
          (yield* Departures.use(({ started: begun }) =>
            Ref.get(begun)
          )).toSorted(),
          [
            `${page.id}:synthetic-token-${page.id}:3`,
            `${status.id}:synthetic-token-${status.id}:3`,
            `${theirs.id}:synthetic-token-${theirs.id}:3`,
          ].toSorted()
        );
      })
  );
});

layer(recordsTest("slow"))(
  "workspaces about to be erased, their platform slow",
  (it) => {
    it.effect(
      "wait ten seconds at most, and let every channel go after, none cut short",
      () =>
        Effect.gen(function* slow() {
          const { workspaceIds } = yield* twelve;

          const releasing = yield* ChannelRecords.use((records) =>
            records.releaseWorkspaces(workspaceIds)
          ).pipe(Effect.forkChild);

          // Eight at once.
          yield* settle(started.pipe(Effect.map((count) => count >= 8)));
          assert.strictEqual(yield* started, 8);

          // The erasure goes on at its bound, the departures still on.
          yield* TestClock.adjust(releaseWait);
          yield* Fiber.join(releasing);

          assert.strictEqual(yield* finished, 0);

          // They end, and the four left begin, then end.
          yield* TestClock.adjust("5 seconds");
          yield* settle(started.pipe(Effect.map((count) => count >= 12)));
          yield* TestClock.adjust("15 seconds");
          yield* settle(finished.pipe(Effect.map((count) => count >= 12)));

          assert.strictEqual(yield* started, 12);
          assert.strictEqual(yield* finished, 12);
        })
    );
  }
);

layer(recordsTest("silent"))(
  "workspaces about to be erased, their platform silent",
  (it) => {
    it.effect(
      "go on at the bound, then log and count each channel still subscribed once the release's own limit passed",
      () => {
        const lines: string[] = [];

        return Effect.gen(function* silent() {
          const { ids, workspaceIds } = yield* twelve;
          const before = yield* left;

          const releasing = yield* ChannelRecords.use((records) =>
            records.releaseWorkspaces(workspaceIds)
          ).pipe(Effect.forkChild);

          yield* settle(started.pipe(Effect.map((count) => count >= 8)));

          // One bound for them all: the erasure goes on.
          yield* TestClock.adjust(releaseWait);
          yield* Fiber.join(releasing);

          assert.lengthOf(lines, 0);

          yield* TestClock.adjust(releaseLimit);
          yield* settle(
            left.pipe(Effect.map((count) => count - before >= ids.length))
          );

          assert.strictEqual((yield* left) - before, ids.length);
          assert.deepStrictEqual(
            lines.map((line) => line.split(":")[0] ?? "").toSorted(),
            ids.toSorted()
          );
          // By the channel's id alone: no token.
          assert.isFalse(
            lines.some((line) => line.includes("synthetic-token"))
          );
        }).pipe(Effect.provide(capture(lines)));
      }
    );
  }
);

layer(recordsTest("refusing"))(
  "workspaces about to be erased, their platform refusing",
  (it) => {
    it.effect("log and count each channel it did not let go", () => {
      const lines: string[] = [];

      return Effect.gen(function* refused() {
        const { ids, workspaceIds } = yield* twelve;
        const before = yield* left;

        yield* ChannelRecords.use((records) =>
          records.releaseWorkspaces(workspaceIds)
        );

        yield* settle(
          left.pipe(Effect.map((count) => count - before >= ids.length))
        );

        assert.strictEqual((yield* left) - before, ids.length);
        assert.lengthOf(lines, ids.length);
      }).pipe(Effect.provide(capture(lines)));
    });
  }
);
