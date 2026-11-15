// What the WordPress.com articles' tests share: a site on WordPress.com
// as a channel of the workspace, its OAuth token sealed, and an article
// sent there on a fresh fake.
import { DateTime, Effect, Option, Redacted } from "effect";

import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { connectChannel } from "#channels/domain/channel.ts";
import { ArticleStore } from "#publishing/application/article-store.ts";
import { Articles } from "#publishing/application/articles.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type {
  FakeWordPress,
  FakeWordPressCom,
  FakeWordPressOptions,
} from "#test/channels/fakes/fake-wordpress.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { testWordPressComHosts } from "#test/publishing/article-server.ts";
import { content, writer, zone } from "#test/publishing/article-support.ts";
import { eventually } from "#test/publishing/infrastructure/harness.ts";

/** The site on WordPress.com the tests send to. */
export const comSite: FakeWordPressCom = {
  blogId: 2_024_001,
  code: "synthetic-code",
  token: "synthetic-wpcom-token",
};

/** The site as a channel of the workspace. */
export const comChannel = Effect.fn("test.comChannel")(function* comChannel(
  workspaceId: WorkspaceId,
  token: string = comSite.token
) {
  const id = yield* newId(ChannelIdSchema).pipe(Effect.provide(IdsLive));

  const channel = connectChannel(
    {
      accountId: String(comSite.blogId),
      avatarUrl: Option.none(),
      connection: Option.none(),
      displayName: Option.some("Synthetic Garden Journal"),
      handle: "garden.wordpress.example",
      id,
      platform: "wordpressCom",
      scopes: ["publish_posts", "upload_files"],
      token: { _tag: "nonExpiring" },
      workspaceId,
    },
    yield* DateTime.now
  );

  const credentials = yield* encryptTokens(
    {
      accessToken: Redacted.make(token),
      expiresAt: Option.none(),
      refreshToken: Option.none(),
      renewable: false,
      scopes: channel.scopes,
    },
    id
  );

  yield* ChannelRepository.use((channels) =>
    channels.insert(channel, credentials)
  );

  return channel;
});

// The article, scheduled now on a fresh WordPress.com site's channel,
// once its job ended.
export const sentToWordPressCom = Effect.fn("test.sentToWordPressCom")(
  function* sentToWordPressCom(
    options: FakeWordPressOptions = {},
    token?: string
  ) {
    const site: FakeWordPress = yield* fakeWordPress({
      ...options,
      wordpressCom: comSite,
    });

    testWordPressComHosts.api = new URL(site.home).origin;

    const workspaceId = yield* freshWorkspace;
    const channel = yield* comChannel(workspaceId, token);
    const actor = writer(workspaceId);

    const article = yield* (yield* Articles).create(
      actor,
      { channelId: channel.id, content: content() },
      Option.some({ at: Option.none(), timeZone: zone })
    );

    yield* eventually(
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

    return { actor, channelId: channel.id, sent, site, workspaceId };
  }
);
