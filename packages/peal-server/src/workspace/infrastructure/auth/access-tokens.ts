import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import {
  createDpopReplayStore,
  createInsufficientScopeError,
  enforceDpopBinding,
  isDpopBindingError,
  parseAccessTokenAuthorization,
  verifyJwsAccessToken,
} from "better-auth/oauth2";
import { Effect, Option, Redacted, Schema } from "effect";

import type { AccessTokenRequest } from "#workspace/application/auth-gateway.ts";
import { AuthUnavailable } from "#workspace/application/auth-unavailable.ts";
import { InvalidAccessToken } from "#workspace/application/invalid-access-token.ts";
import { WorkspaceScopeSchema } from "#workspace/domain/oauth-grant.ts";

import { BetterAuth } from "./better-auth.ts";
import { issuerOf } from "./oauth.ts";
import { AuthSettings } from "./settings.ts";
import { issuedBeforeReset, tokensNotBefore } from "./tokens-not-before.ts";

// Failures of fetching the keys, as opposed to keys that do not verify.
const unavailableKeyCodes: ReadonlySet<string> = new Set([
  "ERR_JWKS_INVALID",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_TIMEOUT",
]);

const decodeCode = Schema.decodeUnknownOption(
  Schema.Struct({ code: Schema.String })
);

const decodeChallenge = Schema.decodeUnknownOption(
  Schema.Struct({ "WWW-Authenticate": Schema.String })
);

const decodeScope = Schema.decodeUnknownOption(
  Schema.Struct({ scope: Schema.String })
);

const isWorkspaceScope = Schema.is(WorkspaceScopeSchema);

// Who a token was issued to, and when (seconds).
const decodeIssued = Schema.decodeUnknownOption(
  Schema.Struct({ iat: Schema.Number, sub: Schema.String })
);

// What a refusal tells the client, in its body and, for a credential that
// was sent, in the challenge's `error_description` (RFC 6750 §3: no `"` or
// `\`). Never the credential itself.
const authorizationServer =
  "the authorization server that the resource metadata in the WWW-Authenticate header names";

/**
 * The words of a credential that was sent and does not work, answered with
 * `invalid_token` (RFC 6750 §3.1). None may name DPoP: Better Auth's
 * challenge builder turns a 401 with `invalid_token` whose description holds
 * "DPoP" into a `DPoP` challenge, which has no `resource_metadata`, and a
 * client could no longer find where to sign in
 * (`test/workspace/infrastructure/access-token-refusals.test.ts`).
 */
export const invalidTokenReasons = [
  "expired",
  "invalid",
  "keyRefused",
  "revoked",
] as const;

type InvalidTokenReason = (typeof invalidTokenReasons)[number];

export const invalidTokenTexts: Readonly<Record<InvalidTokenReason, string>> = {
  expired: `The access token has expired. Refresh it, or sign in again through ${authorizationServer}.`,
  invalid: `The access token was refused: it is not one this server issued for this endpoint, or it no longer works. Sign in again through ${authorizationServer}.`,
  keyRefused: `The credential was refused: it is not an API key or access token that works on this server, and may have been revoked or have expired. Send a working API key of the workspace, or sign in through ${authorizationServer}.`,
  revoked: `The access token was revoked since it was issued. Sign in again through ${authorizationServer}.`,
};

/**
 * The words of the other refusals. `scheme` names DPoP, which is safe only
 * because it carries no error code: a request with a scheme the endpoint
 * does not take is one without credentials. Never answer it with
 * `invalid_token`, or move it into `invalidTokenTexts`.
 */
const refusalTexts = {
  missing: `This endpoint needs a credential. Sign in through ${authorizationServer}, or send an API key of a workspace as the bearer token.`,
  noWorkspaceScope:
    "The access token grants no workspace scope. Sign in again and allow at least workspace:read.",
  scheme:
    "The Authorization header uses a scheme this endpoint does not take. Send the credential as Bearer followed by the credential, or a DPoP-bound access token with its proof.",
} as const;

// RFC 6750 §3.1: a token that is valid but grants no workspace scope, asked
// to step up to reading at least.
const noWorkspaceScope = () =>
  createInsufficientScopeError(
    ["workspace:read"],
    refusalTexts.noWorkspaceScope
  );

const unauthorized = (
  message: string,
  error?: "invalid_dpop_proof" | "invalid_token"
): APIError =>
  new APIError(
    "UNAUTHORIZED",
    error === undefined
      ? { message }
      : { error, error_description: message, message }
  );

// What a token that does not work becomes: the answer that tells the client
// how to get one that does, with the RFC 9728 challenge pointing at the
// resource's metadata.
const invalidFor =
  (resource: string) =>
  (
    error: APIError | ReturnType<typeof noWorkspaceScope>
  ): AuthUnavailable | InvalidAccessToken => {
    const challenge = createResourceServerChallenge(error, resource);

    if (challenge === undefined) {
      return new AuthUnavailable({ cause: error });
    }

    return new InvalidAccessToken({
      challenge: decodeChallenge(challenge.headers).pipe(
        Option.match({
          onNone: () => "",
          onSome: (headers) => headers["WWW-Authenticate"],
        })
      ),
      description: challenge.message,
      status: challenge.statusCode === 403 ? 403 : 401,
    });
  };

/**
 * The refusal of a credential sent for `resource` that does not work, with
 * `invalid_token` and the words of `reason`.
 */
export const invalidTokenRefusal = (
  reason: InvalidTokenReason,
  resource: string
): AuthUnavailable | InvalidAccessToken =>
  invalidFor(resource)(
    unauthorized(invalidTokenTexts[reason], "invalid_token")
  );

/**
 * The answer to a credential that was sent for `resource` and works for
 * nothing there (a key no workspace has): refused as a token that does not
 * work is, with `invalid_token`, never as a missing one.
 */
export const credentialRefused = (
  resource: string
): Effect.Effect<never, AuthUnavailable | InvalidAccessToken> =>
  Effect.fail(invalidTokenRefusal("keyRefused", resource));

/**
 * Checks OAuth access tokens the way Better Auth's MCP plugin does
 * (`requireMcpAuth`), against its signing keys read in process rather than
 * fetched from /api/auth/jwks over the public URL: the signature, issuer,
 * audience, expiry and client (`azp`, which only OAuth access tokens carry),
 * and the DPoP proof of tokens bound to the client's key, whose replays are
 * refused across servers through the database. A token must also grant a
 * workspace scope, or it gets a 403 that asks for one.
 */
export const makeAccessTokens = Effect.gen(function* makeAccessTokens() {
  const auth = yield* BetterAuth;
  const settings = yield* AuthSettings;

  const { internalAdapter } = yield* Effect.promise(
    async () => await auth.$context
  );

  const replayStore = createDpopReplayStore(internalAdapter);
  const issuer = issuerOf(settings.publicUrl);

  // Better Auth caches the keys under this object for five minutes, and
  // reads them again for a token signed with a key it does not know.
  const jwksCacheKey = {};

  const jwksFetch = async () => {
    try {
      return await auth.api.getJwks();
    } catch (error) {
      throw new AuthUnavailable({ cause: error });
    }
  };

  /**
   * The claims of a request's access token, issued for `resource`, decoded
   * with `claims`. A token whose claims do not match reads as invalid.
   */
  const verify = <A>(
    request: AccessTokenRequest,
    resource: string,
    requiredClaims: readonly string[],
    claims: Schema.Decoder<A>
  ): Effect.Effect<A, AuthUnavailable | InvalidAccessToken> =>
    Effect.gen(function* verifyToken() {
      const invalid = invalidFor(resource);

      const authorization = parseAccessTokenAuthorization(
        request.authorization.pipe(
          Option.map(Redacted.value),
          Option.getOrUndefined
        )
      );

      if (authorization === undefined || authorization.token === "") {
        return yield* invalid(unauthorized(refusalTexts.missing));
      }

      // RFC 6750 §3.1: a scheme the server does not take is a request
      // without credentials, so its challenge carries no error code, and
      // leads the client to sign in as a missing one does.
      if (authorization.scheme === "Unknown") {
        return yield* invalid(unauthorized(refusalTexts.scheme));
      }

      const payload = yield* Effect.tryPromise({
        catch: (cause) => {
          if (cause instanceof AuthUnavailable) {
            return cause;
          }

          const code = decodeCode(cause).pipe(
            Option.map((found) => found.code)
          );

          if (Option.exists(code, (value) => unavailableKeyCodes.has(value))) {
            return new AuthUnavailable({ cause });
          }

          // RFC 6750 §3.1: a token that was sent and does not work is
          // `invalid_token`, expired ones included.
          return invalidTokenRefusal(
            Option.contains(code, "ERR_JWT_EXPIRED") ? "expired" : "invalid",
            resource
          );
        },
        try: async () =>
          await verifyJwsAccessToken(authorization.token, {
            jwksCacheKey,
            jwksFetch,
            verifyOptions: {
              audience: resource,
              issuer,
              requiredClaims: [...requiredClaims],
            },
          }),
      });

      yield* Effect.tryPromise({
        catch: (cause) =>
          isDpopBindingError(cause)
            ? invalid(unauthorized(cause.message, cause.code))
            : new AuthUnavailable({ cause }),
        try: async () => {
          await enforceDpopBinding({
            authorization,
            method: request.method,
            payload,
            proofJwt: Option.getOrUndefined(request.dpopProof),
            replayStore,
            url: new URL(request.path, settings.publicUrl).href,
          });
        },
      });

      // A token issued before its user's password was reset, or their
      // unconfirmed account released, ends with what the old password let
      // in (tokens-not-before.ts), though its signature still holds.
      const issued = decodeIssued(payload);

      if (Option.isSome(issued)) {
        const notBefore = yield* Effect.tryPromise({
          catch: (cause) => new AuthUnavailable({ cause }),
          try: async () =>
            await tokensNotBefore(internalAdapter, issued.value.sub),
        });

        if (issuedBeforeReset(issued.value.iat, notBefore)) {
          return yield* invalidTokenRefusal("revoked", resource);
        }
      }

      // A token that grants no workspace scope was agreed to for nothing in
      // Peal (its user's identity, say), so its client gets nothing from
      // Peal's tools or API either, the user's email and workspaces
      // included.
      const workspaceScoped = decodeScope(payload).pipe(
        Option.exists(({ scope }) =>
          scope.split(" ").some((granted) => isWorkspaceScope(granted))
        )
      );

      if (!workspaceScoped) {
        return yield* invalid(noWorkspaceScope());
      }

      return yield* Schema.decodeUnknownEffect(claims)(payload).pipe(
        Effect.mapError(() => invalidTokenRefusal("invalid", resource))
      );
    });

  return { verify };
});
