import { assert, layer } from "@effect/vitest";
import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";

import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { ConnectChannel } from "#channels/application/connect-channel.ts";
import type { ConnectOutcome } from "#channels/application/connect-channel.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type { AuthorizationCallback } from "#channels/application/platform-authorizer.ts";
import { TokenCipher } from "#channels/application/token-cipher.ts";
import type { Channel } from "#channels/domain/channel.ts";
import { instagramAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-authorizer.ts";
import { instagramUnifiedAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-unified-authorizer.ts";
import { metaMessageDepartures } from "#channels/infrastructure/platforms/meta/meta-message-departures.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { instagramPageMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import type { InstagramConnection } from "#shared/domain/instagram-connection.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import {
  authorizersOf,
  connectChannelOver,
  connectChannelWith,
  connectedChannel,
  testPublicUrl,
} from "#test/channels/connect-support.ts";
import {
  fakeMeta,
  metaApp,
  systemUserId,
  unifiedConfigId,
  unifiedPermissions,
} from "#test/channels/fakes/fake-meta.ts";
import type {
  FakePage,
  FakeSharedAccount,
} from "#test/channels/fakes/fake-meta.ts";
import {
  actorIn,
  freshWorkspace,
  OpenOutboundGuard,
  RecordedNotices,
} from "#test/channels/support.ts";

// One fake Meta for the file, listing shared accounts two at a time.
class FakeMeta extends Context.Service<
  FakeMeta,
  Effect.Success<ReturnType<typeof fakeMeta>>
>()("peal-server/test/channels/UnifiedFakeMeta") {
  static readonly layer = Layer.effect(
    FakeMeta,
    fakeMeta({ sharedPageSize: 2 })
  );
}

// What Meta's sign-ins need against the fake on loopback.
const MetaServicesTest = Layer.mergeAll(
  FetchHttpClient.layer,
  OpenOutboundGuard,
  Mac.layerWebCrypto
).pipe(Layer.provideMerge(SecureRandom.layerWebCrypto));

// Instagram's ways in as the server builds them with Unified login set:
// Unified login first, then through a Page.
const UnifiedAuthorizersTest = Layer.effect(
  PlatformAuthorizers,
  Effect.gen(function* UnifiedAuthorizersTest() {
    const meta = yield* FakeMeta;
    const http = yield* publicHttpClient;

    const options = {
      app: metaApp,
      hosts: meta.hosts,
      http,
      publicUrl: testPublicUrl,
    };

    return authorizersOf(
      yield* instagramUnifiedAuthorizer({
        ...options,
        configId: unifiedConfigId,
      }),
      yield* instagramAuthorizer(options)
    );
  })
).pipe(Layer.provide(MetaServicesTest));

const UnifiedConnectTest = connectChannelWith(UnifiedAuthorizersTest).pipe(
  Layer.provideMerge(RecordedNotices.layer),
  Layer.provideMerge(FakeMeta.layer)
);

// No other channel of any account, and none reading messages.
const ChannelDirectoryTest = Layer.succeed(
  ChannelDirectory,
  ChannelDirectory.of({
    after: () => Effect.succeed([]),
    withAccount: () => Effect.succeed([]),
  })
);

const EngagementRecordsTest = Layer.succeed(
  EngagementRecords,
  EngagementRecords.of({
    channelGone: () => Effect.void,
    ensureChannelIdle: () => Effect.void,
    eraseWorkspace: () => Effect.void,
    exportCommentRules: () => Effect.succeed([]),
    exportUser: () => Effect.succeed([]),
    exportUserMessages: () => Effect.succeed([]),
    exportUserPrivateReplies: () => Effect.succeed([]),
    exportUserReviewReplies: () => Effect.succeed([]),
    forgetUser: () => Effect.void,
    postRemoved: () => Effect.void,
    readsMessages: () => Effect.succeed(false),
    refollow: () => Effect.void,
  })
);

// Meta's message events undone on the fake, on a server whose inbox reads
// Instagram's messages.
const DeparturesTest = Layer.unwrap(
  Effect.gen(function* DeparturesTest() {
    const meta = yield* FakeMeta;

    return metaMessageDepartures({
      hosts: meta.hosts,
      http: yield* publicHttpClient,
      mainApp: Option.some(metaApp),
      messages: new Set(["instagram"]),
    });
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      ChannelDirectoryTest,
      EngagementRecordsTest,
      MetaServicesTest
    )
  )
);

// ConnectChannel with those departures instead of none.
const DepartingConnectTest = Layer.fresh(ConnectChannel.layer).pipe(
  Layer.provide(DeparturesTest),
  Layer.provideMerge(UnifiedConnectTest)
);

const manager = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, ["channel:read", "channel:connect"]);

const callbackOf = (back: {
  readonly code?: string;
  readonly state: string;
}): AuthorizationCallback => ({
  code: Option.fromUndefinedOr(back.code),
  error: Option.none(),
  issuer: Option.none(),
  state: back.state,
});

const request = (connection: Option.Option<InstagramConnection>) => ({
  connection,
  handle: Option.none(),
  instance: Option.none(),
});

const account = (id: string, fields: Partial<FakeSharedAccount> = {}) => ({
  id: `178414000000${id}`,
  username: `shared_${id}`,
  ...fields,
});

// Signs in as the member would, and completes: through the server's
// first way in unless one is named.
const signIn = Effect.fn("signIn")(function* signIn(
  workspaceId: WorkspaceId,
  connection: Option.Option<InstagramConnection> = Option.none()
) {
  const meta = yield* FakeMeta;
  const connect = yield* ConnectChannel;

  const authorizationUrl = yield* connect.start(
    manager(workspaceId),
    "instagram",
    request(connection)
  );

  return yield* connect.complete(
    manager(workspaceId),
    "instagram",
    callbackOf(meta.approve(authorizationUrl))
  );
});

const choiceOf = (outcome: ConnectOutcome) =>
  outcome._tag === "choose"
    ? Effect.succeed(outcome)
    : Effect.die(new Error("Expected a choice of accounts"));

const Row = Schema.Struct({ grantedBy: Schema.NullOr(Schema.String) });

const grantorOf = (channel: Channel) =>
  SqlClient.SqlClient.use((sql) =>
    sql`SELECT granted_by AS "grantedBy" FROM channels.channels WHERE id = ${channel.id}`.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Row))),
      Effect.map(([row]) => row?.grantedBy ?? null)
    )
  );

const tokenOf = Effect.fn("tokenOf")(function* tokenOf(channel: Channel) {
  const stored = yield* ChannelRepository.use((channels) =>
    channels.credentials(channel.id)
  );

  assert(Option.isSome(stored));

  return Redacted.value(
    yield* TokenCipher.use((cipher) =>
      cipher.decrypt(stored.value.accessToken, channel.id)
    )
  );
});

layer(UnifiedConnectTest)(
  "connecting Instagram through Meta's Unified login",
  (it) => {
    it.effect(
      "opens Facebook Login for Business with the configuration, and no scope",
      () =>
        Effect.gen(function* dialog() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          const authorizationUrl = yield* ConnectChannel.use((connect) =>
            connect.start(
              manager(workspaceId),
              "instagram",
              request(Option.none())
            )
          );

          const url = new URL(authorizationUrl);
          const params = Object.fromEntries(url.searchParams);

          assert.strictEqual(url.origin, meta.url);
          assert.strictEqual(url.pathname, "/v27.0/dialog/oauth");
          assert.deepStrictEqual(Object.keys(params).toSorted(), [
            "client_id",
            "config_id",
            "override_default_response_type",
            "prompt",
            "redirect_uri",
            "response_type",
            "state",
          ]);
          assert.deepStrictEqual(
            { ...params, state: undefined },
            {
              client_id: metaApp.appId,
              config_id: unifiedConfigId,
              override_default_response_type: "true",
              prompt: "login",
              redirect_uri: "https://peal.test/connect/instagram/callback",
              response_type: "code",
              state: undefined,
            }
          );
        })
    );

    it.effect(
      "connects the one account shared, with the business's token",
      () =>
        Effect.gen(function* onlyAccount() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("01", { name: "Synthetic Studio" })],
            permissions: unifiedPermissions,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.strictEqual(channel.platform, "instagram");
          assert.strictEqual(channel.accountId, "17841400000001");
          assert.strictEqual(channel.handle, "@shared_01");
          assert.deepStrictEqual(
            channel.displayName,
            Option.some("Synthetic Studio")
          );
          assert.deepStrictEqual(
            channel.connection,
            Option.some("unifiedLogin")
          );
          assert.deepStrictEqual(channel.token, { _tag: "nonExpiring" });
          assert.deepStrictEqual(channel.scopes, [...unifiedPermissions]);
          assert.match(yield* tokenOf(channel), /^synthetic-system-user-/u);
          assert.strictEqual(yield* grantorOf(channel), systemUserId);
        })
    );

    it.effect(
      "offers every account shared, and connects those chosen with the same token",
      () =>
        Effect.gen(function* choice() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;
          const connect = yield* ConnectChannel;

          // Listed two at a time: all three come.
          meta.setUnified({
            accounts: [account("11"), account("12"), account("13")],
            permissions: unifiedPermissions,
          });

          const offered = yield* signIn(workspaceId).pipe(
            Effect.flatMap(choiceOf)
          );

          assert.deepStrictEqual(
            offered.accounts.map(({ accountId }) => accountId),
            ["17841400000011", "17841400000012", "17841400000013"]
          );

          const chosen = yield* connect.choose(
            manager(workspaceId),
            "instagram",
            {
              accountIds: ["17841400000011", "17841400000013"],
              selection: offered.selection,
            }
          );

          assert.lengthOf(chosen, 2);

          const tokens = yield* Effect.all(
            chosen.map((channel) => tokenOf(channel))
          );

          assert.strictEqual(tokens[0], tokens[1]);

          for (const channel of chosen) {
            assert.deepStrictEqual(
              channel.connection,
              Option.some("unifiedLogin")
            );
          }
        })
    );

    it.effect("answers that nothing was shared when no account is", () =>
      Effect.gen(function* nothingShared() {
        const meta = yield* FakeMeta;
        const workspaceId = yield* freshWorkspace;

        meta.setUnified({ accounts: [], permissions: unifiedPermissions });

        const failure = yield* signIn(workspaceId).pipe(Effect.flip);

        assert.strictEqual(failure._tag, "NoAccountsToConnect");
      })
    );

    it.effect("refuses a configuration that no longer grants publishing", () =>
      Effect.gen(function* withoutPublishing() {
        const meta = yield* FakeMeta;
        const workspaceId = yield* freshWorkspace;

        meta.setUnified({
          accounts: [account("21")],
          permissions: unifiedPermissions.filter(
            (permission) => permission !== "instagram_content_publish"
          ),
        });

        const failure = yield* signIn(workspaceId).pipe(Effect.flip);

        assert.strictEqual(failure._tag, "AuthorizationDenied");
      })
    );

    it.effect(
      "dates a token the configuration lets expire, which cannot be renewed",
      () =>
        Effect.gen(function* expiring() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("31")],
            expiresIn: 5_184_000,
            permissions: unifiedPermissions,
          });

          const now = yield* DateTime.now;

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.deepStrictEqual(channel.token, {
            _tag: "nonRefreshable",
            expiresAt: DateTime.addDuration(now, Duration.seconds(5_184_000)),
            issuedAt: now,
          });
        })
    );

    it.effect(
      "keeps what Meta says of an account clean before storing it",
      () =>
        Effect.gen(function* clean() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("41", { name: "Synthetic \u0000studio\uD800" })],
            permissions: unifiedPermissions,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          // No NUL, and half a surrogate pair made the replacement
          // character.
          assert.deepStrictEqual(
            channel.displayName,
            Option.some("Synthetic studio�")
          );
        })
    );

    it.effect(
      "moves a Page's Instagram channel to Unified login when its account is shared there",
      () =>
        Effect.gen(function* moves() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;
          const shared = account("51");

          meta.setPages([
            {
              id: "951",
              instagram: { id: shared.id, username: shared.username },
              name: "Synthetic Page 951",
            },
          ]);
          meta.setUnified({
            accounts: [shared],
            permissions: unifiedPermissions,
          });

          const viaPage = yield* signIn(
            workspaceId,
            Option.some("facebookLogin")
          ).pipe(Effect.flatMap(connectedChannel));

          const unified = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.strictEqual(unified.id, viaPage.id);
          assert.deepStrictEqual(
            unified.connection,
            Option.some("unifiedLogin")
          );
          assert.strictEqual(yield* grantorOf(unified), systemUserId);
          assert.lengthOf(
            yield* ChannelRepository.use((channels) =>
              channels.list(workspaceId)
            ),
            1
          );
        })
    );

    it.effect(
      "refuses a reconnect whose sign-in did not share the channel's account",
      () =>
        Effect.gen(function* mismatch() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;
          const connect = yield* ConnectChannel;

          meta.setUnified({
            accounts: [account("61")],
            permissions: unifiedPermissions,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          const authorizationUrl = yield* connect.reconnect(
            manager(workspaceId),
            channel.id
          );

          assert.strictEqual(
            new URL(authorizationUrl).searchParams.get("config_id"),
            unifiedConfigId
          );

          meta.setUnified({
            accounts: [account("62")],
            permissions: unifiedPermissions,
          });

          const failure = yield* connect
            .complete(
              manager(workspaceId),
              "instagram",
              callbackOf(meta.approve(authorizationUrl))
            )
            .pipe(Effect.flip);

          assert.strictEqual(failure._tag, "ReconnectAccountMismatch");
        })
    );

    it.effect(
      "fails a sign-in whose token debug_token says is not valid, or is another app's",
      () =>
        Effect.gen(function* debugged() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          for (const grant of [
            { debuggedValid: false },
            { debuggedAppId: "1111111111" },
          ]) {
            meta.setUnified({
              accounts: [account("91")],
              permissions: unifiedPermissions,
              ...grant,
            });

            const failure = yield* signIn(workspaceId).pipe(Effect.flip);

            assert.strictEqual(failure._tag, "AuthorizationFailed");
          }

          assert.lengthOf(
            yield* ChannelRepository.use((channels) =>
              channels.list(workspaceId)
            ),
            0
          );
        })
    );

    it.effect(
      "leaves out a shared account Meta lists without its username",
      () =>
        Effect.gen(function* withoutUsername() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("92"), { id: "17841400000093" }],
            permissions: unifiedPermissions,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.strictEqual(channel.accountId, "17841400000092");
        })
    );

    it.effect(
      "lists the shared accounts by id and username when Meta refuses their profile's fields",
      () =>
        Effect.gen(function* fallback() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("94", { name: "Synthetic Studio" })],
            permissions: unifiedPermissions,
            refusesProfileFields: true,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.strictEqual(channel.accountId, "17841400000094");
          assert.strictEqual(channel.handle, "@shared_94");
          assert.deepStrictEqual(channel.displayName, Option.none());
          assert.deepStrictEqual(channel.avatarUrl, Option.none());
        })
    );

    it.effect(
      "answers that Unified login is not configured to reconnect its channel on a server without it",
      () =>
        Effect.gen(function* unset() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;

          meta.setUnified({
            accounts: [account("71")],
            permissions: unifiedPermissions,
          });

          const channel = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          // The same database, on a server whose Instagram goes through a
          // Page alone: META_INSTAGRAM_CONFIG_ID was unset.
          const withoutUnified = yield* Effect.gen(function* pageOnly() {
            const http = yield* publicHttpClient;

            return yield* connectChannelOver(
              yield* instagramAuthorizer({
                app: metaApp,
                hosts: meta.hosts,
                http,
                publicUrl: testPublicUrl,
              })
            );
          }).pipe(Effect.provide(MetaServicesTest), Effect.scoped);

          const failure = yield* withoutUnified
            .reconnect(manager(workspaceId), channel.id)
            .pipe(Effect.flip);

          assert.strictEqual(failure._tag, "PlatformNotConnectable");
          assert.strictEqual(
            failure._tag === "PlatformNotConnectable"
              ? failure.reason
              : undefined,
            "notConfigured"
          );
        })
    );

    it.effect("lists Unified login first among Instagram's ways in", () =>
      Effect.gen(function* connectable() {
        const workspaceId = yield* freshWorkspace;

        const reachable = yield* ConnectChannel.use((connect) =>
          connect.connectable(manager(workspaceId))
        );

        assert.deepStrictEqual(reachable.instagramConnections, [
          "unifiedLogin",
          "facebookLogin",
        ]);
      })
    );
  }
);

layer(DepartingConnectTest)(
  "a Page's Instagram channel with its messages on, moved to Unified login",
  (it) => {
    it.effect(
      "stops the Page's events with the Page's token, and never with the system user's",
      () =>
        Effect.gen(function* moved() {
          const meta = yield* FakeMeta;
          const workspaceId = yield* freshWorkspace;
          const shared = account("81");

          const page: FakePage = {
            id: "981",
            instagram: { id: shared.id, username: shared.username },
            name: "Synthetic Page 981",
          };

          // Signed in through the Page with its messages' permissions.
          meta.setPages([page]);
          meta.setAlsoGranted([...instagramPageMessageScopes]);

          const viaPage = yield* signIn(
            workspaceId,
            Option.some("facebookLogin")
          ).pipe(Effect.flatMap(connectedChannel));

          assert.include(viaPage.scopes, "instagram_manage_messages");
          assert.deepStrictEqual(meta.unsubscribed(), []);

          meta.setUnified({
            accounts: [shared],
            permissions: unifiedPermissions,
          });

          const unified = yield* signIn(workspaceId).pipe(
            Effect.flatMap(connectedChannel)
          );

          assert.strictEqual(unified.id, viaPage.id);
          assert.deepStrictEqual(
            unified.connection,
            Option.some("unifiedLogin")
          );
          // The departure ran with the Page's token, which alone reaches
          // the Page's subscription.
          assert.deepStrictEqual(meta.unsubscribed(), [page.id]);

          // The system user's token signed in, and did nothing else.
          const asSystemUser = meta
            .requests()
            .filter(({ query }) =>
              (query.get("access_token") ?? "").startsWith(
                "synthetic-system-user"
              )
            )
            .map(({ method, path }) => `${method} ${path}`);

          assert.sameMembers(
            [...new Set(asSystemUser)],
            ["GET /v27.0/me", "GET /v27.0/me/assigned_instagram_accounts"]
          );

          // Signed in through Unified login again: its way in does not
          // change, so nothing more is undone.
          yield* signIn(workspaceId).pipe(Effect.flatMap(connectedChannel));

          assert.deepStrictEqual(meta.unsubscribed(), [page.id]);
        })
    );
  }
);
