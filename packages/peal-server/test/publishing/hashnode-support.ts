// What the Hashnode articles' tests share: a Hashnode publication as a
// channel of the workspace, its token sealed, and an article sent there
// on a fresh fake.
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
import {
  fakeHashnode,
  gardenBlog,
  writerOnHashnode,
} from "#test/channels/fakes/fake-hashnode.ts";
import type {
  FakeHashnode,
  FakeHashnodeOptions,
} from "#test/channels/fakes/fake-hashnode.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { testHashnodeHosts } from "#test/publishing/article-server.ts";
import {
  content,
  eventuallyLater,
  writer,
  zone,
} from "#test/publishing/article-support.ts";

/** The writer's publication as a channel of the workspace. */
export const hashnodeChannel = Effect.fn("test.hashnodeChannel")(
  function* hashnodeChannel(
    workspaceId: WorkspaceId,
    key = writerOnHashnode.token
  ) {
    const id = yield* newId(ChannelIdSchema).pipe(Effect.provide(IdsLive));

    const channel = connectChannel(
      {
        accountId: gardenBlog.id,
        avatarUrl: Option.none(),
        connection: Option.none(),
        displayName: Option.some(gardenBlog.title),
        handle: new URL(gardenBlog.url).host,
        id,
        platform: "hashnode",
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

/** A fake Hashnode, which the test server sends to from now on. */
export const startHashnode = (options: FakeHashnodeOptions = {}) =>
  fakeHashnode(options).pipe(
    Effect.tap((hashnode) =>
      Effect.sync(() => {
        testHashnodeHosts.api = hashnode.api;
      })
    )
  );

// The article, scheduled now on a fresh Hashnode's channel, once its job
// ended.
export const sentToHashnode = Effect.fn("test.sentToHashnode")(
  function* sentToHashnode(
    options: FakeHashnodeOptions = {},
    fields: Partial<ArticleContent> = {},
    prepare?: (hashnode: FakeHashnode) => void
  ) {
    const hashnode = yield* startHashnode(options);

    prepare?.(hashnode);

    const workspaceId = yield* freshWorkspace;
    const channel = yield* hashnodeChannel(workspaceId);
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

    return { actor, channelId: channel.id, hashnode, sent, workspaceId };
  }
);
