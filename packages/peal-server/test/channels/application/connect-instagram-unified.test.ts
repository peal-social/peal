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

import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { ConnectChannel } from "#channels/application/connect-channel.ts";
import type { ConnectOutcome } from "#channels/application/connect-channel.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type { AuthorizationCallback } from "#channels/application/platform-authorizer.ts";
import { TokenCipher } from "#channels/application/token-cipher.ts";
import type { Channel } from "#channels/domain/channel.ts";
import { instagramAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-authorizer.ts";
import { instagramUnifiedAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-unified-authorizer.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import type { InstagramConnection } from "#shared/domain/instagram-connection.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import {
  authorizersOf,
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
import type { FakeSharedAccount } from "#test/channels/fakes/fake-meta.ts";
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
).pipe(
  Layer.provide(
    Layer.mergeAll(
      FetchHttpClient.layer,
      OpenOutboundGuard,
      Mac.layerWebCrypto
    ).pipe(Layer.provideMerge(SecureRandom.layerWebCrypto))
  )
);

const UnifiedConnectTest = connectChannelWith(UnifiedAuthorizersTest).pipe(
  Layer.provideMerge(RecordedNotices.layer),
  Layer.provideMerge(FakeMeta.layer)
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
          // Starting over signs in through Unified login again.
          assert.deepStrictEqual(
            offered.connection,
            Option.some("unifiedLogin")
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
