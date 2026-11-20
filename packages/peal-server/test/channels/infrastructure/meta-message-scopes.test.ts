import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import type {
  AuthorizationCallback,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { Channel } from "#channels/domain/channel.ts";
import { ConnectAttempt } from "#channels/domain/connect-attempt.ts";
import { facebookAuthorizer } from "#channels/infrastructure/platforms/meta/facebook-authorizer.ts";
import { instagramAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-authorizer.ts";
import { instagramLoginAuthorizer } from "#channels/infrastructure/platforms/meta/instagram-login-authorizer.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import type { InboxPlatforms } from "#shared/domain/inbox-platform.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { testPublicUrl } from "#test/channels/connect-support.ts";
import { fakeInstagram } from "#test/channels/fakes/fake-instagram.ts";
import {
  fakeMeta,
  instagramApp,
  metaApp,
} from "#test/channels/fakes/fake-meta.ts";
import type { FakePage } from "#test/channels/fakes/fake-meta.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

// What Facebook Login and Instagram Login ask for direct messages: with
// PEAL_INBOX_MESSAGES off, or a sign-in that does not ask for them,
// exactly what they asked before; with it on and a member turning a
// channel's messages on (`messages`), or a reconnect of a channel that
// granted them, Meta's messaging permissions too.

const off: InboxPlatforms = new Set();

const messagesOn: InboxMessagePlatforms = new Set(["facebook", "instagram"]);

const page: FakePage = {
  id: "102000000000001",
  instagram: {
    id: "17841400000000001",
    name: "Synthetic Studio",
    username: "synthetic_studio",
  },
  name: "Synthetic Page",
  tasks: ["CREATE_CONTENT", "MANAGE", "MODERATE"],
  username: "syntheticpage",
};

const begun = {
  handle: Option.none(),
  instance: Option.none(),
  reconnecting: Option.none(),
};

const Services = Layer.mergeAll(
  FetchHttpClient.layer,
  OpenOutboundGuard,
  Mac.layerWebCrypto
).pipe(Layer.provideMerge(SecureRandom.layerWebCrypto));

// The authorizers as the server builds them for `inbox`, against fakes.
const authorizers = Effect.fnUntraced(function* authorizers(
  messages: InboxMessagePlatforms
) {
  const meta = yield* fakeMeta();
  const instagram = yield* fakeInstagram();
  const http = yield* publicHttpClient;

  meta.setPages([page]);

  const options = (app: typeof metaApp) => ({
    app,
    hosts: instagram.hostsOver(meta.hosts),
    http,
    inbox: off,
    messages,
    publicUrl: testPublicUrl,
  });

  return {
    facebook: yield* facebookAuthorizer(options(metaApp)),
    instagram,
    instagramLogin: yield* instagramLoginAuthorizer(options(instagramApp)),
    instagramPage: yield* instagramAuthorizer(options(metaApp)),
    meta,
  };
});

const scopeOf = (
  authorizer: PlatformAuthorizer,
  asked: { readonly messages?: boolean; readonly reconnecting?: Channel } = {}
) =>
  authorizer
    .begin({
      ...begun,
      messages: asked.messages ?? false,
      reconnecting: Option.fromUndefinedOr(asked.reconnecting),
    })
    .pipe(
      Effect.map(({ authorizationUrl }) =>
        new URL(authorizationUrl).searchParams.get("scope")
      )
    );

// A channel of `platform` that granted `scopes`, being reconnected.
const channelOf = (
  platform: "facebook" | "instagram",
  scopes: readonly string[],
  connection: "facebookLogin" | "instagramLogin" = "facebookLogin"
) => {
  const at = DateTime.makeUnsafe("2026-11-12T09:00:00.000Z");

  return new Channel({
    accountId: platform === "facebook" ? page.id : (page.instagram?.id ?? ""),
    avatarUrl: Option.none(),
    connection:
      platform === "instagram" ? Option.some(connection) : Option.none(),
    createdAt: at,
    displayName: Option.none(),
    handle: "@synthetic_studio",
    id: ChannelIdSchema.make("01900000-0000-7000-8000-0000000000f7"),
    platform,
    scopes,
    status: { _tag: "active" },
    token: { _tag: "nonExpiring" },
    updatedAt: at,
    workspaceId: WorkspaceIdSchema.make("01900000-0000-7000-8000-0000000000f1"),
  });
};

// The member signs in on `authorizer`'s page and comes back approved.
const signIn = Effect.fnUntraced(function* signIn(
  authorizer: PlatformAuthorizer,
  approve: (url: string) => { readonly code: string; readonly state: string }
) {
  const { authorizationUrl, secret } = yield* authorizer.begin({
    ...begun,
    messages: true,
  });

  const back = approve(authorizationUrl);
  const now = DateTime.makeUnsafe("2026-11-12T09:00:00.000Z");

  const callback: AuthorizationCallback = {
    code: Option.some(back.code),
    error: Option.none(),
    issuer: Option.none(),
    state: back.state,
  };

  return yield* authorizer.complete({
    attempt: new ConnectAttempt({
      channelId: Option.none(),
      connection: Option.fromUndefinedOr(authorizer.connection),
      createdAt: now,
      expiresAt: DateTime.addDuration(now, "15 minutes"),
      instance: Option.none(),
      platform: authorizer.platform,
      startedBy: "user:synthetic",
      state: back.state,
      workspaceId: WorkspaceIdSchema.make(
        "01900000-0000-7000-8000-0000000000f1"
      ),
    }),
    callback,
    reconnecting: Option.none(),
    secret,
  });
});

const facebookBefore =
  "pages_show_list,pages_read_engagement,pages_manage_posts,business_management";

const instagramPageBefore =
  "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,instagram_manage_insights,business_management";

const instagramLoginBefore =
  "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights";

describe("the messaging permissions at sign-in", () => {
  it.effect(
    "are not asked where the inbox reads no Meta messages, whatever is asked",
    () =>
      Effect.gen(function* notAsked() {
        const built = yield* authorizers(new Set(["mastodon", "bluesky"]));

        for (const messages of [false, true]) {
          assert.strictEqual(
            yield* scopeOf(built.facebook, { messages }),
            facebookBefore
          );
          assert.strictEqual(
            yield* scopeOf(built.instagramPage, { messages }),
            instagramPageBefore
          );
          assert.strictEqual(
            yield* scopeOf(built.instagramLogin, { messages }),
            instagramLoginBefore
          );
        }
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect("are not asked of a sign-in that does not ask for messages", () =>
    Effect.gen(function* notMessages() {
      const built = yield* authorizers(messagesOn);

      assert.strictEqual(yield* scopeOf(built.facebook), facebookBefore);
      assert.strictEqual(
        yield* scopeOf(built.instagramPage),
        instagramPageBefore
      );
      assert.strictEqual(
        yield* scopeOf(built.instagramLogin),
        instagramLoginBefore
      );
    }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect("are asked when a member turns a channel's messages on", () =>
    Effect.gen(function* asked() {
      const built = yield* authorizers(messagesOn);

      assert.strictEqual(
        yield* scopeOf(built.facebook, { messages: true }),
        `${facebookBefore},pages_messaging,pages_manage_metadata`
      );
      assert.strictEqual(
        yield* scopeOf(built.instagramPage, { messages: true }),
        `${instagramPageBefore},instagram_manage_messages,pages_manage_metadata,pages_messaging`
      );
      assert.strictEqual(
        yield* scopeOf(built.instagramLogin, { messages: true }),
        `${instagramLoginBefore},instagram_business_manage_messages`
      );

      // Only on the platform the setting names.
      const facebookOnly = yield* authorizers(new Set(["facebook"]));

      assert.strictEqual(
        yield* scopeOf(facebookOnly.instagramPage, { messages: true }),
        instagramPageBefore
      );
    }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "are asked again of a reconnect of a channel that granted them",
    () =>
      Effect.gen(function* again() {
        const built = yield* authorizers(messagesOn);

        assert.strictEqual(
          yield* scopeOf(built.facebook, {
            reconnecting: channelOf("facebook", ["pages_messaging"]),
          }),
          `${facebookBefore},pages_messaging,pages_manage_metadata`
        );
        assert.strictEqual(
          yield* scopeOf(built.instagramLogin, {
            reconnecting: channelOf(
              "instagram",
              ["instagram_business_manage_messages"],
              "instagramLogin"
            ),
          }),
          `${instagramLoginBefore},instagram_business_manage_messages`
        );
        assert.strictEqual(
          yield* scopeOf(built.facebook, {
            reconnecting: channelOf("facebook", ["pages_manage_posts"]),
          }),
          facebookBefore
        );
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "are kept for an Instagram Login account whose answer lists no permission",
    () =>
      Effect.gen(function* listedNone() {
        const built = yield* authorizers(messagesOn);

        built.instagram.setGranted([]);

        const outcome = yield* signIn(
          built.instagramLogin,
          built.instagram.approve
        );

        assert.include(
          "tokens" in outcome ? outcome.tokens.scopes : [],
          "instagram_business_manage_messages"
        );
      }).pipe(Effect.scoped, Effect.provide(Services))
  );
});
