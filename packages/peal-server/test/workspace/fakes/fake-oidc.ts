// An OpenID Provider on a loopback port, for the sign-in providers' tests:
// its discovery document, its keys and a token endpoint that answers, for
// each code a test registered, the ID token the test asked for, signed with
// a key made for the run. Tests never reach the network.
import { randomUUID } from "node:crypto";

import { Context, Effect, Layer } from "effect";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { CryptoKey, JWK, JWTPayload } from "jose";

import {
  fakeHttpServer,
  formOf,
  json,
} from "#test/channels/fakes/fake-http-server.ts";
import type { FakeHttpServer } from "#test/channels/fakes/fake-http-server.ts";
import { TestApp } from "#test/workspace/integration/harness.ts";

/** The client Peal is registered as at the fake provider. */
export const oidcClientId = "synthetic-oidc-client";

const oidcClientSecret = "synthetic-oidc-secret";

const algorithm = "ES256";

/** What an ID token says of the person, as a test sets it. */
export interface Identity {
  readonly email?: string;
  readonly email_verified?: boolean | string | undefined;
  readonly name?: string;
  readonly sub: string;
}

/** How a test spoils a token, to see it refused. */
export interface Spoiled {
  /** Signed with a key the provider never published. */
  readonly foreignKey?: boolean;
  readonly audience?: string;
  readonly issuer?: string;
  /** Without the nonce the sign-in sent, or with another one. */
  readonly nonce?: string | null;
  /** The token endpoint answers no ID token at all. */
  readonly withoutIdToken?: boolean;
}

interface SigningKey {
  readonly kid: string;
  readonly privateKey: CryptoKey;
  readonly publicJwk: JWK;
}

const signingKey = Effect.promise(async (): Promise<SigningKey> => {
  const { privateKey, publicKey } = await generateKeyPair(algorithm);
  const kid = randomUUID();

  return {
    kid,
    privateKey,
    publicJwk: {
      ...(await exportJWK(publicKey)),
      alg: algorithm,
      kid,
      use: "sig",
    },
  };
});

export interface FakeOidcProvider {
  /**
   * Registers a code, as the provider hands one to the browser, with the
   * ID token it will answer for it.
   */
  readonly issue: (
    identity: Identity,
    nonce: string,
    spoiled?: Spoiled
  ) => Effect.Effect<string>;
  readonly server: FakeHttpServer;
}

/** The fake provider the server was given as `PEAL_OIDC_ISSUER`. */
export class FakeOidc extends Context.Service<FakeOidc, FakeOidcProvider>()(
  "peal-server/test/FakeOidc"
) {}

const fakeOidc = Effect.gen(function* fakeOidc() {
  const key = yield* signingKey;
  const foreign = yield* signingKey;
  const answers = new Map<string, { idToken?: string }>();

  const server = yield* fakeHttpServer((request, origin) => {
    if (
      request.method === "GET" &&
      request.path === "/.well-known/openid-configuration"
    ) {
      return json({
        authorization_endpoint: `${origin}/authorize`,
        id_token_signing_alg_values_supported: [algorithm],
        issuer: origin,
        jwks_uri: `${origin}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        token_endpoint: `${origin}/token`,
      });
    }

    if (request.method === "GET" && request.path === "/jwks") {
      return json({ keys: [{ ...key.publicJwk }] });
    }

    if (request.method === "POST" && request.path === "/token") {
      const form = formOf(request);
      const answer = answers.get(form.get("code") ?? "");
      const authorized = request.headers["authorization"];
      const basic = `Basic ${Buffer.from(`${oidcClientId}:${oidcClientSecret}`).toString("base64")}`;

      if (
        answer === undefined ||
        (authorized !== basic &&
          form.get("client_secret") !== oidcClientSecret) ||
        (form.get("code_verifier") ?? "") === ""
      ) {
        return json({ error: "invalid_grant" }, 400);
      }

      answers.delete(form.get("code") ?? "");

      const tokens = {
        access_token: `synthetic-access-${randomUUID()}`,
        expires_in: 3600,
        token_type: "Bearer",
      };

      return json(
        answer.idToken === undefined
          ? tokens
          : { ...tokens, id_token: answer.idToken }
      );
    }

    return { status: 404 };
  });

  const sign = async (
    identity: Identity,
    nonce: string,
    spoiled: Spoiled
  ): Promise<string> => {
    const used = spoiled.foreignKey === true ? foreign : key;
    const chosenNonce = spoiled.nonce === undefined ? nonce : spoiled.nonce;

    const claims: JWTPayload = { sub: identity.sub };

    if (identity.email !== undefined) {
      claims["email"] = identity.email;
    }

    if (identity.email_verified !== undefined) {
      claims["email_verified"] = identity.email_verified;
    }

    if (identity.name !== undefined) {
      claims["name"] = identity.name;
    }

    if (chosenNonce !== null) {
      claims["nonce"] = chosenNonce;
    }

    return await new SignJWT(claims)
      .setProtectedHeader({ alg: algorithm, kid: used.kid })
      .setIssuer(spoiled.issuer ?? server.url)
      .setAudience(spoiled.audience ?? oidcClientId)
      .setSubject(identity.sub)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(used.privateKey);
  };

  return FakeOidc.of({
    issue: (identity, nonce, spoiled = {}) =>
      Effect.promise(async () => {
        const code = `synthetic-code-${randomUUID()}`;

        answers.set(
          code,
          spoiled.withoutIdToken === true
            ? {}
            : { idToken: await sign(identity, nonce, spoiled) }
        );

        return code;
      }),
    server,
  });
});

/** The settings that point the server at the fake provider. */
export const oidcSettings = (provider: FakeOidcProvider) => ({
  PEAL_OIDC_CLIENT_ID: oidcClientId,
  PEAL_OIDC_CLIENT_SECRET: oidcClientSecret,
  PEAL_OIDC_ISSUER: provider.server.url,
  PEAL_OIDC_NAME: "Synthetic directory",
});

/** The server signing people in with the fake provider, and the fake. */
export const appWithOidc = (env: Readonly<Record<string, string>> = {}) =>
  Layer.unwrap(
    Effect.gen(function* withOidc() {
      const provider = yield* fakeOidc;

      return Layer.merge(
        TestApp.layerWith({ ...oidcSettings(provider), ...env }),
        Layer.succeed(FakeOidc, provider)
      );
    })
  );
