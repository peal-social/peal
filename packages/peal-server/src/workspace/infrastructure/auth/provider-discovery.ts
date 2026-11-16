import { Duration, Effect, Option, Schema } from "effect";

import type { SignInProviderSettings } from "./sign-in-provider-settings.ts";
import { SignInProviderUnusable } from "./sign-in-provider-unusable.ts";
import { googleIssuer } from "./sign-in-providers.ts";

/** How long a provider's discovery has to answer when the server starts. */
export const discoveryTimeout: Duration.Input = "10 seconds";

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

// The document, or none when the provider did not answer it, not in time
// or not with a 200.
const read = (url: string, timeout: Duration.Input) =>
  Effect.tryPromise(async (signal) => {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal,
    });

    const body: unknown = response.ok ? await response.json() : undefined;

    return Option.fromNullishOr(body);
  }).pipe(
    Effect.timeout(timeout),
    Effect.catchCause(() => Effect.succeed(Option.none()))
  );

/**
 * Whether the provider's discovery answers in time: a document without what
 * OpenID Connect requires stops the server; one that does not answer, or
 * not in time, leaves the provider out until the server starts again, said
 * in the log, so that Better Auth never waits on it while it starts.
 */
const checked = Effect.fn("checked")(function* checked(
  name: string,
  url: string,
  timeout: Duration.Input
) {
  const answer = yield* read(url, timeout);

  if (Option.isNone(answer)) {
    yield* Effect.logError(
      `Sign-in with ${name} is off until the server starts again: its discovery document at ${url} could not be read in ${Duration.format(Duration.fromInputUnsafe(timeout))}`
    );

    return false;
  }

  yield* decodeDiscovery(answer.value).pipe(
    Effect.mapError(
      (error) =>
        new SignInProviderUnusable({
          message: `Sign-in with ${name}: the discovery document at ${url} lacks what OpenID Connect requires (issuer, authorization_endpoint, token_endpoint, jwks_uri and a non-empty id_token_signing_alg_values_supported): ${error.message}`,
        })
    )
  );

  return true;
});

/** The providers set, without those whose discovery did not answer. */
export const checkedProviders = Effect.fn("checkedProviders")(
  function* checkedProviders(
    settings: SignInProviderSettings,
    timeout: Duration.Input = discoveryTimeout
  ) {
    const [google, oidc] = yield* Effect.all(
      [
        Effect.forEach(Option.toArray(settings.google), (client) =>
          checked(
            "Google",
            `${client.issuer ?? googleIssuer}/.well-known/openid-configuration`,
            timeout
          ).pipe(
            Effect.map((kept) => (kept ? Option.some(client) : Option.none()))
          )
        ),
        Effect.forEach(Option.toArray(settings.oidc), (provider) =>
          checked(provider.name, provider.discoveryUrl, timeout).pipe(
            Effect.map((kept) => (kept ? Option.some(provider) : Option.none()))
          )
        ),
      ],
      { concurrency: "unbounded" }
    );

    const result: SignInProviderSettings = {
      google: Option.flatten(Option.fromNullishOr(google?.[0])),
      oidc: Option.flatten(Option.fromNullishOr(oidc?.[0])),
    };

    return result;
  }
);
