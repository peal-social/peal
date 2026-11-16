import { assert, layer } from "@effect/vitest";
import { Context, Effect, Layer, Option, Redacted, Ref } from "effect";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { DrizzleChannelRecords } from "#channels/infrastructure/drizzle-channel-records.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  TokenCipherTest,
} from "#test/channels/support.ts";

// A workspace about to be erased lets go, with each channel's tokens,
// what its channels set up on their platforms for Peal (Meta's message
// events), every channel of the workspace counted as leaving with it.

class Departed extends Context.Service<Departed, Ref.Ref<readonly string[]>>()(
  "test/Departed"
) {}

const RecordedDepartures = Layer.effect(
  ChannelDepartures,
  Effect.gen(function* RecordedDepartures() {
    const departed = yield* Departed;

    return ChannelDepartures.of({
      departed: (channel, tokens, leaving = []) =>
        Ref.update(departed, (all) => [
          ...all,
          `${channel.id}:${Redacted.value(tokens.accessToken)}:${String(leaving.length)}`,
        ]),
    });
  })
);

const RecordsTest = DrizzleChannelRecords.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      DrizzleChannelRepository,
      TokenCipherTest,
      RecordedDepartures
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

layer(RecordsTest)("a workspace about to be erased", (it) => {
  it.effect(
    "lets each channel's platform go with its token, the others leaving with it",
    () =>
      Effect.gen(function* releases() {
        const workspaceId = yield* freshWorkspace;
        const page = yield* connected(workspaceId, "facebook");
        const status = yield* connected(workspaceId, "mastodon");

        yield* connected(yield* freshWorkspace, "facebook");

        yield* ChannelRecords.use((records) =>
          records.releaseWorkspace(workspaceId)
        );

        assert.deepStrictEqual(
          (yield* Departed.use(Ref.get)).toSorted(),
          [
            `${page.id}:synthetic-token-${page.id}:2`,
            `${status.id}:synthetic-token-${status.id}:2`,
          ].toSorted()
        );
      })
  );
});
