import {
  ByteSize,
  Effect,
  Layer,
  Metric,
  Option,
  Redacted,
  Result,
  Schema,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import { ReceiveMessageEvents } from "#engagement/container.ts";
import {
  instagramAppConfig,
  metaAppConfig,
  metaEventsPath,
  metaWebhookVerifyTokenConfig,
} from "#shared/infrastructure/platforms/meta-apps.ts";
import type { MetaApp } from "#shared/infrastructure/platforms/meta-apps.ts";

import { decodeMetaEvents } from "./meta-events.ts";

/**
 * The most of a body read: Meta batches up to 1,000 updates, each of ids
 * and, for a message, its text (2,000 characters at most on Messenger).
 */
export const maxMetaEventBytes = 4 * 1024 * 1024;

const bodyLimit = ByteSize.bytes(maxMetaEventBytes);

/** The apps whose events the route takes, as the data deletion callback names them. */
const MetaEventAppSchema = Schema.Literals(["facebook", "instagram"]);

type MetaEventApp = typeof MetaEventAppSchema.Type;

const decodeApp = Schema.decodeUnknownOption(MetaEventAppSchema);

/**
 * Meta's events, by the app that sent them and how each ended: `taken`
 * (a box moved forward), `ignored` (no channel whose messages are on holds
 * the account), `unreadable` (signed, but not an event Peal reads) and
 * `unsigned` (refused before being read).
 */
export const platformEvents = Metric.counter("peal.platform_events", {
  description:
    "Events a platform sent about accounts' messages, by app and outcome",
  incremental: true,
});

type Outcome = "ignored" | "taken" | "unreadable" | "unsigned";

const counted = (app: MetaEventApp, outcome: Outcome) =>
  Metric.update(Metric.withAttributes(platformEvents, { app, outcome }), 1);

// What the handshake carries in its query (Meta's "Webhooks" pages:
// `hub.mode` "always be set to subscribe", `hub.challenge` "An int you must
// pass back to us", `hub.verify_token` the dashboard's Verify Token). A
// name given twice is no handshake.
const HandshakeSchema = Schema.Struct({
  "hub.challenge": Schema.optionalKey(Schema.String),
  "hub.mode": Schema.optionalKey(Schema.String),
  "hub.verify_token": Schema.optionalKey(Schema.String),
});

// Echoed back only when it is what Meta sends: digits, never what the
// public could make the server write.
const challengePattern = /^\d{1,32}$/u;

// `sha256=` and the HMAC-SHA256 of the body in lowercase hex ("with
// lowercase hex digits", Meta's "Webhooks" page).
const signaturePattern = /^sha256=(?<tag>[0-9a-f]{64})$/u;

const encoder = new TextEncoder();

const empty = (status: number) => HttpServerResponse.empty({ status });

/**
 * `GET` and `POST /api/platform-events/meta/:app`, without credentials:
 * Meta's events about the messages of the accounts its apps reach
 * (`facebook`, Pages and Instagram through a Page; `instagram`, Instagram
 * Login). Outside the contract, as the body's bytes are what is signed.
 *
 * - With no `META_WEBHOOK_VERIFY_TOKEN`, or no secret for the app, both
 *   answer 404 and nothing of the request is read.
 * - `GET`, the subscription's handshake: the challenge back, as plain
 *   text, only for `hub.mode=subscribe`, the verify token (compared in
 *   constant time) and a challenge of 1 to 32 digits; 403 otherwise.
 * - `POST`, an event: its body read as bytes up to `maxMetaEventBytes`
 *   (413), then `X-Hub-Signature-256` checked against the HMAC-SHA256 of
 *   those bytes under the app's secret (403, logged with the app and a
 *   reason, never the body or the signature), and only then decoded. A
 *   signed body Peal cannot read is taken (200), as Meta would send it
 *   again; one it reads goes to `ReceiveMessageEvents`, then 200 with no
 *   body; a database failure 503, which Meta sends again.
 */
export const PlatformEventsLive = HttpRouter.use(
  Effect.fn(function* platformEventsRoutes(router) {
    const receiving = yield* ReceiveMessageEvents;
    const mac = yield* Mac.Mac;
    const verifyToken = yield* metaWebhookVerifyTokenConfig;

    const apps: Readonly<Record<MetaEventApp, Option.Option<MetaApp>>> = {
      facebook: yield* metaAppConfig,
      instagram: yield* instagramAppConfig,
    };

    // The verify token, kept as its tag under a key of the process's own:
    // a token given is compared by its tag, in constant time.
    const tokenKey = yield* mac.generateKey(Mac.hmacSha256).pipe(Effect.orDie);

    const tokenTag = yield* Option.match(verifyToken, {
      onNone: () => Effect.succeedNone,
      onSome: (token) =>
        mac
          .sign(tokenKey, encoder.encode(Redacted.value(token)))
          .pipe(Effect.map(Option.some), Effect.orDie),
    });

    const secretKeys = {
      facebook: yield* keyOf(apps.facebook),
      instagram: yield* keyOf(apps.instagram),
    };

    // The app the path names, when the server takes its events.
    const appOfPath = Effect.gen(function* appOfPath() {
      const { app } = yield* HttpRouter.params;
      const named = decodeApp(app);

      return Option.isNone(tokenTag) || Option.isNone(named)
        ? Option.none()
        : secretKeys[named.value].pipe(
            Option.map((key) => ({ app: named.value, key }))
          );
    });

    const handshake = Effect.gen(function* handshake() {
      const reached = yield* appOfPath;

      if (Option.isNone(reached) || Option.isNone(tokenTag)) {
        return empty(404);
      }

      const query = yield* HttpServerRequest.schemaSearchParams(
        HandshakeSchema
      ).pipe(Effect.option);

      const challenge = query.pipe(
        Option.flatMap((given) =>
          Option.fromUndefinedOr(given["hub.challenge"])
        ),
        Option.filter((given) => challengePattern.test(given))
      );

      const token = query.pipe(
        Option.flatMap((given) =>
          Option.fromUndefinedOr(given["hub.verify_token"])
        )
      );

      const tokenMatches = Option.isSome(token)
        ? yield* mac
            .verify(tokenKey, tokenTag.value, encoder.encode(token.value))
            .pipe(Effect.orDie)
        : false;

      const subscribing = Option.exists(
        query,
        (given) => given["hub.mode"] === "subscribe"
      );

      if (!subscribing || !tokenMatches || Option.isNone(challenge)) {
        yield* Effect.logWarning("Refused a platform's events handshake").pipe(
          Effect.annotateLogs({ app: reached.value.app })
        );

        return empty(403);
      }

      return HttpServerResponse.text(challenge.value);
    });

    const event = Effect.gen(function* event() {
      const reached = yield* appOfPath;

      if (Option.isNone(reached)) {
        return empty(404);
      }

      const { app, key } = reached.value;
      const request = yield* HttpServerRequest.HttpServerRequest;

      const body = yield* request.arrayBuffer.pipe(
        Effect.provideService(HttpIncomingMessage.MaxBodySize, bodyLimit),
        Effect.map((buffer) => Result.succeed(new Uint8Array(buffer))),
        Effect.catchTag("HttpServerError", (error) =>
          Effect.succeed(
            Result.fail(
              error.reason._tag === "RequestParseError" &&
                error.reason.reason === "BodyTooLarge"
                ? ("tooLarge" as const)
                : ("unread" as const)
            )
          )
        )
      );

      if (Result.isFailure(body)) {
        return empty(body.failure === "tooLarge" ? 413 : 400);
      }

      const signature = signaturePattern.exec(
        request.headers["x-hub-signature-256"] ?? ""
      )?.groups?.["tag"];

      const tag = Option.fromUndefinedOr(signature).pipe(
        Option.flatMap((hex) => Result.getSuccess(Hex.decode(hex)))
      );

      const signed = Option.isSome(tag)
        ? yield* mac.verify(key, tag.value, body.success).pipe(Effect.orDie)
        : false;

      if (!signed) {
        yield* counted(app, "unsigned");
        yield* Effect.logWarning("Refused a platform's unsigned event").pipe(
          Effect.annotateLogs({
            app,
            reason: Option.isSome(tag)
              ? "the signature does not match"
              : "no signature of the expected form",
          })
        );

        return empty(403);
      }

      const events = decodeMetaEvents(body.success);

      if (Result.isFailure(events)) {
        yield* counted(app, "unreadable");

        return empty(200);
      }

      // Instagram Login's app tells of Instagram accounts alone.
      const meant = events.success.filter(
        ({ platform }) => app === "facebook" || platform === "instagram"
      );

      return yield* receiving.receive(meant).pipe(
        Effect.tap((outcome) => counted(app, outcome)),
        Effect.as(empty(200)),
        Effect.catchTag("DatabaseError", () =>
          Effect.logWarning(
            "Could not take a platform's events: it sends them again"
          ).pipe(Effect.annotateLogs({ app }), Effect.as(empty(503)))
        )
      );
    });

    yield* router.add("GET", metaEventsPath, handshake);
    yield* router.add("POST", metaEventsPath, event);
  })
).pipe(
  Layer.provide(
    Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
  )
);

// The app's secret as an HMAC key, when the server has the app.
const keyOf = (
  app: Option.Option<MetaApp>
): Effect.Effect<Option.Option<Mac.Key>> =>
  Option.match(app, {
    onNone: () => Effect.succeed(Option.none()),
    onSome: ({ appSecret }) =>
      Mac.key(Mac.hmacSha256, encoder.encode(Redacted.value(appSecret))).pipe(
        Effect.map(Option.some),
        Effect.orDie
      ),
  });
