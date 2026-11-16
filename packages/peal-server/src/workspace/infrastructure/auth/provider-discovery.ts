import { once } from "node:events";
import { createServer } from "node:http";

import {
  Duration,
  Effect,
  Metric,
  Option,
  Ref,
  Schedule,
  Schema,
} from "effect";

import type { SignInProviderSettings } from "./sign-in-provider-settings.ts";
import { SignInProviderUnusable } from "./sign-in-provider-unusable.ts";
import { googleIssuer } from "./sign-in-providers.ts";
import type { SignInProviderId } from "./sign-in-providers.ts";

/**
 * How the server reads a provider's discovery: a few tries when it starts,
 * each with a time limit and a pause that grows; then, for a provider left
 * out, again and again in the background, the pause growing to a ceiling.
 */
export interface DiscoveryTiming {
  readonly attemptTimeout: Duration.Input;
  readonly attempts: number;
  readonly backoff: Duration.Input;
  readonly retryAtMost: Duration.Input;
  readonly retryEvery: Duration.Input;
}

// Three tries within about ten seconds when the server starts, which log
// one error if they all fail. Then a try every minute at most, each
// failure a warning: a provider that stays off would otherwise keep the
// server's error-log alert lit and hide every other error. Its own alert
// reads `providersUnavailable` (peal-sign-in-provider-unavailable).
export const discoveryTiming: DiscoveryTiming = {
  attemptTimeout: "3 seconds",
  attempts: 3,
  backoff: "500 millis",
  retryAtMost: "1 minute",
  retryEvery: "5 seconds",
};

// What OpenID Connect Discovery 1.0 (section 3) requires, and Peal reads:
// Better Auth verifies ID tokens only with an issuer, its keys and the
// algorithms they sign with.
const DiscoverySchema = Schema.Struct({
  authorization_endpoint: Schema.String,
  id_token_signing_alg_values_supported: Schema.NonEmptyArray(Schema.String),
  issuer: Schema.String,
  jwks_uri: Schema.String,
  token_endpoint: Schema.String,
});

const decodeDiscovery = Schema.decodeUnknownEffect(DiscoverySchema);

type Json = typeof Schema.Json.Type;

const decodeJson = Schema.decodeUnknownOption(Schema.Json);

const NotAnsweredSchema = Schema.TaggedStruct("NotAnswered", {});

const notAnswered = NotAnsweredSchema.make({});

// The document as the provider wrote it, or NotAnswered: no answer, not in
// time or not a 200 with JSON.
const read = (url: string, timeout: Duration.Input) =>
  Effect.tryPromise(async (signal) => {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal,
    });

    const body: unknown = response.ok ? await response.json() : undefined;

    return decodeJson(body);
  }).pipe(
    Effect.timeout(timeout),
    Effect.catchCause(() => Effect.succeed(Option.none())),
    Effect.flatMap((body) =>
      Option.match(body, {
        onNone: () => Effect.fail(notAnswered),
        onSome: Effect.succeed,
      })
    )
  );

// A document without what OpenID Connect requires: the operator's mistake.
const usable = (name: string, url: string, body: Json) =>
  decodeDiscovery(body).pipe(
    Effect.as(body),
    Effect.mapError(
      (issue) =>
        new SignInProviderUnusable({
          message: `Sign-in with ${name}: the discovery document at ${url} lacks what OpenID Connect requires (issuer, authorization_endpoint, token_endpoint, jwks_uri and a non-empty id_token_signing_alg_values_supported): ${issue.message}`,
        })
    )
  );

const decodePort = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

// The relay: an HTTP server on 127.0.0.1 in this process, which answers
// each provider's discovery as Peal read it, and 503 until then.
const relayServer = (
  documents: Ref.Ref<ReadonlyMap<SignInProviderId, string>>
) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const server = createServer((request, response) => {
        const [, id] = (request.url ?? "").split("/");

        const document = [...Ref.getUnsafe(documents)].find(
          ([provider]) => provider === id
        )?.[1];

        if (document === undefined) {
          response.writeHead(503, { connection: "close" });
          response.end();

          return;
        }

        response.writeHead(200, {
          connection: "close",
          "content-type": "application/json",
        });
        response.end(document);
      });

      server.listen(0, "127.0.0.1");
      await once(server, "listening");

      return {
        origin: `http://127.0.0.1:${String(decodePort(server.address()).port)}`,
        server,
      };
    }),
    ({ server }) =>
      Effect.promise(async () => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
      })
  );

/**
 * 1 while a sign-in provider set is left out because its discovery could
 * not be read, 0 once it answers, by `provider` (`google`, `oidc`): an
 * alert rule reads it (peal-sign-in-provider-unavailable).
 */
export const providersUnavailable = Metric.gauge(
  "peal.workspace.sign_in_providers.unavailable",
  {
    description:
      "Whether a sign-in provider is left out because its discovery document could not be read (1) or is offered (0)",
  }
);

const unavailableNow = (id: SignInProviderId, value: 0 | 1) =>
  Metric.update(
    Metric.withAttributes(providersUnavailable, { provider: id }),
    value
  );

const formatted = (duration: Duration.Input) =>
  Duration.format(Duration.fromInputUnsafe(duration));

/**
 * The providers' discovery, read when the server starts. Better Auth reads
 * each provider's from the relay this returns (`settings`), which answers
 * at once: its own read, which has no time limit, never waits on the
 * provider. A provider that does not answer the start-up's tries is left
 * out of `offered`, and the relay answers 503 for it, so Better Auth skips
 * it; it is logged as an error once and read again in the background, each
 * failure a warning and `providersUnavailable` at 1, until it answers, when the relay serves it, Better Auth's own retry at
 * the next sign-in naming it installs it, and `offered` lists it again. A
 * document without what OpenID Connect requires stops the server. With no
 * provider set, no relay is opened.
 */
export const discoveryRelay = Effect.fn("discoveryRelay")(
  function* discoveryRelay(
    settings: SignInProviderSettings,
    timing: DiscoveryTiming = discoveryTiming
  ) {
    const providers = [
      ...Option.match(settings.google, {
        onNone: () => [],
        onSome: (google) => [
          {
            id: "google" as const,
            name: "Google",
            url: `${google.issuer ?? googleIssuer}/.well-known/openid-configuration`,
          },
        ],
      }),
      ...Option.match(settings.oidc, {
        onNone: () => [],
        onSome: (oidc) => [
          { id: "oidc" as const, name: oidc.name, url: oidc.discoveryUrl },
        ],
      }),
    ];

    if (providers.length === 0) {
      return {
        offered: Effect.succeed<readonly SignInProviderId[]>([]),
        settings,
      };
    }

    const documents = yield* Ref.make<ReadonlyMap<SignInProviderId, string>>(
      new Map()
    );

    const relay = yield* relayServer(documents);

    const serve = (id: SignInProviderId, body: Json) =>
      unavailableNow(id, 0).pipe(
        Effect.andThen(
          Ref.update(
            documents,
            (served) => new Map([...served, [id, JSON.stringify(body)]])
          )
        )
      );

    yield* Effect.forEach(
      providers,
      Effect.fnUntraced(function* discover({ id, name, url }) {
        const body = yield* read(url, timing.attemptTimeout).pipe(
          Effect.retry({
            schedule: Schedule.exponential(timing.backoff),
            times: Math.max(timing.attempts - 1, 0),
          }),
          Effect.option
        );

        if (Option.isSome(body)) {
          yield* serve(id, yield* usable(name, url, body.value));

          return;
        }

        yield* unavailableNow(id, 1);
        yield* Effect.logError(
          `Sign-in with ${name} is off: its discovery document at ${url} could not be read in ${String(timing.attempts)} tries of ${formatted(timing.attemptTimeout)}. The server reads it again in the background until it answers.`
        );

        // Again and again, until the provider answers with a document the
        // server can use.
        yield* read(url, timing.attemptTimeout).pipe(
          Effect.flatMap((answer) => usable(name, url, answer)),
          Effect.tapError(() =>
            Effect.logWarning(
              `Sign-in with ${name} is still off: its discovery document at ${url} could not be read, or lacks what OpenID Connect requires.`
            )
          ),
          Effect.retry(
            // The pause grows, and never past the ceiling.
            Schedule.min([
              Schedule.exponential(timing.retryEvery),
              Schedule.spaced(timing.retryAtMost),
            ])
          ),
          Effect.flatMap((answer) => serve(id, answer)),
          Effect.andThen(
            Effect.logInfo(
              `Sign-in with ${name} is on again: its discovery answered.`
            )
          ),
          Effect.forkScoped
        );
      }),
      { concurrency: "unbounded", discard: true }
    );

    const relayUrl = (id: SignInProviderId) =>
      `${relay.origin}/${id}/.well-known/openid-configuration`;

    const relayed: SignInProviderSettings = {
      google: settings.google.pipe(
        Option.map((google) => ({
          ...google,
          discoveryUrl: relayUrl("google"),
        }))
      ),
      oidc: settings.oidc.pipe(
        Option.map((oidc) => ({ ...oidc, discoveryUrl: relayUrl("oidc") }))
      ),
    };

    const offered = Ref.get(documents).pipe(
      Effect.map((served): readonly SignInProviderId[] =>
        providers.flatMap(({ id }) => (served.has(id) ? [id] : []))
      )
    );

    return { offered, settings: relayed };
  }
);
