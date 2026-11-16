import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type {
  AuthorizationCallback,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { RefreshChannelTokens } from "#channels/application/refresh-channel-tokens.ts";
import type { Channel } from "#channels/domain/channel.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  authorizersOf,
  ConnectAdaptersTest,
  connectChannelOver,
  connectedChannel,
  slackAuthorizerOn,
} from "#test/channels/connect-support.ts";
import { json } from "#test/channels/fakes/fake-http-server.ts";
import {
  fakeSlack,
  slackClient,
  slackOther,
  slackPicked,
  slackTeam,
} from "#test/channels/fakes/fake-slack.ts";
import {
  actorIn,
  freshWorkspace,
  RecordedNotices,
  repositoryScopedTo,
} from "#test/channels/support.ts";

const manager = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, ["channel:read", "channel:connect"]);

const noHandle = {
  connection: Option.none(),
  handle: Option.none(),
  instance: Option.none(),
};

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

const onSlack = Effect.fn("test.onSlack")(function* onSlack() {
  const slack = yield* fakeSlack();
  const authorizer = yield* slackAuthorizerOn(slack.hosts);
  const connect = yield* connectChannelOver(authorizer);

  return { authorizer, connect, slack };
});

type OnSlack = Effect.Success<ReturnType<typeof onSlack>>;

const signIn = Effect.fn("test.signIn")(function* signIn(
  on: OnSlack,
  workspaceId: WorkspaceId,
  picked: { readonly id: string; readonly name: string } = slackPicked
) {
  const url = yield* on.connect.start(manager(workspaceId), "slack", noHandle);

  return yield* on.connect.complete(
    manager(workspaceId),
    "slack",
    callbackOf(on.slack.approve(url, { channel: picked }))
  );
});

const connected = (on: OnSlack, workspaceId: WorkspaceId) =>
  signIn(on, workspaceId).pipe(Effect.flatMap(connectedChannel));

const tokenJobs = (workspaceId: WorkspaceId, authorizer: PlatformAuthorizer) =>
  Layer.mergeAll(RefreshChannelTokens.layer, ChannelAccess.layer).pipe(
    Layer.provide(repositoryScopedTo(workspaceId)),
    Layer.provide(Layer.succeed(PlatformAuthorizers, authorizersOf(authorizer)))
  );

const storedToken = (channel: Channel) =>
  ChannelRepository.use((channels) => channels.credentials(channel.id)).pipe(
    Effect.map(Option.getOrThrow),
    Effect.flatMap((stored) => decryptTokens(stored, channel.id)),
    Effect.map(({ accessToken, refreshToken }) => ({
      access: Redacted.value(accessToken),
      refresh: refreshToken.pipe(Option.map(Redacted.value)),
    }))
  );

const statusOf = (channel: Channel) =>
  ChannelRepository.use((channels) => channels.get(channel.id)).pipe(
    Effect.map(Option.map(({ status }) => status._tag))
  );

layer(AdaptersTest)("connecting a Slack channel", (it) => {
  it.effect(
    "installs the app, asking its four scopes, and connects the channel the member picked on Slack's page",
    () =>
      Effect.gen(function* connects() {
        const on = yield* onSlack();
        const workspaceId = yield* freshWorkspace;

        const authorizationUrl = yield* on.connect.start(
          manager(workspaceId),
          "slack",
          noHandle
        );

        const url = new URL(authorizationUrl);

        assert.strictEqual(url.pathname, "/oauth/v2/authorize");
        assert.strictEqual(
          url.searchParams.get("client_id"),
          slackClient.clientId
        );
        assert.strictEqual(
          url.searchParams.get("scope"),
          "incoming-webhook,chat:write,chat:write.public,files:write"
        );
        assert.strictEqual(
          url.searchParams.get("redirect_uri"),
          "https://peal.test/connect/slack/callback"
        );
        assert.match(url.searchParams.get("state") ?? "", /^[\w-]{43}$/u);

        const channel = yield* on.connect
          .complete(
            manager(workspaceId),
            "slack",
            callbackOf(on.slack.approve(authorizationUrl))
          )
          .pipe(Effect.flatMap(connectedChannel));

        assert.strictEqual(channel.platform, "slack");
        assert.strictEqual(
          channel.accountId,
          `${slackTeam.id}/${slackPicked.id}`
        );
        assert.strictEqual(channel.handle, "#announcements");
        assert.deepStrictEqual(
          channel.displayName,
          Option.some(slackTeam.name)
        );
        assert.deepStrictEqual(channel.avatarUrl, Option.none());
        assert.deepStrictEqual(channel.token, { _tag: "nonExpiring" });
        assert.deepStrictEqual(channel.scopes, [
          "incoming-webhook",
          "chat:write",
          "chat:write.public",
          "files:write",
        ]);
        // The bot's token is kept; the webhook's address is not.
        assert.deepStrictEqual(yield* storedToken(channel), {
          access: "xoxb-synthetic-installed-token",
          refresh: Option.none(),
        });
      }).pipe(Effect.scoped)
  );

  it.effect("exchanges the code with the app's Basic credentials", () =>
    Effect.gen(function* exchanges() {
      const on = yield* onSlack();
      const workspaceId = yield* freshWorkspace;

      yield* connected(on, workspaceId);

      const exchange = on.slack
        .requests()
        .find(({ path }) => path === "/api/oauth.v2.access");

      const sent = new URLSearchParams(exchange?.body ?? "");

      assert.strictEqual(
        sent.get("redirect_uri"),
        "https://peal.test/connect/slack/callback"
      );
      assert.isNull(sent.get("client_secret"));
      assert.strictEqual(
        String(exchange?.headers["authorization"] ?? ""),
        `Basic ${Buffer.from(
          `${slackClient.clientId}:${slackClient.clientSecret}`
        ).toString("base64")}`
      );
    }).pipe(Effect.scoped)
  );

  it.effect("makes another channel of each channel picked", () =>
    Effect.gen(function* twoChannels() {
      const on = yield* onSlack();
      const workspaceId = yield* freshWorkspace;
      const first = yield* connected(on, workspaceId);

      const second = yield* signIn(on, workspaceId, slackOther).pipe(
        Effect.flatMap(connectedChannel)
      );

      assert.notStrictEqual(first.id, second.id);
      assert.strictEqual(second.handle, "#general");

      // The same channel again reconnects its channel.
      const again = yield* connected(on, workspaceId);

      assert.strictEqual(again.id, first.id);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "refuses a direct message picked on Slack's page: Peal posts to channels",
    () =>
      Effect.gen(function* direct() {
        const on = yield* onSlack();
        const workspaceId = yield* freshWorkspace;

        const refused = yield* signIn(on, workspaceId, {
          id: "D0SYNTH01",
          name: "@synthetic.person",
        }).pipe(Effect.flip);

        assert.strictEqual(refused._tag, "AuthorizationFailed");
        assert.include(refused.message, "direct message");
      }).pipe(Effect.scoped)
  );

  it.effect("takes a refusal on Slack's page as the member refusing", () =>
    Effect.gen(function* denied() {
      const on = yield* onSlack();
      const workspaceId = yield* freshWorkspace;

      const url = yield* on.connect.start(
        manager(workspaceId),
        "slack",
        noHandle
      );

      const refused = yield* on.connect
        .complete(manager(workspaceId), "slack", callbackOf(on.slack.deny(url)))
        .pipe(Effect.flip);

      assert.strictEqual(refused._tag, "AuthorizationDenied");
    }).pipe(Effect.scoped)
  );

  it.effect("refuses an install that withheld a scope Peal needs", () =>
    Effect.gen(function* withheld() {
      const on = yield* onSlack();
      const workspaceId = yield* freshWorkspace;

      const url = yield* on.connect.start(
        manager(workspaceId),
        "slack",
        noHandle
      );

      const refused = yield* on.connect
        .complete(
          manager(workspaceId),
          "slack",
          callbackOf(
            on.slack.approve(url, { granted: "incoming-webhook,chat:write" })
          )
        )
        .pipe(Effect.flip);

      assert.strictEqual(refused._tag, "AuthorizationDenied");
    }).pipe(Effect.scoped)
  );

  it.effect(
    "fails a code Slack refuses, and leaves Slack unavailable when it is slow or down",
    () =>
      Effect.gen(function* failures() {
        const on = yield* onSlack();
        const workspaceId = yield* freshWorkspace;

        for (const [answer, tag] of [
          [json({ error: "invalid_code", ok: false }), "AuthorizationFailed"],
          [
            json({ error: "ratelimited", ok: false }, 429),
            "PlatformUnavailable",
          ],
          [
            json({ error: "service_unavailable", ok: false }),
            "PlatformUnavailable",
          ],
          [json({ error: "Synthetic proxy" }, 502), "PlatformUnavailable"],
        ] as const) {
          on.slack.failNext("POST /api/oauth.v2.access", [answer]);

          const refused = yield* signIn(on, workspaceId).pipe(Effect.flip);

          assert.strictEqual(refused._tag, tag);
        }
      }).pipe(Effect.scoped)
  );

  it.effect(
    "refuses an answer with no channel picked, or with no bot token",
    () =>
      Effect.gen(function* incomplete() {
        const on = yield* onSlack();
        const workspaceId = yield* freshWorkspace;

        on.slack.failNext("POST /api/oauth.v2.access", [
          json({
            access_token: "xoxb-synthetic-installed-token",
            ok: true,
            scope: "incoming-webhook,chat:write,chat:write.public,files:write",
            team: slackTeam,
            token_type: "bot",
          }),
          json({
            access_token: "xoxp-synthetic-user-token",
            incoming_webhook: { channel: "#x", channel_id: "C0SYNTH09" },
            ok: true,
            scope: "incoming-webhook,chat:write,chat:write.public,files:write",
            team: slackTeam,
            token_type: "user",
          }),
        ]);

        for (const _answer of [1, 2]) {
          const refused = yield* signIn(on, workspaceId).pipe(Effect.flip);

          assert.strictEqual(refused._tag, "AuthorizationFailed");
        }
      }).pipe(Effect.scoped)
  );

  it.effect(
    "never renews the token: one Slack refuses marks the channel to reconnect, and tells the workspace",
    () =>
      Effect.gen(function* refused() {
        const on = yield* onSlack();
        const workspaceId = yield* freshWorkspace;
        const channel = yield* connected(on, workspaceId);
        const notices = yield* RecordedNotices;
        const jobs = tokenJobs(workspaceId, on.authorizer);

        assert.strictEqual(
          yield* RefreshChannelTokens.use((tokens) =>
            tokens.refresh(channel.id)
          ).pipe(Effect.provide(jobs)),
          "skipped"
        );

        const outcome = yield* ChannelAccess.use((access) =>
          access.withToken(channel.id, () => Effect.fail(new TokenRejected()))
        ).pipe(Effect.provide(jobs), Effect.flip);

        assert.strictEqual(outcome._tag, "TokenExpired");
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
});
