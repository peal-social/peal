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
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type { PlatformAuthorizer } from "#channels/application/platform-authorizer.ts";
import type { Channel } from "#channels/domain/channel.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import {
  channelsLeftSubscribed,
  DrizzleChannelRecords,
  releaseLimit,
  releaseWait,
} from "#channels/infrastructure/drizzle-channel-records.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { authorizersOf } from "#test/channels/connect-support.ts";
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
// by the end is logged by its id, its platform and its account's id there
// (a Page's, an Instagram account's), and counted.

// The departures begun, and those that ended, and the tokens a platform
// was asked to revoke.
class Departures extends Context.Service<
  Departures,
  {
    readonly started: Ref.Ref<readonly string[]>;
    readonly finished: Ref.Ref<readonly string[]>;
    readonly revoked: Ref.Ref<readonly string[]>;
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

// TikTok, which takes a revoke, answering as `platform` says.
const revokingTikTok = (platform: Platform) =>
  Layer.effect(
    PlatformAuthorizers,
    Effect.gen(function* RevokingTikTok() {
      const { revoked } = yield* Departures;

      const answer: Effect.Effect<void> = {
        answering: Effect.void,
        refusing: Effect.void,
        silent: Effect.never,
        slow: Effect.sleep("15 seconds"),
      }[platform];

      const tiktok: PlatformAuthorizer = {
        begin: () => Effect.die("TikTok is never asked to connect"),
        complete: () => Effect.die("TikTok is never asked to connect"),
        platform: "tiktok",
        policy: tokenPolicies.tiktok,
        refresh: () => Effect.die("TikTok is never asked to refresh"),
        revoke: (tokens) =>
          answer.pipe(
            Effect.andThen(
              Ref.update(revoked, (all) => [
                ...all,
                Redacted.value(tokens.accessToken),
              ])
            )
          ),
      };

      // Google's: one grant for every location of a user, never revoked.
      const google: PlatformAuthorizer = {
        ...tiktok,
        platform: "googleBusiness",
        policy: tokenPolicies.googleBusiness,
      };

      return authorizersOf(tiktok, google);
    })
  );

const recordsTest = (platform: Platform) =>
  DrizzleChannelRecords.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        DrizzleChannelRepository,
        TokenCipherTest,
        recordedDepartures(platform),
        revokingTikTok(platform)
      )
    ),
    Layer.provideMerge(
      Layer.effect(
        Departures,
        Effect.all({
          finished: Ref.make<readonly string[]>([]),
          revoked: Ref.make<readonly string[]>([]),
          started: Ref.make<readonly string[]>([]),
        })
      )
    ),
    Layer.provideMerge(DatabaseTest)
  );

// A channel of the workspace with a token of its own.
const connected = Effect.fn("connected")(function* connected(
  workspaceId: WorkspaceId,
  platform: "facebook" | "googleBusiness" | "mastodon" | "tiktok",
  accountId?: string
) {
  const channel = yield* freshChannel(workspaceId, { accountId, platform });

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

// Twelve channels of two workspaces, about to be erased, and how a line
// names each: its id, its platform and its account's id there.
const twelve = Effect.gen(function* twelve() {
  const workspaceId = yield* freshWorkspace;
  const otherId = yield* freshWorkspace;
  const all: Channel[] = [];

  for (let n = 0; n < 6; n += 1) {
    all.push(
      yield* connected(workspaceId, "facebook"),
      yield* connected(otherId, "facebook")
    );
  }

  return {
    ids: all.map(({ id }) => id),
    named: all.map(
      ({ accountId, id, platform }) => `${id}:${platform}:${accountId}`
    ),
    workspaceIds: [workspaceId, otherId],
  };
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

// The lines that name a channel left subscribed: its id, its platform and
// its account's id there, then everything else the line holds.
const capture = (lines: string[]) =>
  Logger.layer([
    Logger.make(({ fiber, message }) => {
      const annotations = fiber.getRef(References.CurrentLogAnnotations);
      const { accountId, channelId, platform } = annotations;

      if (JSON.stringify(message).includes("still sends")) {
        lines.push(
          [
            String(channelId),
            String(platform),
            String(accountId),
            JSON.stringify(message),
            JSON.stringify(annotations),
          ].join(":")
        );
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

  it.effect(
    "have each platform that takes it revoke the grant, unless a channel staying shares the account",
    () =>
      Effect.gen(function* revokes() {
        const workspaceId = yield* freshWorkspace;
        const otherId = yield* freshWorkspace;
        const keeperId = yield* freshWorkspace;
        const alone = yield* connected(workspaceId, "tiktok");

        // A location whose grant the user's other locations share.
        yield* connected(workspaceId, "googleBusiness");
        const shared = yield* connected(workspaceId, "tiktok");
        const bothLeaving = yield* connected(workspaceId, "tiktok");

        // The same account, in a workspace that stays and in one that goes.
        yield* connected(keeperId, "tiktok", shared.accountId);

        const alsoLeaving = yield* connected(
          otherId,
          "tiktok",
          bothLeaving.accountId
        );

        yield* ChannelRecords.use((records) =>
          records.releaseWorkspaces([workspaceId, otherId])
        );

        assert.deepStrictEqual(
          (yield* Departures.use(({ revoked }) => Ref.get(revoked))).toSorted(),
          [
            `synthetic-token-${alone.id}`,
            `synthetic-token-${bothLeaving.id}`,
            `synthetic-token-${alsoLeaving.id}`,
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
          const { ids, named, workspaceIds } = yield* twelve;
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
          // Each by its id, its platform and its account's id there, which
          // the operator needs once the channel is gone.
          assert.deepStrictEqual(
            lines
              .map((line) => line.split(":").slice(0, 3).join(":"))
              .toSorted(),
            named.toSorted()
          );
          // Never its token.
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
