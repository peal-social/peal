// A site on WordPress.com connects by signing in there (OAuth 2.0's code
// flow, the operator's app): the attempt is the member's, for 15 minutes,
// used once; the code becomes the site's token, kept sealed, once
// WordPress.com says the member may publish there.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Ref } from "effect";

import { ChannelAllowance } from "#channels/application/channel-allowance.ts";
import { ChannelEvents } from "#channels/application/channel-events.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { ConnectSite } from "#channels/application/connect-site.ts";
import { SiteAuthorizers } from "#channels/application/site-authorizer.ts";
import { SiteRefused } from "#channels/application/site-refused.ts";
import { SiteSignIns } from "#channels/application/site-sign-ins.ts";
import { SiteVerifier } from "#channels/application/site-verifier.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import { DrizzleConnectAttempts } from "#channels/infrastructure/drizzle-connect-attempts.ts";
import { MemorySiteConnectPace } from "#channels/infrastructure/memory-site-connect-pace.ts";
import { wordpressComAuthorizer } from "#channels/infrastructure/platforms/wordpress-com/wordpress-com-authorizer.ts";
import { SqlChannelLocks } from "#channels/infrastructure/sql-channel-locks.ts";
import { Actor } from "#shared/domain/access.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import {
  AuthorizerServicesTest,
  testPublicUrl,
} from "#test/channels/connect-support.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type { FakeWordPressCom } from "#test/channels/fakes/fake-wordpress.ts";
import {
  actorIn,
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  syntheticCredentials,
  TokenCipherTest,
} from "#test/channels/support.ts";

const wpcom: FakeWordPressCom = {
  blogId: 2_024_001,
  code: "synthetic-code",
  token: "synthetic-wpcom-token",
};

// Where the WordPress.com the test started listens.
const hosts = { api: "http://127.0.0.1:9" };

const AuthorizersTest = Layer.effect(
  SiteAuthorizers,
  Effect.gen(function* AuthorizersTest() {
    const authorizer = yield* wordpressComAuthorizer({
      client: {
        clientId: "153160",
        clientSecret: Redacted.make("synthetic-wpcom-secret"),
      },
      hosts,
      http: yield* publicHttpClient,
      publicUrl: testPublicUrl,
    });

    return SiteAuthorizers.of({ for: () => Option.some(authorizer) });
  })
).pipe(Layer.provide(AuthorizerServicesTest));

const counted = Ref.makeUnsafe(0);

const AllowanceTest = Layer.succeed(
  ChannelAllowance,
  ChannelAllowance.of({
    channels: () => Effect.succeed(Option.some(2)),
    counted: () => Ref.update(counted, (count) => count + 1),
    passedThrough: () => Effect.succeedNone,
    sharedWith: () => Effect.succeed([]),
    sharingIn: () => Effect.succeed(new Map()),
  })
);

const SignInsTest = SiteSignIns.layer.pipe(
  Layer.provideMerge(ConnectSite.layer),
  Layer.provideMerge(
    Layer.mergeAll(
      DrizzleChannelRepository,
      DrizzleConnectAttempts,
      ChannelEvents.none,
      SqlChannelLocks,
      AllowanceTest,
      MemorySiteConnectPace,
      AuthorizersTest,
      Layer.succeed(
        SiteVerifier,
        SiteVerifier.of({
          verify: () => Effect.die("no WordPress site here"),
          verifyKey: () => Effect.die("no key here"),
        })
      )
    )
  ),
  Layer.provideMerge(TokenCipherTest),
  Layer.provideMerge(DatabaseTest)
);

const manager = (workspaceId: Parameters<typeof actorIn>[0]) =>
  actorIn(workspaceId, ["channel:read", "channel:connect"]);

// A fake WordPress.com, which the sign-ins call from now on.
const started = (com: FakeWordPressCom = wpcom) =>
  fakeWordPress({ wordpressCom: com }).pipe(
    Effect.tap((site) =>
      Effect.sync(() => {
        hosts.api = new URL(site.home).origin;
      })
    )
  );

const stateOf = (authorizationUrl: string) =>
  new URL(authorizationUrl).searchParams.get("state") ?? "";

const returned = (state: string, code = wpcom.code) => ({
  code: Option.some(code),
  error: Option.none(),
  issuer: Option.none(),
  state,
});

layer(SignInsTest)("signing in to a site on WordPress.com", (it) => {
  it.effect("sends the member to WordPress.com, for one site, no scope", () =>
    Effect.gen(function* begins() {
      yield* started();

      const workspaceId = yield* freshWorkspace;

      const url = new URL(
        yield* (yield* SiteSignIns).start(
          manager(workspaceId),
          "wordpressCom",
          Option.none()
        )
      );

      assert.strictEqual(url.pathname, "/oauth2/authorize");
      assert.strictEqual(url.searchParams.get("client_id"), "153160");
      assert.strictEqual(url.searchParams.get("response_type"), "code");
      assert.strictEqual(
        url.searchParams.get("redirect_uri"),
        `${testPublicUrl}/connect/wordpress-com/callback`
      );
      assert.isNull(url.searchParams.get("scope"));
      assert.isAbove(url.searchParams.get("state")?.length ?? 0, 30);
    })
  );

  it.effect("keeps the site the member picked, its token sealed", () =>
    Effect.gen(function* completes() {
      yield* started();

      const workspaceId = yield* freshWorkspace;
      const signIns = yield* SiteSignIns;
      const actor = manager(workspaceId);

      const url = yield* signIns.start(actor, "wordpressCom", Option.none());

      const channel = yield* signIns.complete(
        actor,
        "wordpressCom",
        returned(stateOf(url))
      );

      assert.strictEqual(channel.platform, "wordpressCom");
      assert.strictEqual(channel.accountId, String(wpcom.blogId));
      assert.deepStrictEqual(
        channel.displayName,
        Option.some("Synthetic Garden Journal")
      );

      const stored = yield* (yield* ChannelRepository).credentials(channel.id);

      assert.isTrue(Option.isSome(stored));

      if (Option.isSome(stored)) {
        assert.notInclude(stored.value.accessToken, "synthetic");

        const tokens = yield* decryptTokens(stored.value, channel.id);

        assert.strictEqual(Redacted.value(tokens.accessToken), wpcom.token);
      }

      // Used once: the same callback again is refused.
      const again = yield* signIns
        .complete(actor, "wordpressCom", returned(stateOf(url)))
        .pipe(Effect.flip);

      assert.strictEqual(again._tag, "InvalidConnectState");
    })
  );

  it.effect("is the member's own: another cannot complete it", () =>
    Effect.gen(function* own() {
      yield* started();

      const workspaceId = yield* freshWorkspace;
      const signIns = yield* SiteSignIns;

      const url = yield* signIns.start(
        manager(workspaceId),
        "wordpressCom",
        Option.none()
      );

      const other = new Actor({
        permissions: ["channel:connect"],
        workspaceId,
        subject: {
          _tag: "user",
          impersonatedBy: Option.none(),
          userId: UserIdSchema.make("00000000-0000-4000-8000-0000000000f2"),
        },
      });

      const refused = yield* signIns
        .complete(other, "wordpressCom", returned(stateOf(url)))
        .pipe(Effect.flip);

      assert.strictEqual(refused._tag, "InvalidConnectState");
    })
  );

  it.effect("says why: denied, a code refused, no right to publish", () =>
    Effect.gen(function* refusals() {
      yield* started({ ...wpcom, capabilities: { publish_posts: false } });

      const workspaceId = yield* freshWorkspace;
      const signIns = yield* SiteSignIns;
      const actor = manager(workspaceId);

      const begin = () =>
        signIns
          .start(actor, "wordpressCom", Option.none())
          .pipe(Effect.map(stateOf));

      const denied = yield* signIns
        .complete(actor, "wordpressCom", {
          ...returned(yield* begin()),
          code: Option.none(),
          error: Option.some("access_denied"),
        })
        .pipe(Effect.flip);

      assert.strictEqual(denied._tag, "AuthorizationDenied");

      const wrongCode = yield* signIns
        .complete(
          actor,
          "wordpressCom",
          returned(yield* begin(), "synthetic-x")
        )
        .pipe(Effect.flip);

      assert.strictEqual(wrongCode._tag, "AuthorizationFailed");

      const cannot = yield* signIns
        .complete(actor, "wordpressCom", returned(yield* begin()))
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        cannot,
        new SiteRefused({ reason: "cannotPublish" })
      );
      assert.lengthOf(yield* (yield* ChannelRepository).list(workspaceId), 0);
    })
  );

  it.effect("reconnects its channel's site, and refuses another", () =>
    Effect.gen(function* reconnects() {
      yield* started();

      const workspaceId = yield* freshWorkspace;
      const signIns = yield* SiteSignIns;
      const actor = manager(workspaceId);

      const first = yield* signIns.complete(
        actor,
        "wordpressCom",
        returned(
          stateOf(yield* signIns.start(actor, "wordpressCom", Option.none()))
        )
      );

      const again = yield* signIns.complete(
        actor,
        "wordpressCom",
        returned(
          stateOf(
            yield* signIns.start(actor, "wordpressCom", Option.some(first.id))
          )
        )
      );

      assert.strictEqual(again.id, first.id);

      yield* started({ ...wpcom, blogId: 2_024_002 });

      const mismatch = yield* signIns
        .complete(
          actor,
          "wordpressCom",
          returned(
            stateOf(
              yield* signIns.start(actor, "wordpressCom", Option.some(first.id))
            )
          )
        )
        .pipe(Effect.flip);

      assert.strictEqual(mismatch._tag, "ReconnectAccountMismatch");
    })
  );

  it.effect("needs room for a new site before the member leaves", () =>
    Effect.gen(function* full() {
      yield* started();

      const workspaceId = yield* freshWorkspace;
      const repository = yield* ChannelRepository;

      for (const _ of [1, 2]) {
        const channel = yield* freshChannel(workspaceId);

        yield* repository.insert(channel, syntheticCredentials(channel));
      }

      const refused = yield* (yield* SiteSignIns)
        .start(manager(workspaceId), "wordpressCom", Option.none())
        .pipe(Effect.flip);

      assert.strictEqual(refused._tag, "PlanLimitReached");
    })
  );
});
