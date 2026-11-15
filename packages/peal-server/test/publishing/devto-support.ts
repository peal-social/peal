// What the DEV articles' tests share: a DEV account as a channel of the
// workspace, its key sealed, and an article sent there on a fresh fake.
import { DateTime, Effect, Option, Redacted } from "effect";

import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { connectChannel } from "#channels/domain/channel.ts";
import { ArticleStore } from "#publishing/application/article-store.ts";
import { Articles } from "#publishing/application/articles.ts";
import type { ArticleContent } from "#publishing/domain/article-content.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { fakeDevTo, gardener } from "#test/channels/fakes/fake-devto.ts";
import type {
  FakeDevTo,
  FakeDevToOptions,
} from "#test/channels/fakes/fake-devto.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { testDevToHosts } from "#test/publishing/article-server.ts";
import {
  content,
  eventuallyLater,
  writer,
  zone,
} from "#test/publishing/article-support.ts";

/** The gardener's DEV account as a channel of the workspace. */
export const devtoChannel = Effect.fn("test.devtoChannel")(
  function* devtoChannel(workspaceId: WorkspaceId, key = gardener.key) {
    const id = yield* newId(ChannelIdSchema).pipe(Effect.provide(IdsLive));

    const channel = connectChannel(
      {
        accountId: String(gardener.id),
        avatarUrl: Option.none(),
        connection: Option.none(),
        displayName: Option.some(gardener.name),
        handle: `dev.to/${gardener.username}`,
        id,
        platform: "devto",
        scopes: [],
        token: { _tag: "nonExpiring" },
        workspaceId,
      },
      yield* DateTime.now
    );

    const credentials = yield* encryptTokens(
      {
        accessToken: Redacted.make(`${key}`),
        expiresAt: Option.none(),
        refreshToken: Option.none(),
        renewable: false,
        scopes: [],
      },
      id
    );

    yield* ChannelRepository.use((channels) =>
      channels.insert(channel, credentials)
    );

    return channel;
  }
);

/** A fake DEV, which the test server sends to from now on. */
export const startDevTo = (options: FakeDevToOptions = {}) =>
  fakeDevTo(options).pipe(
    Effect.tap((devto) =>
      Effect.sync(() => {
        testDevToHosts.api = devto.api;
      })
    )
  );

// The article, scheduled now on a fresh DEV's channel, once its job ended.
export const sentToDevTo = Effect.fn("test.sentToDevTo")(function* sentToDevTo(
  options: FakeDevToOptions = {},
  fields: Partial<ArticleContent> = {},
  prepare?: (devto: FakeDevTo) => void
) {
  const devto = yield* startDevTo(options);

  prepare?.(devto);

  const workspaceId = yield* freshWorkspace;
  const channel = yield* devtoChannel(workspaceId);
  const actor = writer(workspaceId);

  const article = yield* (yield* Articles).create(
    actor,
    {
      channelId: channel.id,
      content: content({ categories: [], ...fields }),
    },
    Option.some({ at: Option.none(), timeZone: zone })
  );

  yield* eventuallyLater(
    "the article is sent",
    ArticleStore.use((store) => store.get(article.id)).pipe(
      Effect.map((found) =>
        Option.exists(
          found,
          ({ state }) =>
            state._tag !== "scheduled" && state._tag !== "publishing"
        )
      )
    )
  );

  const sent = yield* ArticleStore.use((store) => store.get(article.id)).pipe(
    Effect.map(Option.getOrThrow)
  );

  return { actor, channelId: channel.id, devto, sent, workspaceId };
});
