import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted, Ref } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import {
  Api,
  ChannelNotFound,
  ChatNotConnected,
  ConnectFailed,
  Forbidden,
  OAuthClientNotPublished,
  SiteNotConnected,
  forWorkspace,
} from "peal-contract";
import type { Member } from "peal-contract";

import {
  ChannelOAuthHandlers,
  ChannelsHandlers,
} from "#channels/api/channels.ts";
import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { ChannelSettings } from "#channels/application/channel-settings.ts";
import { ChatRefused } from "#channels/application/chat-refused.ts";
import { ChatVerifier } from "#channels/application/chat-verifier.ts";
import { DisconnectChannel } from "#channels/application/disconnect-channel.ts";
import { ListChannels } from "#channels/application/list-channels.ts";
import { OAuthClientDocuments } from "#channels/application/oauth-client-documents.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type { AuthorizationRequest } from "#channels/application/platform-authorizer.ts";
import type { TokenLifetime } from "#channels/domain/channel.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  MastodonAuthorizersTest,
  MastodonConnectTest,
  authorizersOf,
  chatsOn,
  chatsWith,
  connectChannelWith,
  mastodonInstance,
  WordPressSitesTest,
} from "#test/channels/connect-support.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import {
  freshChannel,
  freshWorkspace,
  memberOf,
  nonRefreshable,
  OpenOutboundGuard,
  refreshable,
  syntheticCredentials,
} from "#test/channels/support.ts";
import { TransactionsTest } from "#test/notifications/support.ts";
import {
  anonymousSecurityTest,
  securityTest,
} from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The chats as their platforms answer: a Discord webhook's address names
// channel 300 of guild 200, unless it names none; a Telegram bot reaches
// its chat.
const ChatsTest = chatsWith(
  Layer.succeed(
    ChatVerifier,
    ChatVerifier.of({
      verify: (signIn) => {
        if (
          signIn.platform === "discord" &&
          !Redacted.value(signIn.webhookUrl).includes("/webhooks/")
        ) {
          return Effect.fail(new ChatRefused({ reason: "addressNotAWebhook" }));
        }

        return Effect.succeed({
          accountId: signIn.platform === "discord" ? "200/300" : "-100500",
          displayName: Option.some("Synthetic news"),
          handle: "Synthetic news",
          platform: signIn.platform,
          secret:
            signIn.platform === "discord"
              ? Redacted.make("1/synthetic-token")
              : signIn.botToken,
        });
      },
    })
  )
);

const UseCasesTest = Layer.mergeAll(
  ListChannels.layer,
  ChannelSettings.layer,
  DisconnectChannel.layer.pipe(Layer.provide(ChannelDepartures.none)),
  WordPressSitesTest,
  ChatsTest
).pipe(
  Layer.provideMerge(TransactionsTest),
  Layer.provideMerge(MastodonConnectTest)
);

// A client of the channels endpoints whose every request acts as the member,
// as the WorkspaceAccess middleware would hand them to the handlers.
const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["channels"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        ChannelsHandlers.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

const owner = (workspaceId: WorkspaceId) =>
  memberOf(workspaceId, permissionsFor("owner"));

// Reads channels, and may not disconnect them.
const viewer = (workspaceId: WorkspaceId) =>
  memberOf(workspaceId, permissionsFor("viewer"));

// May do nothing with channels.
const postReader = (workspaceId: WorkspaceId) =>
  memberOf(workspaceId, ["post:read"]);

const connected = Effect.fn("connected")(function* connected(
  workspaceId: WorkspaceId,
  token: TokenLifetime = nonRefreshable
) {
  const channel = yield* freshChannel(workspaceId, { token });

  yield* ChannelRepository.use((channels) =>
    channels.insert(channel, syntheticCredentials(channel))
  );

  return channel;
});

const channelIdsOf = Effect.fn("channelIdsOf")(function* channelIdsOf(
  workspaceId: WorkspaceId
) {
  const channels = yield* ChannelRepository.use((repository) =>
    repository.list(workspaceId)
  );

  return channels.map((channel) => channel.id);
});

layer(UseCasesTest)("the channels endpoints", (it) => {
  it.effect("list the member's channels, without their tokens", () =>
    Effect.gen(function* lists() {
      const workspaceId = yield* freshWorkspace;
      const expiring = yield* connected(workspaceId);
      const renewing = yield* connected(workspaceId, refreshable);
      const client = yield* clientAs(owner(workspaceId));
      const headers = forWorkspace(workspaceId);

      const listed = yield* client.channels.list({ headers });

      assert.deepStrictEqual(listed, [
        {
          avatarUrl: `https://social.example/avatars/${expiring.id}.png`,
          connection: null,
          displayName: "Peal Example",
          handle: "@peal_example",
          id: expiring.id,
          label: null,
          platform: "mastodon",
          status: { _tag: "active" },
          tokenExpiresAt: DateTime.makeUnsafe("2026-08-14T07:00:00.123Z"),
        },
        {
          avatarUrl: `https://social.example/avatars/${renewing.id}.png`,
          connection: null,
          displayName: "Peal Example",
          handle: "@peal_example",
          id: renewing.id,
          label: null,
          platform: "mastodon",
          status: { _tag: "active" },
          tokenExpiresAt: null,
        },
      ]);

      const response = yield* client.channels.list({
        headers,
        responseMode: "response-only",
      });

      const body = yield* response.text;

      assert.notInclude(body, "synthetic-iv");
      assert.notInclude(body, "scopes");
      assert.notInclude(body, expiring.accountId);
    })
  );

  it.effect("let a viewer read the channels", () =>
    Effect.gen(function* viewerLists() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const client = yield* clientAs(viewer(workspaceId));

      const listed = yield* client.channels.list({
        headers: forWorkspace(workspaceId),
      });

      assert.deepStrictEqual(
        listed.map(({ id }) => id),
        [channel.id]
      );
    })
  );

  it.effect("answer 403 to a member without channel:read", () =>
    Effect.gen(function* forbidden() {
      const workspaceId = yield* freshWorkspace;

      yield* connected(workspaceId);

      const client = yield* clientAs(postReader(workspaceId));
      const headers = forWorkspace(workspaceId);

      assert.instanceOf(
        yield* Effect.flip(client.channels.list({ headers })),
        Forbidden
      );

      const response = yield* client.channels.list({
        headers,
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 403);
    })
  );

  it.effect(
    "show a member only their own workspace's channels, whatever the path",
    () =>
      Effect.gen(function* otherWorkspace() {
        const theirs = yield* freshWorkspace;
        const mine = yield* freshWorkspace;
        const channel = yield* connected(mine);

        yield* connected(theirs);

        const client = yield* clientAs(owner(mine));

        const listed = yield* client.channels.list({
          headers: forWorkspace(theirs),
        });

        assert.deepStrictEqual(
          listed.map(({ id }) => id),
          [channel.id]
        );
      })
  );

  it.effect("disconnect a channel, answering 204", () =>
    Effect.gen(function* disconnects() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const kept = yield* connected(workspaceId);
      const client = yield* clientAs(owner(workspaceId));
      const params = { channelId: channel.id };

      const response = yield* client.channels.disconnect({
        headers: forWorkspace(workspaceId),
        params,
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 204);
      assert.deepStrictEqual(yield* channelIdsOf(workspaceId), [kept.id]);
    })
  );

  it.effect.each([
    { channelId: "00000000-0000-7000-8000-00000000abcd", label: "no channel" },
    { channelId: "not-a-channel-id", label: "no channel id" },
  ])("answer 404 to the disconnection of $label", ({ channelId }) =>
    Effect.gen(function* notFound() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));
      const params = { channelId };

      assert.instanceOf(
        yield* Effect.flip(
          client.channels.disconnect({
            headers: forWorkspace(workspaceId),
            params,
          })
        ),
        ChannelNotFound
      );

      const response = yield* client.channels.disconnect({
        headers: forWorkspace(workspaceId),
        params,
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 404);
    })
  );

  it.effect(
    "answer 404 to the disconnection of another workspace's channel",
    () =>
      Effect.gen(function* otherWorkspace() {
        const theirs = yield* freshWorkspace;
        const channel = yield* connected(theirs);
        const mine = yield* freshWorkspace;
        const client = yield* clientAs(owner(mine));

        const error = yield* Effect.flip(
          client.channels.disconnect({
            headers: forWorkspace(theirs),
            params: { channelId: channel.id },
          })
        );

        assert.instanceOf(error, ChannelNotFound);
        assert.deepStrictEqual(yield* channelIdsOf(theirs), [channel.id]);
      })
  );

  it.effect("answer 403 to a member without channel:disconnect", () =>
    Effect.gen(function* forbidden() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const params = { channelId: channel.id };

      for (const member of [viewer(workspaceId), postReader(workspaceId)]) {
        const client = yield* clientAs(member);

        assert.instanceOf(
          yield* Effect.flip(
            client.channels.disconnect({
              headers: forWorkspace(workspaceId),
              params,
            })
          ),
          Forbidden
        );
      }

      assert.deepStrictEqual(yield* channelIdsOf(workspaceId), [channel.id]);
    })
  );

  it.effect("connect a Mastodon account through the callback", () =>
    Effect.gen(function* connects() {
      const instance = yield* mastodonInstance();
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));
      const params = { platform: "mastodon" as const };

      const { authorizationUrl } = yield* client.channels.connect({
        headers: forWorkspace(workspaceId),
        params,
        payload: { instance: instance.url },
      });

      const back = instance.approve(authorizationUrl);

      const outcome = yield* client.channels.completeConnect({
        headers: forWorkspace(workspaceId),
        params,
        payload: { code: back.code, state: back.state },
      });

      assert(outcome._tag === "connected");

      const { channel } = outcome;

      assert.strictEqual(channel.platform, "mastodon");
      assert.strictEqual(
        channel.handle,
        `@alice@${new URL(instance.url).host}`
      );
      assert.deepStrictEqual(channel.status, { _tag: "active" });
      assert.isNull(channel.tokenExpiresAt);
      assert.deepStrictEqual(yield* channelIdsOf(workspaceId), [channel.id]);
    }).pipe(Effect.scoped)
  );

  it.effect("answer 422 invalidState to a callback for no connection", () =>
    Effect.gen(function* badState() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));

      const request = {
        headers: forWorkspace(workspaceId),
        params: { platform: "mastodon" as const },
        payload: { code: "code-1", state: "made-up" },
      };

      const error = yield* Effect.flip(
        client.channels.completeConnect(request)
      );

      assert.instanceOf(error, ConnectFailed);
      assert.strictEqual(error.reason, "invalidState");

      const response = yield* client.channels.completeConnect({
        ...request,
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 422);
    })
  );

  it.effect(
    "list the platforms the server connects, to those who connect",
    () =>
      Effect.gen(function* platforms() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);

        const listed = yield* (yield* clientAs(
          owner(workspaceId)
        )).channels.platforms({ headers });

        assert.deepStrictEqual(listed, {
          // The chats connect with a secret, never a sign-in: apart from
          // the platforms a client starts a sign-in for.
          chats: ["discord", "telegram"],
          instagramConnections: [],
          linkedinConnections: [],
          platforms: ["mastodon"],
          // Without WordPress.com's app, the websites by address and key.
          sites: ["wordpress", "devto", "hashnode"],
        });

        const refused = yield* Effect.flip(
          (yield* clientAs(viewer(workspaceId))).channels.platforms({ headers })
        );

        assert.instanceOf(refused, Forbidden);
      })
  );

  it.effect("connect a website, and say why one is refused", () =>
    Effect.gen(function* website() {
      const site = yield* fakeWordPress();
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));
      const headers = forWorkspace(workspaceId);

      const channel = yield* client.channels.connectSite({
        headers,
        payload: {
          address: site.home,
          applicationPassword: editor.password,
          platform: "wordpress",
          userName: editor.login,
        },
      });

      assert.strictEqual(channel.platform, "wordpress");
      assert.strictEqual(channel.displayName, "Synthetic Garden Journal");

      const refused = yield* Effect.flip(
        client.channels.connectSite({
          headers,
          payload: {
            address: site.home,
            applicationPassword: "synthetic wrong",
            platform: "wordpress",
            userName: editor.login,
          },
        })
      );

      assert.instanceOf(refused, SiteNotConnected);
      assert.strictEqual(refused.reason, "credentialsRefused");

      const forbidden = yield* Effect.flip(
        (yield* clientAs(viewer(workspaceId))).channels.connectSite({
          headers,
          payload: {
            address: site.home,
            applicationPassword: editor.password,
            platform: "wordpress",
            userName: editor.login,
          },
        })
      );

      assert.instanceOf(forbidden, Forbidden);
    })
  );

  it.effect("connect a chat with its secret, and say why one is refused", () =>
    Effect.gen(function* chat() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));
      const headers = forWorkspace(workspaceId);

      const discord = yield* client.channels.connectChat({
        headers,
        payload: {
          platform: "discord",
          webhookUrl: "https://discord.com/api/webhooks/1/synthetic-token",
        },
      });

      assert.strictEqual(discord.platform, "discord");
      assert.strictEqual(discord.handle, "Synthetic news");

      const telegram = yield* client.channels.connectChat({
        headers,
        payload: {
          botToken: "1:synthetic-token",
          chat: "@synthetic_news",
          platform: "telegram",
        },
      });

      assert.strictEqual(telegram.platform, "telegram");

      // The same chat again reconnects its channel, by name or not.
      const again = yield* client.channels.connectChat({
        headers,
        payload: {
          channelId: discord.id,
          platform: "discord",
          webhookUrl: "https://discord.com/api/webhooks/2/synthetic-token",
        },
      });

      assert.strictEqual(again.id, discord.id);

      const refused = yield* Effect.flip(
        client.channels.connectChat({
          headers,
          payload: { platform: "discord", webhookUrl: "synthetic-address" },
        })
      );

      assert.instanceOf(refused, ChatNotConnected);
      assert.strictEqual(refused.reason, "addressNotAWebhook");

      // A channel id that is none of the workspace's.
      for (const channelId of ["not-an-id", telegram.id]) {
        assert.instanceOf(
          yield* Effect.flip(
            client.channels.connectChat({
              headers,
              payload: {
                channelId,
                platform: "discord",
                webhookUrl: "https://discord.com/api/webhooks/1/synthetic",
              },
            })
          ),
          ChannelNotFound
        );
      }

      assert.instanceOf(
        yield* Effect.flip(
          (yield* clientAs(viewer(workspaceId))).channels.connectChat({
            headers,
            payload: {
              platform: "discord",
              webhookUrl: "https://discord.com/api/webhooks/1/synthetic-token",
            },
          })
        ),
        Forbidden
      );
    })
  );

  it.effect("refuse cleanly to start a sign-in for a chat", () =>
    Effect.gen(function* noSignIn() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));

      for (const platform of ["discord", "telegram"] as const) {
        const refused = yield* Effect.flip(
          client.channels.connect({
            headers: forWorkspace(workspaceId),
            params: { platform },
            payload: {},
          })
        );

        assert.instanceOf(refused, ConnectFailed);
        assert.strictEqual(
          refused instanceof ConnectFailed ? refused.reason : "",
          "platformNotSupported"
        );
      }
    })
  );

  it.effect("answer 422 invalidState to a choice nobody was offered", () =>
    Effect.gen(function* badChoice() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));

      const error = yield* Effect.flip(
        client.channels.chooseAccounts({
          headers: forWorkspace(workspaceId),
          params: { platform: "facebook" },
          payload: { accountIds: ["101"], selection: "made-up" },
        })
      );

      assert.instanceOf(error, ConnectFailed);
      assert.strictEqual(error.reason, "invalidState");
    })
  );

  it.effect("answer 422 with the reason a connection cannot start", () =>
    Effect.gen(function* refused() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));

      const reasons = yield* Effect.all(
        [
          client.channels.connect({
            headers: forWorkspace(workspaceId),
            params: { platform: "mastodon" },
            payload: { instance: "not a server" },
          }),
          client.channels.connect({
            headers: forWorkspace(workspaceId),
            params: { platform: "mastodon" },
            payload: {},
          }),
          client.channels.connect({
            headers: forWorkspace(workspaceId),
            params: { platform: "linkedin" },
            payload: {},
          }),
        ].map((attempt) =>
          attempt.pipe(
            Effect.flip,
            Effect.map((error) =>
              error instanceof ConnectFailed ? error.reason : error._tag
            )
          )
        )
      );

      assert.deepStrictEqual(reasons, [
        "invalidInstance",
        "invalidInstance",
        "platformNotSupported",
      ]);
    })
  );

  it.effect("answer 403 to connecting without channel:connect", () =>
    Effect.gen(function* forbidden() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(viewer(workspaceId));

      assert.instanceOf(
        yield* Effect.flip(
          client.channels.connect({
            headers: forWorkspace(workspaceId),
            params: { platform: "mastodon" },
            payload: { instance: "mastodon.example" },
          })
        ),
        Forbidden
      );
    })
  );

  it.effect(
    "take the ask for the account's direct messages on a reconnect, and go on to the platform's sign-in",
    () =>
      Effect.gen(function* asks() {
        const workspaceId = yield* freshWorkspace;
        const channel = yield* connected(workspaceId);
        const client = yield* clientAs(owner(workspaceId));

        // The test's channel lives on a server nobody answers for: the
        // request was taken, and the sign-in began.
        const failure = yield* Effect.flip(
          client.channels.reconnect({
            headers: forWorkspace(workspaceId),
            params: { channelId: channel.id },
            query: { messages: "true" },
          })
        );

        assert.strictEqual(failure._tag, "PlatformUnreachable");
      })
  );

  it.effect("answer 404 to reconnecting a channel the workspace lacks", () =>
    Effect.gen(function* missing() {
      const workspaceId = yield* freshWorkspace;
      const client = yield* clientAs(owner(workspaceId));

      assert.instanceOf(
        yield* Effect.flip(
          client.channels.reconnect({
            headers: forWorkspace(workspaceId),
            params: { channelId: "not-a-channel-id" },
            query: {},
          })
        ),
        ChannelNotFound
      );
    })
  );
});

// The client documents, for a server with and without Bluesky client keys.
const documentsClient = (documents: OAuthClientDocuments["Service"]) =>
  HttpApiTest.groups(Api, ["channelOAuth"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        ChannelOAuthHandlers.pipe(
          Layer.provide(Layer.succeed(OAuthClientDocuments, documents))
        ),
        // Nobody signs in to fetch them.
        anonymousSecurityTest,
        HttpServer.layerServices
      )
    )
  );

layer(HttpServer.layerServices)("the OAuth client documents", (it) => {
  it.effect("answer 404 on a server without client keys", () =>
    Effect.gen(function* unpublished() {
      const client = yield* documentsClient({ bluesky: Option.none() });

      assert.instanceOf(
        yield* Effect.flip(client.channelOAuth.blueskyClientMetadata()),
        OAuthClientNotPublished
      );
      assert.instanceOf(
        yield* Effect.flip(client.channelOAuth.blueskyJwks()),
        OAuthClientNotPublished
      );
    })
  );

  it.effect("publish the client's metadata and public keys", () =>
    Effect.gen(function* published() {
      const metadata = {
        application_type: "web",
        client_id:
          "https://peal.test/api/channels/oauth/bluesky/client-metadata.json",
        client_name: "Peal",
        client_uri: "https://peal.test",
        dpop_bound_access_tokens: true,
        grant_types: ["authorization_code", "refresh_token"],
        jwks_uri: "https://peal.test/api/channels/oauth/bluesky/jwks.json",
        redirect_uris: ["https://peal.test/connect/bluesky/callback"],
        response_types: ["code"],
        scope: "atproto",
        token_endpoint_auth_method: "private_key_jwt",
        token_endpoint_auth_signing_alg: "ES256",
      } as const;

      const jwks = {
        keys: [
          {
            crv: "P-256",
            kid: "k1",
            kty: "EC",
            x: "synthetic-x",
            y: "synthetic-y",
          },
        ],
      };

      const client = yield* documentsClient({
        bluesky: Option.some({ jwks, metadata }),
      });

      assert.deepStrictEqual(
        yield* client.channelOAuth.blueskyClientMetadata(),
        metadata
      );
      assert.deepStrictEqual(yield* client.channelOAuth.blueskyJwks(), jwks);
    })
  );
});

layer(UseCasesTest)("a channel's name and switch", (it) => {
  it.effect("names a channel, turns it off and back on", () =>
    Effect.gen(function* manages() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const client = yield* clientAs(owner(workspaceId));
      const params = { channelId: channel.id };

      const named = yield* client.channels.update({
        headers: forWorkspace(workspaceId),
        params,
        payload: { label: "Client A" },
      });

      assert.strictEqual(named.label, "Client A");
      // The platform's own handle and name stay.
      assert.strictEqual(named.handle, "@peal_example");
      assert.strictEqual(named.displayName, "Peal Example");

      const off = yield* client.channels.disable({
        headers: forWorkspace(workspaceId),
        params,
      });

      assert.deepStrictEqual(off.status, {
        _tag: "disabled",
        refreshNeeded: false,
      });
      assert.strictEqual(off.label, "Client A");

      const on = yield* client.channels.enable({
        headers: forWorkspace(workspaceId),
        params,
      });

      assert.deepStrictEqual(on.status, { _tag: "active" });

      const unnamed = yield* client.channels.update({
        headers: forWorkspace(workspaceId),
        params,
        payload: { label: null },
      });

      assert.isNull(unnamed.label);
    })
  );

  it.effect("is for members who manage channels", () =>
    Effect.gen(function* refuses() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const client = yield* clientAs(viewer(workspaceId));
      const params = { channelId: channel.id };

      const renamed = yield* client.channels
        .update({
          headers: forWorkspace(workspaceId),
          params,
          payload: { label: "Mine" },
        })
        .pipe(Effect.flip);

      assert.instanceOf(renamed, Forbidden);

      const off = yield* client.channels
        .disable({ headers: forWorkspace(workspaceId), params })
        .pipe(Effect.flip);

      assert.instanceOf(off, Forbidden);

      const missing = yield* (yield* clientAs(owner(workspaceId))).channels
        .enable({
          headers: forWorkspace(workspaceId),
          params: { channelId: "not-an-id" },
        })
        .pipe(Effect.flip);

      assert.instanceOf(missing, ChannelNotFound);
    })
  );
});

layer(UseCasesTest)("the channel search", (it) => {
  it.effect("pages, filters and counts by status", () =>
    Effect.gen(function* searches() {
      const workspaceId = yield* freshWorkspace;
      const first = yield* connected(workspaceId);
      const second = yield* connected(workspaceId);
      const third = yield* connected(workspaceId);
      const client = yield* clientAs(owner(workspaceId));
      const headers = forWorkspace(workspaceId);

      yield* client.channels.update({
        headers,
        params: { channelId: second.id },
        payload: { label: "Client A" },
      });
      yield* client.channels.disable({
        headers,
        params: { channelId: third.id },
      });

      const one = yield* client.channels.find({
        headers,
        query: { limit: 2 },
      });

      assert.deepStrictEqual(
        one.items.map(({ id }) => id),
        [first.id, second.id]
      );
      assert.deepStrictEqual(one.counts, {
        active: 2,
        disabled: 1,
        refreshNeeded: 0,
      });

      const two = yield* client.channels.find({
        headers,
        query: { cursor: one.nextCursor ?? "", limit: 2 },
      });

      assert.deepStrictEqual(
        two.items.map(({ id }) => id),
        [third.id]
      );
      assert.isNull(two.nextCursor);

      const named = yield* client.channels.find({
        headers,
        query: { q: "client a", status: "active" },
      });

      assert.deepStrictEqual(
        named.items.map(({ id, label }) => [id, label]),
        [[second.id, "Client A"]]
      );

      const badCursor = yield* client.channels
        .find({ headers, query: { cursor: "not-a-cursor" } })
        .pipe(Effect.flip);

      assert.strictEqual(badCursor._tag, "BadRequest");
    })
  );
});

// What the Mastodon authorizer was asked to begin, as the endpoint passed it.
const asked = Ref.makeUnsafe<readonly AuthorizationRequest[]>([]);

const RecordingAuthorizers = Layer.effect(
  PlatformAuthorizers,
  Effect.gen(function* RecordingAuthorizers() {
    const real = Option.getOrThrow(
      (yield* PlatformAuthorizers).for("mastodon")
    );

    return authorizersOf({
      ...real,
      begin: (request) =>
        Ref.update(asked, (all) => [...all, request]).pipe(
          Effect.andThen(real.begin(request))
        ),
    });
  })
).pipe(
  Layer.provide(MastodonAuthorizersTest),
  Layer.provide(OpenOutboundGuard)
);

const AskingTest = Layer.mergeAll(
  ListChannels.layer,
  ChannelSettings.layer,
  DisconnectChannel.layer.pipe(Layer.provide(ChannelDepartures.none)),
  WordPressSitesTest,
  chatsOn()
).pipe(
  Layer.provideMerge(TransactionsTest),
  Layer.provideMerge(connectChannelWith(RecordingAuthorizers))
);

layer(AskingTest)("the channels endpoints, on a reconnect", (it) => {
  it.effect("pass on the ask for reposts and for messages", () =>
    Effect.gen(function* passes() {
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(workspaceId);
      const client = yield* clientAs(owner(workspaceId));

      yield* Ref.set(asked, []);

      for (const query of [
        { reposts: "true" },
        { messages: "true" },
        {},
      ] as const) {
        yield* Effect.flip(
          client.channels.reconnect({
            headers: forWorkspace(workspaceId),
            params: { channelId: channel.id },
            query,
          })
        );
      }

      assert.deepStrictEqual(
        (yield* Ref.get(asked)).map(({ messages, reposts }) => ({
          messages,
          reposts,
        })),
        [
          { messages: false, reposts: true },
          { messages: true, reposts: false },
          { messages: false, reposts: false },
        ]
      );
    })
  );
});
