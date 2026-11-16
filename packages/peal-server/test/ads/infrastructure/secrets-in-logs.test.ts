// What the server writes while it talks to Meta's Marketing API never holds
// a credential: the person's ad network token, the app's secret, its
// proof of that secret, or the code a sign-in hands back. The adapter runs
// against the loopback fake with a logger and a tracer that keep
// everything a line or a span would export, through a sign-in, a read, a
// refusal and the creation of a campaign.
import { createHmac } from "node:crypto";

import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
  Tracer,
} from "effect";

import { NetworkObjectIdSchema } from "#ads/domain/ids.ts";
import { CurrencySchema } from "#ads/domain/money.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import {
  googleAccessToken,
  googleAdsError,
  googleAdsSettings,
  googleRefreshToken,
  oauthError,
  searching,
  toToken,
} from "#test/ads/fakes/fake-google-ads-api.ts";
import {
  adsApp,
  adsToken,
  marketingError,
} from "#test/ads/fakes/fake-marketing-api.ts";
import { googleAgainstFake } from "#test/ads/google-client.ts";
import { metaAgainstFake, token } from "#test/ads/meta-client.ts";

const lines: string[] = [];
const spans: Tracer.NativeSpan[] = [];

const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);

    spans.push(span);

    return span;
  },
});

// Everything a logger is handed, as an exporter would write it.
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

const Watched = Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer));

describe("what the server writes about the ad network", () => {
  it.live(
    "holds no token, app secret, proof or sign-in code, through a sign-in, a read, a refusal and a creation",
    () =>
      Effect.gen(function* searched() {
        const { api, client } = yield* metaAgainstFake();
        const code = "good-code";

        const grant = yield* client.complete(code, Option.none());
        const {
          accounts: [account],
        } = yield* client.accounts(grant.token);

        yield* client.snapshot(grant.token, {
          currency: CurrencySchema.make("EUR"),
          externalId: account?.externalId ?? NetworkObjectIdSchema.make("1001"),
          reachedThrough: Option.none(),
          since: { day: 1, month: 11, year: 2026 },
          timeZone: TimeZoneIdSchema.make("Europe/Paris"),
          until: { day: 10, month: 11, year: 2026 },
        });

        // Refused by Meta, whose answer is logged and traced as a failure.
        api.script({
          answer: marketingError(190, undefined, 401),
          when: () => true,
        });

        const refused = yield* Effect.exit(
          client
            .accounts(token)
            .pipe(Effect.map(({ accounts: listed }) => listed))
        );

        assert.isTrue(Exit.isFailure(refused));

        // A campaign made, paused, as a boost's first step makes it.
        yield* Effect.exit(
          client.create(token, NetworkObjectIdSchema.make("1001"), {
            _tag: "campaign",
            name: "Peal boost b1",
          })
        );

        const all = [...lines, ...spans.map(spanText)].join("\n");

        // The calls were written about at all.
        assert.isAbove(spans.length, 3);

        const proof = createHmac("sha256", Redacted.value(adsApp.appSecret))
          .update(adsToken)
          .digest("hex");

        for (const [name, secret] of [
          ["the person's token", adsToken],
          ["the app's secret", Redacted.value(adsApp.appSecret)],
          ["the proof of the app's secret", proof],
          ["the sign-in's code", code],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(Effect.scoped, Effect.provide(Watched))
  );

  it.live(
    "holds no Google refresh token, access token, client secret, sign-in code or Google message, through a sign-in, the listing, a read and refusals",
    () =>
      Effect.gen(function* searched() {
        lines.length = 0;
        spans.length = 0;

        const { api, client } = yield* googleAgainstFake({
          accessible: ["1111111111", "2222222222"],
          campaigns: [
            {
              customerId: "3333333333",
              id: "901",
              name: "Winter sale",
              status: "ENABLED",
            },
          ],
          customers: [
            {
              currencyCode: "EUR",
              descriptiveName: "Example Studio",
              id: "1111111111",
              timeZone: "Europe/Paris",
            },
            {
              clients: ["3333333333"],
              currencyCode: "EUR",
              descriptiveName: "Example Agency",
              id: "2222222222",
              manager: true,
              timeZone: "Europe/Paris",
            },
            {
              currencyCode: "EUR",
              descriptiveName: "Example Client",
              id: "3333333333",
              timeZone: "Europe/Paris",
            },
          ],
          days: [
            {
              campaignId: "901",
              clicks: "3",
              costMicros: "1230000",
              customerId: "3333333333",
              date: "2026-11-09",
            },
          ],
        });

        const code = "good-code";

        const grant = yield* client.complete(
          code,
          Option.some(
            Redacted.make("synthetic-verifier-0123456789012345678901")
          )
        );

        const reached = yield* client.accounts(grant.token);

        yield* client.snapshot(grant.token, {
          currency: CurrencySchema.make("EUR"),
          externalId: NetworkObjectIdSchema.make("3333333333"),
          reachedThrough: Option.some(NetworkObjectIdSchema.make("2222222222")),
          since: { day: 1, month: 11, year: 2026 },
          timeZone: TimeZoneIdSchema.make("Europe/Paris"),
          until: { day: 10, month: 11, year: 2026 },
        });

        // Refused by Google, each answer quoting the query in its message,
        // and by the token endpoint, for the person's token and for Peal's
        // client.
        for (const [key, value] of [
          ["authorizationError", "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION"],
          ["authorizationError", "USER_PERMISSION_DENIED"],
          ["queryError", "UNRECOGNIZED_FIELD"],
        ] as const) {
          api.script({
            answer: googleAdsError(403, key, value),
            when: searching("customer"),
          });

          assert.isTrue(
            Exit.isFailure(
              yield* Effect.exit(
                client.account(
                  grant.token,
                  NetworkObjectIdSchema.make("1111111111"),
                  Option.none()
                )
              )
            )
          );
        }

        for (const refusal of [
          oauthError("invalid_grant"),
          oauthError("invalid_client", 401),
        ]) {
          api.script({ answer: refusal, when: toToken });

          assert.isTrue(
            Exit.isFailure(yield* Effect.exit(client.accounts(grant.token)))
          );
        }

        const all = [...lines, ...spans.map(spanText)].join("\n");

        // The calls were written about at all, and so was the listing.
        assert.isAbove(spans.length, 5);
        assert.isAbove(reached.accounts.length, 1);

        for (const [name, secret] of [
          ["the refresh token", googleRefreshToken],
          ["the access token", googleAccessToken],
          [
            "the client's secret",
            Redacted.value(googleAdsSettings.clientSecret),
          ],
          ["the sign-in's code", code],
          ["Google's message", "synthetic message quoting"],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(Effect.scoped, Effect.provide(Watched))
  );
});
