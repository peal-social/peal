import { assert, layer } from "@effect/vitest";
import {
  DateTime,
  Duration,
  Effect,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
} from "effect";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type {
  AuthorizationCallback,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { RefreshChannelTokens } from "#channels/application/refresh-channel-tokens.ts";
import { renewToken } from "#channels/domain/channel.ts";
import type { Channel } from "#channels/domain/channel.ts";
import { Actor } from "#shared/domain/access.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  authorizersOf,
  ConnectAdaptersTest,
  connectChannelOver,
  connectedChannel,
  snapchatAuthorizerOn,
} from "#test/channels/connect-support.ts";
import {
  bare,
  fakeSnapchat,
  snapchatClient,
  snapchatProfile,
  snapError,
  snapOAuthError,
} from "#test/channels/fakes/fake-snapchat.ts";
import {
  actorIn,
  freshWorkspace,
  RecordedNotices,
  repositoryScopedTo,
} from "#test/channels/support.ts";

const manager = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, [
    "channel:read",
    "channel:connect",
    "channel:disconnect",
  ]);

// Another member of the workspace, as with a link sent to them.
const colleague = (workspaceId: WorkspaceId) =>
  new Actor({
    permissions: ["channel:read", "channel:connect"],
    subject: {
      _tag: "user",
      impersonatedBy: Option.none(),
      userId: UserIdSchema.make("9c4b1d2e-6f7a-4b8c-9d0e-1f2a3b4c5d6e"),
    },
    workspaceId,
  });

const noHandle = {
  connection: Option.none(),
  handle: Option.none(),
  instance: Option.none(),
} as const;

const callbackOf = (back: {
  readonly code?: string;
  readonly error?: string;
  readonly state: string;
}): AuthorizationCallback => ({
  code: Option.fromUndefinedOr(back.code),
  error: Option.fromUndefinedOr(back.error),
  issuer: Option.none(),
  state: back.state,
});

const AdaptersTest = Layer.mergeAll(ConnectAdaptersTest, RecordedNotices.layer);

const tokenRoute = "POST /login/oauth2/access_token";

// A 200 answering this body.
const json200 = (body: Readonly<Record<string, string>>) => ({
  body,
  status: 200,
});

const profileRoute = "GET /v1/public_profiles/my_profile";

// Snap, and the use case connecting its synthetic profile.
const onSnapchat = Effect.fn("test.onSnapchat")(function* onSnapchat() {
  const snapchat = yield* fakeSnapchat();
  const authorizer = yield* snapchatAuthorizerOn(snapchat.hosts);
  const connect = yield* connectChannelOver(authorizer);

  return { authorizer, connect, snapchat };
});

type OnSnapchat = Effect.Success<ReturnType<typeof onSnapchat>>;

// The sign-in, approved on Snap's page, as `complete` answers it.
const signedIn = (on: OnSnapchat, workspaceId: WorkspaceId) =>
  on.connect
    .start(manager(workspaceId), "snapchat", noHandle)
    .pipe(
      Effect.flatMap((url) =>
        on.connect.complete(
          manager(workspaceId),
          "snapchat",
          callbackOf(on.snapchat.approve(url))
        )
      )
    );

const connected = (on: OnSnapchat, workspaceId: WorkspaceId) =>
  signedIn(on, workspaceId).pipe(Effect.flatMap(connectedChannel));

const reconnected = (
  on: OnSnapchat,
  workspaceId: WorkspaceId,
  channel: Channel
) =>
  on.connect
    .reconnect(manager(workspaceId), channel.id)
    .pipe(
      Effect.flatMap((url) =>
        on.connect.complete(
          manager(workspaceId),
          "snapchat",
          callbackOf(on.snapchat.approve(url))
        )
      )
    );

// The token jobs over the workspace's channels only, with the authorizer.
const tokenJobs = (workspaceId: WorkspaceId, authorizer: PlatformAuthorizer) =>
  Layer.mergeAll(RefreshChannelTokens.layer, ChannelAccess.layer).pipe(
    Layer.provide(repositoryScopedTo(workspaceId)),
    Layer.provide(Layer.succeed(PlatformAuthorizers, authorizersOf(authorizer)))
  );

// The channel's tokens as stored, decrypted.
const storedTokens = (channel: Channel) =>
  ChannelRepository.use((channels) => channels.credentials(channel.id)).pipe(
    Effect.map(Option.getOrThrow),
    Effect.flatMap((stored) => decryptTokens(stored, channel.id)),
    Effect.map(({ accessToken, refreshToken }) => ({
      access: Redacted.value(accessToken),
      refresh: refreshToken.pipe(Option.map(Redacted.value)),
    }))
  );

// Makes the channel's token due for the sweep: unused for eight days past
// its expiry, Snap's tokens being kept alive after seven.
const makeDue = (channel: Channel) =>
  Effect.gen(function* due() {
    const now = yield* DateTime.now;

    const aged = renewToken(
      channel,
      {
        scopes: channel.scopes,
        token: {
          _tag: "refreshable",
          expiresAt: DateTime.subtractDuration(now, Duration.days(8)),
        },
      },
      now
    );

    yield* ChannelRepository.use((channels) =>
      channels.update(aged, Option.none())
    );
  });

const statusOf = (channel: Channel) =>
  ChannelRepository.use((channels) => channels.get(channel.id)).pipe(
    Effect.map(Option.map(({ status }) => status._tag))
  );

interface Logged {
  /** The line's annotations, as JSON. */
  readonly annotations: string;
  readonly message: string;
}

// What the effect logs, its messages and annotations as text.
const loggedBy = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const logs: Logged[] = [];

  const capture = Logger.layer([
    Logger.make(({ fiber, message }) => {
      logs.push({
        annotations: JSON.stringify(
          fiber.getRef(References.CurrentLogAnnotations)
        ),
        message: String(message),
      });
    }),
  ]);

  return effect.pipe(
    Effect.provide(capture),
    Effect.exit,
    Effect.map((exit) => ({ exit, logs }))
  );
};

layer(AdaptersTest)("connecting a Snapchat Public Profile", (it) => {
  it.effect("sends the member to Snap's sign-in page with the one scope", () =>
    Effect.gen(function* starts() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;

      const url = new URL(
        yield* on.connect.start(manager(workspaceId), "snapchat", noHandle)
      );

      assert.strictEqual(url.pathname, "/login/oauth2/authorize");
      assert.deepStrictEqual([...url.searchParams.keys()].toSorted(), [
        "client_id",
        "redirect_uri",
        "response_type",
        "scope",
        "state",
      ]);
      assert.strictEqual(
        url.searchParams.get("client_id"),
        snapchatClient.clientId
      );
      assert.strictEqual(url.searchParams.get("scope"), "snapchat-profile-api");
      assert.strictEqual(url.searchParams.get("response_type"), "code");
      assert.strictEqual(
        url.searchParams.get("redirect_uri"),
        "https://peal.test/connect/snapchat/callback"
      );
      assert.match(url.searchParams.get("state") ?? "", /^[\w-]{43}$/u);
    }).pipe(Effect.scoped)
  );

  it.effect("connects the profile by its id, for an hour's token", () =>
    Effect.gen(function* connects() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;
      const now = yield* DateTime.now;
      const channel = yield* connected(on, workspaceId);

      assert.strictEqual(channel.platform, "snapchat");
      assert.strictEqual(channel.accountId, snapchatProfile.id);
      assert.strictEqual(channel.handle, "@peal_example");
      assert.deepStrictEqual(channel.displayName, Option.some("Peal Example"));
      assert.deepStrictEqual(
        channel.avatarUrl.pipe(Option.map(String)),
        Option.some(snapchatProfile.logo_urls.manage_profile_logo_url)
      );
      assert.deepStrictEqual(channel.scopes, ["snapchat-profile-api"]);
      assert.deepStrictEqual(channel.token, {
        _tag: "refreshable",
        expiresAt: DateTime.addDuration(now, Duration.hours(1)),
      });
      assert.deepStrictEqual(yield* storedTokens(channel), {
        access: "synthetic-snapchat-access-1",
        refresh: Option.some("synthetic-snapchat-refresh-1"),
      });

      const exchange = on.snapchat
        .requests()
        .find(({ path }) => path === "/login/oauth2/access_token");

      const sent = new URLSearchParams(exchange?.body ?? "");

      assert.strictEqual(sent.get("grant_type"), "authorization_code");
      assert.strictEqual(sent.get("client_id"), snapchatClient.clientId);
      assert.strictEqual(
        sent.get("client_secret"),
        snapchatClient.clientSecret
      );
      assert.strictEqual(
        sent.get("redirect_uri"),
        "https://peal.test/connect/snapchat/callback"
      );
      assert.isNull(sent.get("code_verifier"));
    }).pipe(Effect.scoped)
  );

  it.effect("refuses a state of another member or workspace", () =>
    Effect.gen(function* badState() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;

      const url = yield* on.connect.start(
        manager(workspaceId),
        "snapchat",
        noHandle
      );

      const back = callbackOf(on.snapchat.approve(url));

      const elsewhere = yield* on.connect
        .complete(manager(yield* freshWorkspace), "snapchat", back)
        .pipe(Effect.flip);

      const someoneElse = yield* on.connect
        .complete(colleague(workspaceId), "snapchat", back)
        .pipe(Effect.flip);

      assert.strictEqual(elsewhere._tag, "InvalidConnectState");
      assert.strictEqual(someoneElse._tag, "InvalidConnectState");

      // Neither used the attempt up: its member completes it.
      const channel = yield* on.connect
        .complete(manager(workspaceId), "snapchat", back)
        .pipe(Effect.flatMap(connectedChannel));

      assert.strictEqual(channel.workspaceId, workspaceId);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "takes a refusal on Snapchat as a denial, and a callback without a code as a failure",
    () =>
      Effect.gen(function* refused() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;

        const url = yield* on.connect.start(
          manager(workspaceId),
          "snapchat",
          noHandle
        );

        const denied = yield* on.connect
          .complete(
            manager(workspaceId),
            "snapchat",
            callbackOf(on.snapchat.deny(url))
          )
          .pipe(Effect.flip);

        assert.strictEqual(denied._tag, "AuthorizationDenied");

        const again = yield* on.connect.start(
          manager(workspaceId),
          "snapchat",
          noHandle
        );

        const { state } = on.snapchat.approve(again);

        const failed = yield* on.connect
          .complete(manager(workspaceId), "snapchat", callbackOf({ state }))
          .pipe(Effect.flip);

        assert.strictEqual(failed._tag, "AuthorizationFailed");
      }).pipe(Effect.scoped)
  );

  it.effect("connects nothing for an account without a Public Profile", () =>
    Effect.gen(function* noProfile() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;

      on.snapchat.failNext(profileRoute, [
        snapError("NOT_FOUND", 404),
        snapError("SYNTHETIC_NO_PROFILE", 400),
        json200({ request_id: "synthetic", request_status: "SUCCESS" }),
      ]);

      for (const _ of [1, 2, 3]) {
        const none = yield* signedIn(on, workspaceId).pipe(Effect.flip);

        assert.strictEqual(none._tag, "NoAccountsToConnect");
      }

      const channels = yield* ChannelRepository.use((repository) =>
        repository.list(workspaceId)
      );

      assert.lengthOf(channels, 0);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "fails the sign-in on a refusal that is not Snap's, without saying there is no profile",
    () =>
      Effect.gen(function* notSnaps() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;

        on.snapchat.failNext(profileRoute, [bare(400), bare(502)]);

        const failed = yield* signedIn(on, workspaceId).pipe(Effect.flip);
        const down = yield* signedIn(on, workspaceId).pipe(Effect.flip);

        assert.strictEqual(failed._tag, "AuthorizationFailed");
        assert.strictEqual(down._tag, "PlatformUnavailable");
      }).pipe(Effect.scoped)
  );

  it.effect(
    "fails a sign-in Snap refuses the client for, and tells the operator without the token",
    () =>
      Effect.gen(function* notAllowlisted() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;

        on.snapchat.failNext(profileRoute, [
          snapError("AUTHORIZATION_PERMISSION_DENIED", 403),
        ]);

        const { exit, logs } = yield* loggedBy(signedIn(on, workspaceId));

        assert.isTrue(exit._tag === "Failure");
        assert.include(
          JSON.stringify(exit),
          "not allowlisted (AUTHORIZATION_PERMISSION_DENIED)"
        );

        const line = logs.find(({ message }) =>
          message.includes("is SNAPCHAT_CLIENT_ID allowlisted?")
        );

        assert.isDefined(line);
        assert.notInclude(JSON.stringify(logs), "synthetic-snapchat-access");
        assert.notInclude(JSON.stringify(logs), snapchatClient.clientSecret);
        assert.notInclude(JSON.stringify(logs), "Synthetic debug message");
      }).pipe(Effect.scoped)
  );

  it.effect(
    "refuses to reconnect with another profile, or with an account that has none",
    () =>
      Effect.gen(function* mismatch() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;
        const channel = yield* connected(on, workspaceId);

        on.snapchat.profile({
          ...snapchatProfile,
          id: "11111111-2222-4333-8444-555555555555",
        });

        const other = yield* reconnected(on, workspaceId, channel).pipe(
          Effect.flip
        );

        assert.strictEqual(other._tag, "ReconnectAccountMismatch");

        // An account without a profile: the check on the reconnected account
        // comes before the empty one.
        on.snapchat.failNext(profileRoute, [snapError("NOT_FOUND", 404)]);

        const none = yield* reconnected(on, workspaceId, channel).pipe(
          Effect.flip
        );

        assert.strictEqual(none._tag, "ReconnectAccountMismatch");
      }).pipe(Effect.scoped)
  );

  it.effect(
    "renews an expired token through ChannelAccess and saves the new refresh token",
    () =>
      Effect.gen(function* renews() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;
        const channel = yield* connected(on, workspaceId);
        const calls: string[] = [];

        const result = yield* ChannelAccess.use((access) =>
          access.withToken(channel.id, ({ accessToken }) => {
            const token = Redacted.value(accessToken);

            calls.push(token);

            return token === "synthetic-snapchat-access-1"
              ? Effect.fail(new TokenRejected())
              : Effect.succeed("posted");
          })
        ).pipe(Effect.provide(tokenJobs(workspaceId, on.authorizer)));

        assert.strictEqual(result, "posted");
        assert.deepStrictEqual(calls, [
          "synthetic-snapchat-access-1",
          "synthetic-snapchat-access-2",
        ]);
        assert.deepStrictEqual(yield* storedTokens(channel), {
          access: "synthetic-snapchat-access-2",
          refresh: Option.some("synthetic-snapchat-refresh-2"),
        });

        const sent = new URLSearchParams(
          on.snapchat
            .requests()
            .findLast(({ path }) => path === "/login/oauth2/access_token")
            ?.body ?? ""
        );

        assert.strictEqual(sent.get("grant_type"), "refresh_token");
        assert.strictEqual(
          sent.get("refresh_token"),
          "synthetic-snapchat-refresh-1"
        );
        assert.strictEqual(
          sent.get("client_secret"),
          snapchatClient.clientSecret
        );
      }).pipe(Effect.scoped)
  );

  it.effect("keeps the stored refresh token when a refresh answers none", () =>
    Effect.gen(function* keeps() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(on, workspaceId);

      on.snapchat.refreshWithoutToken();
      yield* makeDue(channel);

      const outcome = yield* RefreshChannelTokens.use((tokens) =>
        tokens.refresh(channel.id)
      ).pipe(Effect.provide(tokenJobs(workspaceId, on.authorizer)));

      assert.strictEqual(outcome, "refreshed");
      assert.deepStrictEqual(yield* storedTokens(channel), {
        access: "synthetic-snapchat-access-2",
        refresh: Option.some("synthetic-snapchat-refresh-1"),
      });
    }).pipe(Effect.scoped)
  );

  it.effect("asks to reconnect once Snap refuses the refresh token", () =>
    Effect.gen(function* revoked() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;
      const channel = yield* connected(on, workspaceId);
      const notices = yield* RecordedNotices;

      on.snapchat.failNext(tokenRoute, [snapOAuthError("invalid_grant", 400)]);
      yield* makeDue(channel);

      const outcome = yield* RefreshChannelTokens.use((tokens) =>
        tokens.refresh(channel.id)
      ).pipe(Effect.provide(tokenJobs(workspaceId, on.authorizer)));

      assert.strictEqual(outcome, "reconnectRequired");
      assert.deepStrictEqual(
        yield* statusOf(channel),
        Option.some("refreshNeeded")
      );
      assert.deepStrictEqual(
        (yield* notices.of(workspaceId)).map(({ kind }) => kind),
        ["reconnectRequired"]
      );
    }).pipe(Effect.scoped)
  );

  it.effect(
    "marks nothing, and keeps the tokens, on a refusal of the client or one nobody can read",
    () =>
      Effect.gen(function* unavailable() {
        const on = yield* onSnapchat();
        const workspaceId = yield* freshWorkspace;
        const channel = yield* connected(on, workspaceId);
        const before = yield* storedTokens(channel);

        on.snapchat.failNext(tokenRoute, [
          snapOAuthError("invalid_client", 401),
          bare(403, "application/json"),
          bare(400),
          json200({ synthetic: "not a token" }),
          bare(503),
        ]);
        yield* makeDue(channel);

        const refresh = RefreshChannelTokens.use((tokens) =>
          tokens.refresh(channel.id)
        ).pipe(Effect.provide(tokenJobs(workspaceId, on.authorizer)));

        for (const _ of [1, 2, 3, 4, 5]) {
          assert.strictEqual(yield* refresh, "unavailable");
        }

        assert.deepStrictEqual(yield* statusOf(channel), Option.some("active"));
        assert.deepStrictEqual(yield* storedTokens(channel), before);
        assert.strictEqual(yield* refresh, "refreshed");
      }).pipe(Effect.scoped)
  );

  it.effect("keeps a name holding a NUL and half a surrogate pair clean", () =>
    Effect.gen(function* clean() {
      const on = yield* onSnapchat();
      const workspaceId = yield* freshWorkspace;

      on.snapchat.profile({
        ...snapchatProfile,
        display_name: "Peal\u0000 Example \uD83D",
        snap_user_name: null,
      });

      const channel = yield* connected(on, workspaceId);

      const name = Option.getOrThrow(channel.displayName);

      assert.notInclude(name, "\u0000");
      assert.isTrue(name.isWellFormed());
      assert.isTrue(name.startsWith("Peal Example"));
      assert.strictEqual(channel.handle, name);
    }).pipe(Effect.scoped)
  );
});
