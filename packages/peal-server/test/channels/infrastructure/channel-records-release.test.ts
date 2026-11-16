import { setTimeout as delay } from "node:timers/promises";

import { assert, layer } from "@effect/vitest";
import { Context, Effect, Fiber, Layer, Option, Redacted, Ref } from "effect";
import { TestClock } from "effect/testing";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import {
  DrizzleChannelRecords,
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
// events), every channel of them counted as leaving with it: side by side,
// under one bound for them all, so an erasure never waits on a platform
// once a channel.

class Departed extends Context.Service<Departed, Ref.Ref<readonly string[]>>()(
  "test/Departed"
) {}

const recordedDepartures = (answering: boolean) =>
  Layer.effect(
    ChannelDepartures,
    Effect.gen(function* RecordedDepartures() {
      const departed = yield* Departed;

      return ChannelDepartures.of({
        departed: (channel, tokens, leaving = []) =>
          Ref.update(departed, (all) => [
            ...all,
            `${channel.id}:${Redacted.value(tokens.accessToken)}:${String(leaving.length)}`,
          ]).pipe(
            // A platform that never answers.
            Effect.andThen(answering ? Effect.void : Effect.never)
          ),
      });
    })
  );

const recordsTest = (answering: boolean) =>
  DrizzleChannelRecords.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        DrizzleChannelRepository,
        TokenCipherTest,
        recordedDepartures(answering)
      )
    ),
    Layer.provideMerge(Layer.effect(Departed, Ref.make<readonly string[]>([]))),
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

layer(recordsTest(true))("workspaces about to be erased", (it) => {
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
          (yield* Departed.use(Ref.get)).toSorted(),
          [
            `${page.id}:synthetic-token-${page.id}:3`,
            `${status.id}:synthetic-token-${status.id}:3`,
            `${theirs.id}:synthetic-token-${theirs.id}:3`,
          ].toSorted()
        );
      })
  );
});

layer(recordsTest(false))(
  "workspaces about to be erased, their platform silent",
  (it) => {
    it.effect(
      "let their channels go side by side, and wait on the platform once for them all",
      () =>
        Effect.gen(function* bounded() {
          const workspaceId = yield* freshWorkspace;
          const otherId = yield* freshWorkspace;

          for (let n = 0; n < 6; n += 1) {
            yield* connected(workspaceId, "facebook");
            yield* connected(otherId, "facebook");
          }

          const releasing = yield* ChannelRecords.use((records) =>
            records.releaseWorkspaces([workspaceId, otherId])
          ).pipe(Effect.forkChild);

          const started = Departed.use(Ref.get).pipe(
            Effect.map((all) => all.length)
          );

          // Eight at once, none of them answered.
          for (let tries = 0; tries < 250 && (yield* started) < 8; tries += 1) {
            yield* Effect.promise(async () => {
              await delay(10);
            });
          }

          assert.strictEqual(yield* started, 8);

          // One bound for them all: the erasure goes on.
          yield* TestClock.adjust(releaseWait);
          yield* Fiber.join(releasing);

          assert.strictEqual(yield* started, 8);
        })
    );
  }
);
