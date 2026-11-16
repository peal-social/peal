import {
  ByteSize,
  DateTime,
  Duration,
  Effect,
  Layer,
  Metric,
  Option,
  Redacted,
  Ref,
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
 * the account), `unreadable` (signed, but not an event Peal reads), `stale`
 * (signed, but sent over a day ago: entries left out) and `unsigned`
 * (refused before being read).
 */
export const platformEvents = Metric.counter("peal.platform_events", {
  description:
    "Events a platform sent about accounts' messages, by app and outcome",
  incremental: true,
});

type Outcome = "ignored" | "stale" | "taken" | "unreadable" | "unsigned";

/**
 * How often one kind of refusal is written to the logs at most: the
 * address is public, and `peal.platform_events` counts every one.
 */
export const refusalLogEvery = Duration.minutes(1);

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

// The path an app's events come to, exactly: no other spelling is the
// route's (`facebook;x`, a trailing slash, an encoded letter).
const pathOf = (app: MetaEventApp) => metaEventsPath.replace(":app", app);

const requestPath = (url: string) => url.split("?", 1)[0] ?? "";

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

    const mainKey = yield* keyOf(apps.facebook);

    // The keys an app's events are taken under. Instagram Login's: its own
    // secret, or the main app's, as Meta's "Set up Instagram Webhooks"
    // (read 2026-11-16) says "your app's App Secret" and points at the
    // app's basic settings without telling the two sign-ins apart. Both
    // are the operator's; the sandbox's trial settles which Meta uses, and
    // U9b keeps that one alone.
    const keysOf: Readonly<
      Record<
        MetaEventApp,
        Option.Option<readonly (readonly [string, Mac.Key])[]>
      >
    > = {
      facebook: mainKey.pipe(
        Option.map((key) => [["META_APP_SECRET", key] as const])
      ),
      instagram: (yield* keyOf(apps.instagram)).pipe(
        Option.map((own) => [
          ["INSTAGRAM_APP_SECRET", own] as const,
          ...Option.toArray(mainKey).map(
            (main) => ["META_APP_SECRET", main] as const
          ),
        ])
      ),
    };

    // When each kind of refusal was last written, so a flood writes one a
    // minute.
    const lastWritten = yield* Ref.make(new Map<string, number>());

    const sampled = (kind: string, written: Effect.Effect<void>) =>
      Effect.gen(function* sampling() {
        const now = DateTime.toEpochMillis(yield* DateTime.now);

        const due = yield* Ref.modify(lastWritten, (last) => {
          const before = last.get(kind);

          return before !== undefined &&
            now - before < Duration.toMillis(refusalLogEvery)
            ? [false, last]
            : [true, new Map(last).set(kind, now)];
        });

        yield* due ? written : Effect.void;
      });

    // The app the path names, when the server takes its events.
    const appOfPath = Effect.gen(function* appOfPath() {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { app } = yield* HttpRouter.params;

      const named = decodeApp(app).pipe(
        Option.filter((known) => requestPath(request.url) === pathOf(known))
      );

      return Option.isNone(tokenTag) || Option.isNone(named)
        ? Option.none()
        : keysOf[named.value].pipe(
            Option.map((keys) => ({ app: named.value, keys }))
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
        yield* sampled(
          `handshake:${reached.value.app}`,
          Effect.logWarning("Refused a platform's events handshake").pipe(
            Effect.annotateLogs({ app: reached.value.app })
          )
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

      const { app, keys } = reached.value;
      const request = yield* HttpServerRequest.HttpServerRequest;

      const refused = (reason: string) =>
        counted(app, "unsigned").pipe(
          Effect.andThen(
            sampled(
              `unsigned:${app}:${reason}`,
              Effect.logWarning("Refused a platform's unsigned event").pipe(
                Effect.annotateLogs({ app, reason })
              )
            )
          ),
          Effect.as(empty(403))
        );

      // The header's form first: without one, the body is never read.
      const tag = Option.fromUndefinedOr(
        signaturePattern.exec(request.headers["x-hub-signature-256"] ?? "")
          ?.groups?.["tag"]
      ).pipe(Option.flatMap((hex) => Result.getSuccess(Hex.decode(hex))));

      if (Option.isNone(tag)) {
        return yield* refused("no signature of the expected form");
      }

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

      // Every key is tried, each in constant time, whichever matches.
      const matched = yield* Effect.all(
        keys.map(([name, key]) =>
          mac.verify(key, tag.value, body.success).pipe(
            Effect.orDie,
            Effect.map((valid) => (valid ? [name] : []))
          )
        )
      ).pipe(Effect.map((names) => names.flat()));

      const [secret] = matched;

      if (secret === undefined) {
        return yield* refused("the signature does not match");
      }

      // For the sandbox's trial: which secret signed Instagram Login's
      // events (never the signature).
      if (app === "instagram") {
        yield* sampled(
          `secret:${secret}`,
          Effect.logInfo("Took an Instagram Login event").pipe(
            Effect.annotateLogs({ app, secret })
          )
        );
      }

      const events = decodeMetaEvents(body.success, yield* DateTime.now);

      if (Result.isFailure(events)) {
        yield* counted(app, "unreadable");

        return empty(200);
      }

      if (events.success.stale > 0) {
        yield* counted(app, "stale");
      }

      if (events.success.events.length === 0 && events.success.stale > 0) {
        return empty(200);
      }

      // Instagram Login's app tells of Instagram accounts alone.
      const meant = events.success.events.filter(
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
