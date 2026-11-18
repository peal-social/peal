// What the server writes about a request never holds a credential: a
// platform's events' verify token and signature (nor what an event says of
// a message), a connect link's token, a review link's, a partner key, a website's
// application password, the token of a
// link that applies a request to cancel, the value of a header a webhook
// endpoint's deliveries carry, two-step verification's key, codes and
// recovery codes, the image provider's key, the key of a provider a
// workspace brought (nor the prompt sent to either), or a chat's secret,
// which its platform carries in the path of every address. The app runs here as production
// runs it, logging each request and tracing it, and everything a log line
// or a span would export is searched for each secret.
import { once } from "node:events";
import { createServer } from "node:http";

import { assert, layer } from "@effect/vitest";
import {
  Cause,
  ConfigProvider,
  DateTime,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
  Schedule,
  Schema,
  Tracer,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";
import sharp from "sharp";

import { WritingAssistant } from "#assistant/application/writing-assistant.ts";
import { ChatVerifier } from "#channels/application/chat-verifier.ts";
import { SiteVerifier } from "#channels/application/site-verifier.ts";
import { ConnectAttempt } from "#channels/domain/connect-attempt.ts";
import { chatVerifiersLive } from "#channels/infrastructure/platforms/chat-verifiers.ts";
import { siteVerifiersLive } from "#channels/infrastructure/platforms/site-verifiers.ts";
import { slackAuthorizer } from "#channels/infrastructure/platforms/slack/slack-authorizer.ts";
import { wordpressComAuthorizer } from "#channels/infrastructure/platforms/wordpress-com/wordpress-com-authorizer.ts";
import { DrizzleMediaAssetsLive } from "#media/infrastructure/drizzle-media-assets.ts";
import { S3MediaStorageLive } from "#media/infrastructure/s3-media-storage.ts";
import { FacebookOptions } from "#publishing/domain/facebook-options.ts";
import { LivePostChangeIdSchema } from "#publishing/domain/live-post-change-id.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { devtoHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import { hashnodeHosts } from "#shared/infrastructure/platforms/hashnode-api.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { ShortLinks } from "#shortlinks/application/short-links.ts";
import { ShortLinksLive } from "#shortlinks/container.ts";
import {
  actorIn,
  DatabaseTest as AssistantDatabaseTest,
  imagesTest,
} from "#test/assistant/support.ts";
import { fakeDevTo, gardener } from "#test/channels/fakes/fake-devto.ts";
import {
  fakeHashnode,
  writerOnHashnode,
} from "#test/channels/fakes/fake-hashnode.ts";
import {
  fakeHttpServer,
  json as jsonAnswer,
} from "#test/channels/fakes/fake-http-server.ts";
import { fakeSlack, slackClient } from "#test/channels/fakes/fake-slack.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import {
  OpenOutboundGuard,
  DatabaseTest,
  syntheticKeyring,
} from "#test/channels/support.ts";
import { storageSettings } from "#test/media/support.ts";
import {
  discordAccount,
  discordSecret,
  discordWebhookId,
  discordWebhookToken,
  fakeDiscordApi,
} from "#test/publishing/fakes/fake-discord-api.ts";
import {
  facebookPageId,
  fakeMetaGraph,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import {
  fakeSlackApi,
  slackAccount,
  slackBotToken,
  slackUploadTicket,
} from "#test/publishing/fakes/fake-slack-api.ts";
import {
  fakeTelegramApi,
  telegramAccount,
  telegramBotToken,
} from "#test/publishing/fakes/fake-telegram-api.ts";
import { json } from "#test/publishing/fakes/platform-server.ts";
import {
  attached,
  credentialsOf,
  discordClientWith,
  httpClientTimingOutAfter,
  liveClientsOn,
  metaClientWith,
  outgoing,
  slackClientWith,
  telegramClientWith,
  testFile,
} from "#test/publishing/platforms/support.ts";
import { liveTarget, OpenLinkStanding } from "#test/shortlinks/support.ts";
import {
  answered,
  FakeTransport,
} from "#test/webhooks/fakes/fake-transport.ts";
import {
  freshEndpoint,
  freshOwner,
  WebhooksTest,
} from "#test/webhooks/support.ts";
import { appWithOidc, FakeOidc } from "#test/workspace/fakes/fake-oidc.ts";
import {
  bodyOf,
  MigratedSqlLive,
  password,
  signedUp,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";
import {
  bearer,
  customerOf,
  keyOf,
  partnerOf,
} from "#test/workspace/integration/partner-support.ts";
import {
  finishSignIn,
  signUpPage,
  startSignIn,
  verified as verifiedIdentity,
} from "#test/workspace/integration/provider-support.ts";
import {
  codeOf,
  enrolled,
  passwordStep,
  secondStep,
  withCookies,
  wrongCodeOf,
} from "#test/workspace/support.ts";
import { toDeliveryView, toEndpointView } from "#webhooks/api/webhook-view.ts";
import { DeliverWebhook } from "#webhooks/application/deliver-webhook.ts";
import { WebhookDeliveries } from "#webhooks/application/webhook-deliveries.ts";
import { WebhookEndpoints } from "#webhooks/application/webhook-endpoints.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

const CreatedLinkSchema = Schema.Struct({ url: Schema.String });

const lines: string[] = [];
const spans: Tracer.NativeSpan[] = [];

const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);

    spans.push(span);

    return span;
  },
});

// Everything a logger is handed: the message, its cause, and what the
// line is annotated with, as an exporter would write them.
const capture = Logger.layer([
  Logger.make(({ cause, fiber, message }) => {
    lines.push(
      JSON.stringify(message),
      Cause.pretty(cause),
      JSON.stringify(fiber.getRef(References.CurrentLogAnnotations)),
      JSON.stringify(fiber.getRef(References.CurrentLogSpans))
    );
  }),
]);

// Everything a span would export, as text.
const spanText = (span: Tracer.NativeSpan): string =>
  [
    span.name,
    JSON.stringify([...span.attributes]),
    JSON.stringify(span.events),
    span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
      ? Cause.pretty(span.status.exit.cause)
      : "",
  ].join("\n");

const Test = Layer.mergeAll(
  TestApp.layerWith(
    { ...unconfirmedEmails, PEAL_PARTNER_SELF_SERVICE: "true" },
    Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
  ),
  MigratedSqlLive
);

const written = () => [...lines, ...spans.map(spanText)].join("\n");

layer(Test, { excludeTestServices: true, timeout: "180 seconds" })(
  "what the server writes about requests",
  (it) => {
    it.effect(
      "holds no connect link's token, through a whole link's steps, and no key or token of another kind",
      () =>
        Effect.gen(function* searched() {
          const app = yield* TestApp;
          const { home, owner } = yield* partnerOf("secrets");
          const { key } = yield* keyOf(owner, home);
          const customer = yield* customerOf(key, "Secrets", "cus_secret_1");

          const created = yield* app.request(
            `/api/workspaces/${customer.id}/connect-links`,
            { body: { platform: "mastodon" }, headers: bearer(key) }
          );

          const { url } = yield* bodyOf(CreatedLinkSchema, created);
          const token = url.slice(url.lastIndexOf("#") + 1);
          const holding = { "x-connect-link-token": token };

          assert.isAbove(token.length, 20);

          // The link's steps, as its page takes them: opened, started,
          // completed and chosen (refused here, as no platform answers).
          const statuses = [
            (yield* app.request("/api/connect-links", { headers: holding }))
              .status,
            (yield* app.request("/api/connect-links/start", {
              body: { instance: "localhost" },
              headers: holding,
            })).status,
            (yield* app.request("/api/connect-links/complete", {
              body: { code: "synthetic-code", state: "synthetic-state" },
              headers: holding,
            })).status,
            (yield* app.request("/api/connect-links/accounts", {
              body: { accountIds: ["synthetic"], selection: "synthetic" },
              headers: holding,
            })).status,
          ];

          assert.deepStrictEqual(statuses, [200, 422, 422, 422]);

          // The other credentials that are no session: a review link's
          // token and the token of a link that applies a request, sent as
          // their pages send them.
          const reviewToken = "synthetic-review-token-that-opens-nothing";
          const requestToken = "synthetic-request-token-that-applies-nothing";

          yield* app.request("/api/review-link", {
            headers: { "x-review-token": reviewToken },
          });
          yield* app.request("/api/contract-requests/confirmation", {
            body: { token: requestToken, workspaceId: customer.id },
          });

          // A website's application password, refused before it leaves:
          // the site is on a loopback address.
          const sitePassword = "synthetic-site-password-that-opens-nothing";

          const site = yield* app.request(
            `/api/workspaces/${customer.id}/channels/websites`,
            {
              body: {
                address: "127.0.0.1",
                applicationPassword: sitePassword,
                platform: "wordpress",
                userName: "synthetic-editor",
              },
              headers: bearer(key),
            }
          );

          assert.strictEqual(site.status, 422);

          // A chat's secrets, refused before they leave: the webhook's
          // address is on another host, the bot's token has not a bot's
          // shape.
          const webhookToken = "synthetic-webhook-token-that-opens-nothing";
          const botToken = "synthetic-bot-token-that-opens-nothing";

          const chats = yield* Effect.all(
            [
              {
                platform: "discord",
                webhookUrl: `https://example.com/api/webhooks/1/${webhookToken}`,
              },
              { botToken, chat: "@synthetic_news", platform: "telegram" },
            ].map((body) =>
              app.request(`/api/workspaces/${customer.id}/channels/chats`, {
                body,
                headers: bearer(key),
              })
            )
          );

          assert.deepStrictEqual(
            chats.map(({ status }) => status),
            [422, 422]
          );

          // What an address holds is written, which is why no token goes
          // in one: this search would find it.
          const inAddress = "synthetic-marker-in-an-address";

          yield* app.request(`/api/connect-links/${inAddress}`);

          const all = written();

          assert.include(all, inAddress);

          // The requests were written about at all: each has its line and
          // its span.
          assert.include(all, "/api/connect-links/start");
          assert.isAbove(spans.length, 10);

          for (const [name, secret] of [
            ["a Discord webhook's token", webhookToken],
            ["a Telegram bot's token", botToken],
            ["a connect link's token", token],
            ["a partner key", key],
            ["a review link's token", reviewToken],
            ["a contract request's token", requestToken],
            ["a website's application password", sitePassword],
          ] as const) {
            assert.notInclude(all, secret, name);
          }
        })
    );
  }
);

// Two-step verification needs a confirmed address: this app asks for one.
const TwoStepTest = Layer.mergeAll(
  TestApp.layerWith(
    {},
    Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
  ),
  MigratedSqlLive
);

// A sign-in through an OpenID Connect provider: the provider sends the
// browser back with its code and the sign-in's state in the address.
const ProviderTest = Layer.mergeAll(
  appWithOidc({}, Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))),
  MigratedSqlLive
);

layer(ProviderTest, { excludeTestServices: true, timeout: "180 seconds" })(
  "what the server writes about a provider's sign-in",
  (it) => {
    it.effect("holds no code, state, nonce, ID token or address", () =>
      Effect.gen(function* providerSignIn() {
        const provider = yield* FakeOidc;
        const email = "secrets-provider-synthetic@example.test";
        const started = yield* startSignIn(signUpPage());

        const code = yield* provider.issue(
          verifiedIdentity(email),
          started.nonce
        );

        const finished = yield* finishSignIn(started, code);

        assert.isNull(finished.error);

        const all = written();

        assert.include(all, "/api/auth/callback/oidc");

        for (const [name, value] of [
          ["the provider's code", code],
          ["the sign-in's state", started.state],
          ["the ID token's nonce", started.nonce],
          ...provider.idTokens().map((token) => ["an ID token", token]),
          ["the address", email],
        ] as const) {
          assert.isAbove(value.length, 10, name);
          assert.notInclude(all, value, name);
        }
      })
    );
  }
);

layer(TwoStepTest, { excludeTestServices: true, timeout: "180 seconds" })(
  "what the server writes about two-step verification",
  (it) => {
    it.effect("holds no authenticator key, no code and no recovery code", () =>
      Effect.gen(function* twoStep() {
        const app = yield* TestApp;
        const person = yield* signedUp("secrets-two-step");
        const { backupCodes, cookies, key, totpURI } = yield* enrolled(person);
        const secret = new URL(totpURI).searchParams.get("secret") ?? "";

        assert.isAbove(secret.length, 20);

        // A sign-in with a wrong code, then a recovery code, then new
        // codes and the account's status.
        const browser = withCookies("", yield* passwordStep(person.email));
        const wrong = yield* Effect.promise(async () => await wrongCodeOf(key));
        const code = yield* Effect.promise(async () => await codeOf(key));

        yield* secondStep(browser, { code: wrong, route: "verify-totp" });
        yield* secondStep(browser, {
          code: backupCodes[0] ?? "",
          route: "verify-backup-code",
        });

        const renewed = yield* app.request(
          "/api/auth/two-factor/generate-backup-codes",
          { body: { password }, headers: { cookie: cookies } }
        );

        yield* app.request("/api/me/two-step", {
          headers: { cookie: cookies },
        });

        const all = written();

        assert.include(all, "/api/auth/two-factor/verify-totp");

        for (const [name, value] of [
          ["the authenticator's key", secret],
          ["the URI the QR code holds", totpURI],
          ...backupCodes.map((recovery) => ["a recovery code", recovery]),
          ...(JSON.stringify(renewed.body)
            .match(/[A-Za-z0-9]{5}-[A-Za-z0-9]{5}/gu)
            ?.map((recovery) => ["a new recovery code", recovery]) ?? []),
        ] as const) {
          assert.notInclude(all, value, name);
        }

        // A six-digit code could be part of any number: it never appears
        // as a value of its own.
        for (const sent of [wrong, code]) {
          assert.notInclude(all, `"${sent}"`);
          assert.notInclude(all, `=${sent}`);
        }
      })
    );
  }
);

layer(
  Layer.mergeAll(WebhooksTest, capture, Layer.succeed(Tracer.Tracer, tracer)),
  { timeout: "60 seconds" }
)("what the server writes about webhook deliveries", (it) => {
  it.effect(
    "holds no value of an endpoint's headers, nor does the delivery log",
    () =>
      Effect.gen(function* searched() {
        const owner = yield* freshOwner;
        const endpoints = yield* WebhookEndpoints;
        const deliveries = yield* WebhookDeliveries;
        const transport = yield* FakeTransport;
        const first = "Bearer synthetic-header-value-first";
        const second = "synthetic-header-value-second";

        const { endpoint, host } = yield* freshEndpoint(owner, {
          headers: [{ name: "Authorization", value: first }],
        });

        const changed = yield* endpoints.update(owner, endpoint.id, {
          headers: [
            { name: "Authorization", value: first },
            { name: "X-Gateway-Key", value: second },
          ],
        });

        // Delivered with them, refused by the receiver, then tried again.
        yield* transport.next(
          host,
          answered(500, "Internal error"),
          answered(204)
        );

        const delivery = yield* endpoints.sendTest(owner, endpoint.id);

        yield* DeliverWebhook.use((delivering) =>
          delivering.attempt(delivery.id, 1)
        );
        yield* DeliverWebhook.use((delivering) =>
          delivering.attempt(delivery.id, 2)
        );

        const [request] = yield* transport.sentTo(host);

        assert.strictEqual(request?.headers["X-Gateway-Key"], second);

        const log = yield* deliveries.page(owner, endpoint.id, {
          after: Option.none(),
          limit: 10,
        });

        const shown = JSON.stringify([
          toEndpointView(changed),
          toEndpointView(yield* endpoints.get(owner, endpoint.id)),
          log.items.map(toDeliveryView),
        ]);

        const all = written();

        assert.isAbove(spans.length, 0);

        for (const value of [first, second]) {
          assert.notInclude(all, value);
          assert.notInclude(shown, value);
        }
      })
  );
});

layer(Layer.mergeAll(capture, Layer.succeed(Tracer.Tracer, tracer)), {
  excludeTestServices: true,
  timeout: "60 seconds",
})("what the server writes about publishing a reel", (it) => {
  it.effect(
    "holds no Page token, which the upload carries in its Authorization header",
    () =>
      Effect.gen(function* searched() {
        const token = "synthetic-page-token-in-an-upload-header";
        const clip = testFile("video", 4096);
        const graph = yield* fakeMetaGraph([token]);

        const client = yield* metaClientWith({
          appSecret: graphAppSecret,
          credentials: credentialsOf(
            { accountId: facebookPageId, platform: "facebook" },
            [token]
          ),
          files: [clip],
          platform: "facebook",
          url: graph.url,
        });

        const result = yield* client
          .publish(
            yield* outgoing({
              accountId: facebookPageId,
              media: [attached(clip)],
              options: Option.some(new FacebookOptions({ format: "reel" })),
            })
          )
          .pipe(Effect.withSpan("test.reel"));

        assert.strictEqual(result._tag, "published");
        assert.isTrue(
          graph
            .requests()
            .some((request) => request.path.startsWith("/video-upload/"))
        );
        // The upload was written about, with its address.
        assert.include(written(), "/video-upload/");
        assert.notInclude(written(), token);
      }).pipe(Effect.scoped)
  );
});

// The site's password goes on the wire, to a fake site on loopback with
// the guard open: what is written about those calls never holds it.
layer(
  Layer.mergeAll(
    capture,
    Layer.succeed(Tracer.Tracer, tracer),
    siteVerifiersLive({ devto: devtoHosts, hashnode: hashnodeHosts }).pipe(
      Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard))
    )
  ),
  { excludeTestServices: true, timeout: "60 seconds" }
)("what the server writes about checking a website", (it) => {
  it.effect(
    "holds no application password, which every call carries in its Authorization header",
    () =>
      Effect.gen(function* searched() {
        const onTheWire = "synthetic site password on the wire";

        const site = yield* fakeWordPress({
          users: [{ ...editor, password: onTheWire }],
        });

        const verified = yield* SiteVerifier.use((verifier) =>
          verifier.verify({
            address: site.home,
            applicationPassword: Redacted.make(onTheWire),
            platform: "wordpress",
            userName: editor.login,
          })
        ).pipe(Effect.withSpan("test.website"));

        assert.strictEqual(verified.accountId, site.root);
        // It went on the wire.
        assert.isTrue(
          site
            .requests()
            .some(
              ({ authorization }) =>
                authorization?.startsWith("Basic ") === true
            )
        );
        assert.include(written(), "/wp/v2/users/me");
        assert.notInclude(written(), onTheWire);
        assert.notInclude(written(), onTheWire.replaceAll(" ", ""));
      }).pipe(Effect.scoped)
  );
});

// Where the fakes of the key-based sites listen, set by the test.
const keySiteHosts = {
  devto: { api: "http://127.0.0.1:9" },
  hashnode: { api: "http://127.0.0.1:9/" },
};

// A DEV key and a Hashnode token go on the wire, to fakes on loopback:
// what is written about those calls holds neither.
layer(
  Layer.mergeAll(
    capture,
    Layer.succeed(Tracer.Tracer, tracer),
    siteVerifiersLive(keySiteHosts).pipe(
      Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard))
    )
  ),
  { excludeTestServices: true, timeout: "60 seconds" }
)("what the server writes about checking a website's key", (it) => {
  it.effect(
    "holds no key nor token, which every call carries in a header",
    () =>
      Effect.gen(function* searched() {
        const devto = yield* fakeDevTo();
        const hashnode = yield* fakeHashnode();

        keySiteHosts.devto.api = devto.api;
        keySiteHosts.hashnode.api = hashnode.api;

        yield* SiteVerifier.use((verifier) =>
          Effect.all([
            verifier.verifyKey({
              apiKey: Redacted.make(gardener.key),
              platform: "devto",
              publication: Option.none(),
            }),
            verifier.verifyKey({
              apiKey: Redacted.make(writerOnHashnode.token),
              platform: "hashnode",
              publication: Option.none(),
            }),
          ])
        ).pipe(Effect.withSpan("test.website-keys"));

        assert.strictEqual(
          devto.requests()[0]?.headers["api-key"],
          gardener.key
        );
        assert.strictEqual(
          hashnode.requests()[0]?.authorization,
          writerOnHashnode.token
        );
        assert.include(written(), "/api/users/me");
        assert.notInclude(written(), gardener.key);
        assert.notInclude(written(), writerOnHashnode.token);
      }).pipe(Effect.scoped)
  );
});

// Where the chats' fakes listen, set by the test.
const chatHosts = {
  discord: { api: "http://127.0.0.1:9" },
  telegram: { api: "http://127.0.0.1:9" },
};

// A Discord webhook's token and a Telegram bot's token go in the path of
// every address their platform is called at: what is written about a
// connection, a post that goes out, one the platform refuses and one that
// never gets an answer holds neither.
layer(
  Layer.mergeAll(
    capture,
    Layer.succeed(Tracer.Tracer, tracer),
    chatVerifiersLive(chatHosts).pipe(
      Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard))
    )
  ),
  { excludeTestServices: true, timeout: "60 seconds" }
)("what the server writes about chats", (it) => {
  it.effect(
    "holds no webhook token nor bot token, which every address carries",
    () =>
      Effect.gen(function* searched() {
        const discord = yield* fakeDiscordApi();
        const telegram = yield* fakeTelegramApi();

        chatHosts.discord.api = discord.url;
        chatHosts.telegram.api = telegram.url;

        // Connected: each platform is asked.
        yield* ChatVerifier.use((verifier) =>
          Effect.all([
            verifier.verify({
              platform: "discord",
              webhookUrl: Redacted.make(
                `https://discord.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`
              ),
            }),
            verifier.verify({
              botToken: Redacted.make(telegramBotToken),
              chat: "@synthetic_news",
              platform: "telegram",
            }),
          ])
        ).pipe(Effect.withSpan("test.chat-connections"));

        const slow = yield* httpClientTimingOutAfter("300 millis");

        const onDiscord = yield* discordClientWith({
          api: discord.url,
          credentials: credentialsOf(
            { accountId: discordAccount, platform: "discord" },
            [discordSecret]
          ),
          http: slow,
        });

        const onTelegram = yield* telegramClientWith({
          api: telegram.url,
          credentials: credentialsOf(
            { accountId: telegramAccount, platform: "telegram" },
            [telegramBotToken]
          ),
          http: slow,
        });

        // A post goes out, one is refused, and one is never answered.
        discord.script(`POST ${discord.webhookPath}`, [
          { _tag: "answer", body: {}, status: 200 },
        ]);
        discord.script(`POST ${discord.webhookPath}`, [
          json({ code: 50_035, message: "Synthetic" }, 400),
          { _tag: "hang" },
        ]);
        telegram.script("sendMessage", [
          { _tag: "answer", body: { ok: true }, status: 200 },
        ]);

        const results = yield* Effect.all(
          [
            onDiscord.publish(yield* outgoing({ accountId: discordAccount })),
            onDiscord.publish(yield* outgoing({ accountId: discordAccount })),
            onDiscord.publish(yield* outgoing({ accountId: discordAccount })),
            onTelegram.publish(yield* outgoing({ accountId: telegramAccount })),
            onTelegram.publish(yield* outgoing({ accountId: telegramAccount })),
          ].map((publish) => publish.pipe(Effect.exit))
        ).pipe(Effect.withSpan("test.chat-posts"));

        assert.strictEqual(results.length, 5);
        assert.isAbove(discord.requests().length, 3);
        assert.isAbove(telegram.requests().length, 4);

        const all = written();

        // The calls were written about, by name.
        assert.include(all, "DiscordWebhookVerifier.verify");
        assert.include(all, "TelegramChatVerifier.verify");
        assert.include(all, "DiscordClient.commit");
        assert.notInclude(all, discordWebhookToken);
        assert.notInclude(all, telegramBotToken);
        assert.notInclude(all, telegramBotToken.split(":")[1] ?? "");
      }).pipe(Effect.scoped)
  );
});

// Where the WordPress.com the test started listens.
const comHosts = { api: "http://127.0.0.1:9" };

// WordPress.com's sign-in sends the app's secret and the member's code,
// and gets the site's token, which the site's description is read with:
// what is written about those calls holds none of them.
layer(
  Layer.mergeAll(
    capture,
    Layer.succeed(Tracer.Tracer, tracer),
    Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard),
    SecureRandom.layerWebCrypto
  ),
  { excludeTestServices: true, timeout: "60 seconds" }
)("what the server writes about signing in to WordPress.com", (it) => {
  it.effect("holds no client secret, code nor token", () =>
    Effect.gen(function* searched() {
      const com = {
        blogId: 2_024_001,
        code: "synthetic-code-on-the-wire",
        token: "synthetic-wpcom-token-on-the-wire",
      };

      const secret = "synthetic-wpcom-secret-on-the-wire";
      const site = yield* fakeWordPress({ wordpressCom: com });

      comHosts.api = new URL(site.home).origin;

      const authorizer = yield* wordpressComAuthorizer({
        client: { clientId: "153160", clientSecret: Redacted.make(secret) },
        hosts: comHosts,
        http: yield* publicHttpClient,
        publicUrl: "https://peal.example.com",
      });

      const grant = yield* authorizer
        .complete(com.code)
        .pipe(Effect.withSpan("test.wordpress-com"));

      assert.strictEqual(grant.site.accountId, String(com.blogId));
      assert.include(written(), "/oauth2/token");
      assert.notInclude(written(), secret);
      assert.notInclude(written(), com.code);
      assert.notInclude(written(), com.token);
    }).pipe(Effect.scoped)
  );
});

const slackChangeId = LivePostChangeIdSchema.make(
  "00000000-0000-7000-8000-0000000000e4"
);

const slackChannelId = ChannelIdSchema.make(
  "00000000-0000-7000-8000-0000000000c4"
);

// Slack's install sends the app's secret and the member's code, and gets
// the bot's token, and the incoming webhook's address, which Peal never
// keeps; every call after sends the token in its header. What is written
// about an install, a post that goes out, one with an image, one Slack
// refuses, one never answered, an edit and a deletion holds none of them.
layer(
  Layer.mergeAll(
    capture,
    Layer.succeed(Tracer.Tracer, tracer),
    Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard),
    SecureRandom.layerWebCrypto
  ),
  { excludeTestServices: true, timeout: "60 seconds" }
)("what the server writes about Slack", (it) => {
  it.effect("holds no client secret, code, bot token nor webhook address", () =>
    Effect.gen(function* searched() {
      const oauth = yield* fakeSlack();
      const secret = slackClient.clientSecret;

      const authorizer = yield* slackAuthorizer({
        client: {
          clientId: slackClient.clientId,
          clientSecret: Redacted.make(secret),
        },
        hosts: oauth.hosts,
        http: yield* publicHttpClient,
        publicUrl: "https://peal.example.com",
      });

      const { authorizationUrl } = yield* authorizer.begin({
        handle: Option.none(),
        instance: Option.none(),
        reconnecting: Option.none(),
      });

      const back = oauth.approve(authorizationUrl);
      const now = DateTime.makeUnsafe("2026-11-16T09:00:00.000Z");

      yield* authorizer
        .complete({
          attempt: new ConnectAttempt({
            channelId: Option.none(),
            connection: Option.none(),
            createdAt: now,
            expiresAt: DateTime.addDuration(now, "15 minutes"),
            instance: Option.none(),
            platform: "slack",
            startedBy: "user:synthetic",
            state: back.state,
            workspaceId: WorkspaceIdSchema.make(
              "01900000-0000-7000-8000-0000000000f3"
            ),
          }),
          callback: {
            code: Option.some(back.code),
            error: Option.none(),
            issuer: Option.none(),
            state: back.state,
          },
          reconnecting: Option.none(),
          secret: Redacted.make(""),
        })
        .pipe(Effect.withSpan("test.slack-install"));

      const slack = yield* fakeSlackApi();
      const slow = yield* httpClientTimingOutAfter("300 millis");
      const image = testFile("image", 512);

      const credentials = Layer.succeedContext(
        yield* Layer.build(
          credentialsOf({ accountId: slackAccount, platform: "slack" }, [
            slackBotToken,
          ])
        )
      );

      const onSlack = yield* slackClientWith({
        api: slack.url,
        credentials,
        files: [image],
        http: slow,
      });

      slack.script("chat.postMessage", [
        json({ error: "not_in_channel", ok: false }),
        { _tag: "hang" },
      ]);
      // The fifth post's upload never gets an answer.
      slack.script("upload", [
        { _tag: "answer", status: 200 },
        { _tag: "hang" },
      ]);

      const results = yield* Effect.all(
        [
          onSlack.publish(yield* outgoing({ accountId: slackAccount })),
          onSlack.publish(yield* outgoing({ accountId: slackAccount })),
          onSlack.publish(
            yield* outgoing({
              accountId: slackAccount,
              media: [attached(image)],
            })
          ),
          onSlack.publish(yield* outgoing({ accountId: slackAccount })),
          onSlack.publish(
            yield* outgoing({
              accountId: slackAccount,
              media: [attached(image)],
            })
          ),
        ].map((publish) => publish.pipe(Effect.exit))
      ).pipe(Effect.withSpan("test.slack-posts"));

      const withImage = results.at(2);

      assert(withImage !== undefined && withImage._tag === "Success");
      assert(withImage.value._tag === "published");

      const live = yield* liveClientsOn({
        credentials,
        edits: new Map([
          [
            slackChangeId,
            { media: [], options: Option.none(), text: "Corrected" },
          ],
        ]),
        platforms: { slackHosts: { api: slack.url, uploads: slack.url } },
      });

      yield* Effect.all([
        live.edit({
          changeId: slackChangeId,
          channelId: slackChannelId,
          platformPostId: withImage.value.platformPostId,
        }),
        live.remove({
          channelId: slackChannelId,
          platformPostId: withImage.value.platformPostId,
        }),
      ]).pipe(Effect.withSpan("test.slack-changes"));

      const all = written();

      assert.include(all, "/api/oauth.v2.access");
      assert.include(all, "SlackClient.make");
      assert.isAbove(slack.requests().length, 6);
      assert.notInclude(all, secret);
      assert.notInclude(all, back.code);
      assert.notInclude(all, "xoxb-synthetic-installed-token");
      assert.notInclude(all, "synthetic-webhook-secret");
      assert.notInclude(all, slackBotToken);
      assert.lengthOf(
        slack.requests().filter(({ path }) => path.startsWith("/upload/")),
        2
      );
      assert.notInclude(all, slackUploadTicket);
    }).pipe(Effect.scoped)
  );
});

const shortBase = "http://links.example.com/api/l/";

const shortLinkSettings = {
  ...unconfirmedEmails,
  PEAL_SHORT_LINK_BASE: shortBase,
};

// The app with short links on, and the context beside it to issue one.
const ShortLinksTest = Layer.mergeAll(
  TestApp.layerWith(
    shortLinkSettings,
    Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
  ),
  ShortLinksLive.pipe(
    Layer.provide(OpenLinkStanding),
    Layer.provide(
      ConfigProvider.layerAdd(ConfigProvider.fromUnknown(shortLinkSettings), {
        asPrimary: true,
      })
    ),
    Layer.provideMerge(DatabaseTest)
  )
);

layer(ShortLinksTest, { excludeTestServices: true, timeout: "120 seconds" })(
  "what the server writes about a short link followed",
  (it) => {
    // Nothing of the visitor either: no span holds their browser or
    // address, as the privacy register says.
    it.effect("holds its path, never where it leads nor who followed it", () =>
      Effect.gen(function* followed() {
        const app = yield* TestApp;
        const links = yield* ShortLinks;

        const destination =
          "https://example.test/synthetic-destination-never-logged";

        const target = yield* liveTarget("logged-link", true);

        const [shortUrl = ""] = yield* links.issue({
          channelId: ChannelIdSchema.make(target.channelId),
          destinations: [destination],
          part: 0,
          postId: PostIdSchema.make(target.postId),
          targetId: PostTargetIdSchema.make(target.targetId),
          workspaceId: WorkspaceIdSchema.make(target.workspaceId),
        });

        const { pathname } = new URL(shortUrl);
        const agent = "Mozilla/5.0 (synthetic visitor agent)";

        const reply = yield* app.request(pathname, {
          headers: { "user-agent": agent, "x-forwarded-for": "203.0.113.77" },
        });

        assert.strictEqual(reply.status, 302);
        assert.include(written(), pathname);
        assert.notInclude(written(), "synthetic-destination-never-logged");
        assert.notInclude(written(), "synthetic visitor agent");
        assert.notInclude(written(), "203.0.113.77");
      })
    );
  }
);

// The image provider's key, and the prompt, which the server never writes:
// a loopback provider that refuses a prompt naming "refused" with 401, and
// answers any other with an image.
const imageKey = "sk_test_synthetic_image_provider_key";
const inPrompt = "synthetic-prompt-marker-in-a-secret-test";

const decodePort = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

const imageProvider = Effect.acquireRelease(
  Effect.promise(async () => {
    const png = await sharp({
      create: { background: "#224466", channels: 3, height: 16, width: 16 },
    })
      .png()
      .toBuffer();

    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on("end", () => {
        const refused = Buffer.concat(chunks)
          .toString("utf-8")
          .includes("refused");

        response.writeHead(refused ? 401 : 200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify(
            refused
              ? { error: { message: `Invalid key ${imageKey}` } }
              : { created: 1, data: [{ b64_json: png.toString("base64") }] }
          )
        );
      });
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    return {
      server,
      url: `http://127.0.0.1:${String(decodePort(server.address()).port)}/v1`,
    };
  }),
  ({ server }) =>
    Effect.promise(async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    })
);

const ImagesTest = Layer.unwrap(
  imageProvider.pipe(
    Effect.map(({ url }) =>
      Layer.mergeAll(
        TestApp.layerWith(
          {
            ...unconfirmedEmails,
            PEAL_AI_IMAGE_API_KEY: imageKey,
            PEAL_AI_IMAGE_BASE_URL: url,
            PEAL_AI_IMAGE_MODEL: "synthetic-image-model",
            PEAL_AI_IMAGE_PROVIDER: "openai-compatible",
          },
          Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
        ),
        MigratedSqlLive
      )
    )
  )
);

const MadeSchema = Schema.Struct({ id: Schema.String });

layer(ImagesTest, { excludeTestServices: true, timeout: "180 seconds" })(
  "what the server writes about images",
  (it) => {
    it.effect("holds neither the image provider's key nor the prompt", () =>
      Effect.gen(function* images() {
        const app = yield* TestApp;
        const owner = yield* signedUp("secrets-images");
        const workspaceId = yield* workspaceOf(owner, "Images");
        const headers = { cookie: owner.cookies };
        const path = `/api/workspaces/${workspaceId}/assistant/images`;

        const made = yield* app.request(path, {
          body: { aspect: "square", prompt: `A lighthouse. ${inPrompt}` },
          headers,
        });

        assert.strictEqual(made.status, 201);

        const refused = yield* app.request(path, {
          body: { aspect: "square", prompt: `It is refused. ${inPrompt}` },
          headers,
        });

        assert.strictEqual(refused.status, 503);

        const { id } = yield* bodyOf(MadeSchema, made);

        yield* app.request(`/api/workspaces/${workspaceId}/media/${id}`, {
          headers,
          method: "DELETE",
        });

        // The refusal is told to the operator, by its status alone.
        assert.include(written(), "refused the server's settings");
        assert.notInclude(written(), imageKey);
        assert.notInclude(written(), inPrompt);
      })
    );
  }
);

// The key a workspace gave for its own image provider, and what it asks
// for: neither is ever written, in a log, a span, the activity log or an
// answer. Saving calls no provider, so the app saves one at a public
// literal address it never reaches, and is refused one inside.
const workspaceKey = "synthetic-workspace-image-key";
const inOwnPrompt = "synthetic-prompt-marker-for-a-workspace-provider";

const OwnProviderAppTest = Layer.mergeAll(
  TestApp.layerWith(
    { ...unconfirmedEmails, PEAL_TOKEN_KEYS: syntheticKeyring },
    Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
  ),
  MigratedSqlLive
);

const ActivityRowsSchema = Schema.Array(Schema.Struct({ row: Schema.String }));

layer(OwnProviderAppTest, {
  excludeTestServices: true,
  timeout: "180 seconds",
})("what the server writes about a workspace's image provider", (it) => {
  it.effect(
    "holds its key nowhere: logs, spans, the activity log, the answers",
    () =>
      Effect.gen(function* searched() {
        const app = yield* TestApp;
        const sql = yield* SqlClient.SqlClient;
        const owner = yield* signedUp("secrets-own-images");
        const workspaceId = yield* workspaceOf(owner, "Own images");
        const headers = { cookie: owner.cookies };
        const path = `/api/workspaces/${workspaceId}/assistant/image-provider`;

        const saved = yield* app.request(path, {
          body: {
            apiKey: workspaceKey,
            baseUrl: "https://1.1.1.1/v1",
            model: "synthetic-image-model",
          },
          headers,
          method: "PUT",
        });

        const inside = yield* app.request(path, {
          body: {
            apiKey: workspaceKey,
            baseUrl: "https://10.0.0.8/v1",
            model: "synthetic-image-model",
          },
          headers,
          method: "PUT",
        });

        const read = yield* app.request(path, { headers });

        const status = yield* app.request(
          `/api/workspaces/${workspaceId}/assistant`,
          { headers }
        );

        const removed = yield* app.request(path, { headers, method: "DELETE" });

        assert.deepStrictEqual(
          [
            saved.status,
            inside.status,
            read.status,
            status.status,
            removed.status,
          ],
          [200, 422, 200, 200, 204]
        );

        const activity =
          yield* sql`SELECT row_to_json(e)::text AS row FROM activity.events e WHERE workspace_id = ${workspaceId}`.pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(ActivityRowsSchema))
          );

        // The writes were kept, done and refused, without their bodies.
        assert.isAtLeast(activity.length, 3);

        const answers = JSON.stringify(
          [saved, inside, read, status].map(({ body }) => body)
        );

        for (const text of [written(), answers, JSON.stringify(activity)]) {
          assert.notInclude(text, workspaceKey);
        }

        // Nor the host of an address refused when it was saved.
        assert.notInclude(written(), "10.0.0.8");
      })
  );
});

// The key a workspace gave for its own text provider: never written, in a
// log, a span, the activity log or an answer. Saving calls no provider.
const workspaceTextKey = "synthetic-workspace-text-key";

layer(OwnProviderAppTest, {
  excludeTestServices: true,
  timeout: "180 seconds",
})("what the server writes about a workspace's text provider", (it) => {
  it.effect(
    "holds its key nowhere: logs, spans, the activity log, the answers",
    () =>
      Effect.gen(function* searched() {
        const app = yield* TestApp;
        const sql = yield* SqlClient.SqlClient;
        const owner = yield* signedUp("secrets-own-text");
        const workspaceId = yield* workspaceOf(owner, "Own text");
        const headers = { cookie: owner.cookies };
        const path = `/api/workspaces/${workspaceId}/assistant/text-provider`;

        const saved = yield* app.request(path, {
          body: {
            apiKey: workspaceTextKey,
            baseUrl: "https://1.1.1.1/v1",
            kind: "openai-compatible",
            model: "synthetic-text-model",
          },
          headers,
          method: "PUT",
        });

        const inside = yield* app.request(path, {
          body: {
            apiKey: workspaceTextKey,
            baseUrl: "https://10.0.0.9/v1",
            kind: "anthropic",
            model: "synthetic-text-model",
          },
          headers,
          method: "PUT",
        });

        const read = yield* app.request(path, { headers });

        const status = yield* app.request(
          `/api/workspaces/${workspaceId}/assistant`,
          { headers }
        );

        const removed = yield* app.request(path, { headers, method: "DELETE" });

        assert.deepStrictEqual(
          [
            saved.status,
            inside.status,
            read.status,
            status.status,
            removed.status,
          ],
          [200, 422, 200, 200, 204]
        );

        const activity =
          yield* sql`SELECT row_to_json(e)::text AS row FROM activity.events e WHERE workspace_id = ${workspaceId}`.pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(ActivityRowsSchema))
          );

        assert.isAtLeast(activity.length, 3);

        const answers = JSON.stringify(
          [saved, inside, read, status].map(({ body }) => body)
        );

        for (const text of [written(), answers, JSON.stringify(activity)]) {
          assert.notInclude(text, workspaceTextKey);
        }

        assert.notInclude(written(), "10.0.0.9");
      })
  );
});

const OwnImagesTest = Layer.mergeAll(
  S3MediaStorageLive,
  DrizzleMediaAssetsLive,
  capture,
  Layer.succeed(Tracer.Tracer, tracer)
).pipe(
  Layer.provideMerge(AssistantDatabaseTest),
  Layer.provide(storageSettings)
);

// A provider on loopback that refuses a prompt naming "refused" with 401,
// quoting the key it was sent, and answers any other with an image.
const ownProvider = Effect.acquireRelease(
  Effect.promise(async () => {
    const png = await sharp({
      create: { background: "#446622", channels: 3, height: 16, width: 16 },
    })
      .png()
      .toBuffer();

    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        const refused = body.includes("refused");

        response.writeHead(refused ? 401 : 200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify(
            refused
              ? {
                  error: {
                    message: `Invalid key ${request.headers.authorization ?? ""} for ${body}`,
                  },
                }
              : { created: 1, data: [{ b64_json: png.toString("base64") }] }
          )
        );
      });
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    return {
      server,
      url: `http://127.0.0.1:${String(decodePort(server.address()).port)}/v1`,
    };
  }),
  ({ server }) =>
    Effect.promise(async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    })
);

layer(OwnImagesTest, { excludeTestServices: true, timeout: "120 seconds" })(
  "what the server writes about a workspace's own images",
  (it) => {
    it.effect(
      "holds neither the workspace's key, its provider's address nor the prompt",
      () =>
        Effect.gen(function* images() {
          const assistant = yield* WritingAssistant;
          const sql = yield* SqlClient.SqlClient;
          const host = yield* ownProvider;
          const workspaceId = WorkspaceIdSchema.make(crypto.randomUUID());
          const admin = actorIn(workspaceId, permissionsFor("admin"));

          yield* Effect.addFinalizer(() =>
            sql`DELETE FROM assistant.image_providers WHERE workspace_id = ${workspaceId}`.pipe(
              Effect.andThen(
                sql`DELETE FROM media.media_assets WHERE workspace_id = ${workspaceId}`
              ),
              Effect.ignore
            )
          );

          const saved = yield* assistant.saveImageProvider(admin, {
            apiKey: workspaceKey,
            baseUrl: host.url,
            model: "synthetic-image-model",
          });

          const made = yield* assistant.generateImage(actorIn(workspaceId), {
            aspect: "square",
            prompt: `A field of wheat. ${inOwnPrompt}`,
          });

          const refused = yield* assistant
            .generateImage(actorIn(workspaceId), {
              aspect: "square",
              prompt: `It is refused. ${inOwnPrompt}`,
            })
            .pipe(Effect.flip);

          assert.strictEqual(made.kind, "image");
          assert.deepInclude(refused, {
            _tag: "ImageProviderRefused",
            status: 401,
          });

          const all = written();

          // The refusal was told, by its status.
          assert.include(all, "refused its settings");

          for (const text of [all, JSON.stringify([saved, made, refused])]) {
            assert.notInclude(text, workspaceKey);
            assert.notInclude(text, inOwnPrompt);
          }

          assert.notInclude(all, new URL(host.url).host);
        }).pipe(Effect.provide(imagesTest({ providers: "loopback" })))
    );
  }
);

// Meta's events: the verify token, which the handshake carries in its
// query, the app's secret and the signature, and what an event's body
// says of a message (its text, its sender), are never written, whether
// the request was refused or taken.
const eventsVerifyToken = "synthetic-verify-token-never-written-0001";
const eventsAppSecret = "synthetic-meta-app-secret-never-written";
const eventText = "synthetic-private-words-never-written";
const eventSender = "synthetic-sender-never-written";

const eventsSettings = {
  META_APP_ID: "1001",
  META_APP_SECRET: eventsAppSecret,
  META_WEBHOOK_VERIFY_TOKEN: eventsVerifyToken,
};

const EventsTest = TestApp.layerWith(
  eventsSettings,
  Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
);

layer(EventsTest, { excludeTestServices: true, timeout: "120 seconds" })(
  "what the server writes about Meta's events",
  (it) => {
    it.effect(
      "holds no verify token, secret, signature, text or sender, refused or taken",
      () =>
        Effect.gen(function* events() {
          const app = yield* TestApp;
          const path = "/api/platform-events/meta/facebook";

          const body = new TextEncoder().encode(
            JSON.stringify({
              entry: [
                {
                  id: "synthetic-page-nobody-connected",
                  messaging: [
                    {
                      message: { mid: "m_synthetic_logged", text: eventText },
                      recipient: { id: "synthetic-page-nobody-connected" },
                      sender: { id: eventSender },
                    },
                  ],
                },
              ],
              object: "page",
            })
          );

          const signature = yield* Effect.gen(function* signing() {
            const mac = yield* Mac.Mac;

            const key = yield* Mac.key(
              Mac.hmacSha256,
              new TextEncoder().encode(eventsAppSecret)
            );

            return Hex.encode(yield* mac.sign(key, body));
          }).pipe(
            Effect.provide(
              Mac.layerWebCrypto.pipe(
                Layer.provide(SecureRandom.layerWebCrypto)
              )
            ),
            Effect.orDie
          );

          const forged = "0".repeat(64);

          const send = (init: RequestInit, query = "") =>
            Effect.promise(async () => {
              const response = await app.handler(
                new Request(`http://localhost:3001${path}${query}`, init)
              );

              return response.status;
            });

          const handshake = (token: string) =>
            send(
              { method: "GET" },
              `?${new URLSearchParams({
                "hub.challenge": "1158201444",
                "hub.mode": "subscribe",
                "hub.verify_token": token,
              }).toString()}`
            );

          const event = (tag: string) =>
            send({
              body: new Uint8Array(body),
              headers: {
                "content-type": "application/json",
                "x-hub-signature-256": `sha256=${tag}`,
              },
              method: "POST",
            });

          assert.deepStrictEqual(
            [
              yield* handshake(eventsVerifyToken),
              yield* handshake(`${eventsVerifyToken}-wrong`),
              yield* event(forged),
              yield* event(signature),
            ],
            [200, 403, 403, 200]
          );

          // Refused again, at once: not written again, as a flood of
          // refusals on a public address would fill the logs.
          assert.deepStrictEqual(
            [yield* event(forged), yield* event(forged)],
            [403, 403]
          );

          const all = written();

          // The requests were written about: their path and the refusal,
          // once.
          assert.include(all, path);
          assert.strictEqual(
            all.split("Refused a platform's unsigned event").length - 1,
            1
          );

          for (const [name, secret] of [
            ["the verify token", eventsVerifyToken],
            ["the app's secret", eventsAppSecret],
            ["the signature", signature],
            ["the forged signature", forged],
            ["a message's text", eventText],
            ["a message's sender", eventSender],
          ] as const) {
            assert.notInclude(all, secret, name);
          }
        })
    );
  }
);

// PostHog's project token and personal key, which the server never writes:
// a PostHog that refuses every event and every deletion, quoting the token
// it was sent, so the server logs what it can of a failure.
const projectToken = "phc_synthetic";
const personalKey = "phx_synthetic";

const failingPostHog = fakeHttpServer((request) =>
  jsonAnswer(
    { error: `invalid token ${projectToken} ${personalKey}` },
    request.path.endsWith("/persons/bulk_delete/") ? 403 : 500
  )
);

const PostHogTest = Layer.unwrap(
  failingPostHog.pipe(
    Effect.map((posthog) =>
      Layer.mergeAll(
        TestApp.layerWith(
          {
            ...unconfirmedEmails,
            PEAL_POSTHOG_APP_HOST: posthog.url,
            PEAL_POSTHOG_HOST: posthog.url,
            PEAL_POSTHOG_KEY: projectToken,
            PEAL_POSTHOG_PERSONAL_API_KEY: personalKey,
            PEAL_POSTHOG_PROJECT_ID: "12345",
          },
          Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
        ),
        MigratedSqlLive
      )
    )
  )
);

layer(PostHogTest, { excludeTestServices: true, timeout: "180 seconds" })(
  "what the server writes about product analytics",
  (it) => {
    it.effect(
      "holds neither PostHog's project token nor its personal key",
      () =>
        Effect.gen(function* posthog() {
          const app = yield* TestApp;
          const owner = yield* signedUp("secrets-posthog");
          const workspaceId = yield* workspaceOf(owner, "Analysed");

          const deleted = yield* app.request(`/api/workspaces/${workspaceId}`, {
            body: { name: "Analysed" },
            headers: { cookie: owner.cookies },
            method: "DELETE",
          });

          assert.strictEqual(deleted.status, 204);

          // The refused events are logged, then the deletion, which is tried
          // four times after what was queued went out.
          yield* Effect.sync(() => written()).pipe(
            Effect.flatMap((text) =>
              text.includes("peal.erasure.analytics_failed")
                ? Effect.void
                : Effect.fail(text)
            ),
            Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 60 })
          );

          assert.include(
            written(),
            "PostHog did not take product analytics events"
          );
          assert.notInclude(written(), projectToken);
          assert.notInclude(written(), personalKey);
        })
    );
  }
);
