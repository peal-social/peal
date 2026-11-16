import { Effect, Layer, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { AdSignInFailed } from "#ads/application/ad-sign-in-failed.ts";
import { GrantSecrets } from "#ads/application/ports/grant-secrets.ts";
import {
  adGrantContext,
  EncryptedTokenSchema,
  SecretContextSchema,
  TokenCipher,
} from "#channels/application/token-cipher.ts";

const encoder = new TextEncoder();

const unopenable = { _tag: "Unopenable" } as const;

// A sign-in's PKCE verifier is bound to its state's hash, apart from any
// grant's token (`ads:<grant id>`, a UUID).
const signInContext = (stateHash: string) =>
  SecretContextSchema.make(`ads:sign-in:${stateHash}`);

/**
 * Grant tokens on the channels context's token cipher: encrypted with the
 * server's keyring (`PEAL_TOKEN_KEYS`), bound to `ads:<grant id>`. Peal
 * keeps one cipher: nothing here encrypts on its own. Sign-in states are
 * 32 random bytes, kept as their SHA-256.
 */
export const CipherGrantSecrets = Layer.effect(
  GrantSecrets,
  Effect.gen(function* CipherGrantSecrets() {
    const cipher = yield* TokenCipher;
    const random = yield* SecureRandom.SecureRandom;
    const digest = yield* Digest.Digest;

    const hashOf = (state: string) =>
      // Hashing a string cannot fail on a platform that has SHA-256.
      digest.digestHex(Digest.sha256, encoder.encode(state)).pipe(Effect.orDie);

    return GrantSecrets.of({
      hashOf,
      newVerifier: Effect.gen(function* newVerifier() {
        // 32 bytes in base64url: 43 characters, as RFC 7636 (4.1) asks.
        const verifier = Base64Url.encode(
          yield* random.randomBytes(32).pipe(Effect.orDie)
        );

        const challenge = Base64Url.encode(
          yield* digest
            .digest(Digest.sha256, encoder.encode(verifier))
            .pipe(Effect.orDie)
        );

        return { challenge, verifier: Redacted.make(verifier) };
      }),
      openVerifier: (sealed, stateHash) =>
        cipher
          .decryptSecret(
            EncryptedTokenSchema.make(sealed),
            signInContext(stateHash)
          )
          .pipe(Effect.mapError(() => unopenable)),
      sealVerifier: (verifier, stateHash) =>
        cipher
          .encryptSecret(verifier, signInContext(stateHash))
          .pipe(
            Effect.mapError(
              () => new AdSignInFailed({ reason: "notConfigured" })
            )
          ),
      newState: Effect.gen(function* newState() {
        const state = Base64Url.encode(
          yield* random.randomBytes(32).pipe(Effect.orDie)
        );

        return { hash: yield* hashOf(state), state };
      }),
      open: (sealed, grantId) =>
        cipher
          .decryptSecret(
            EncryptedTokenSchema.make(sealed),
            adGrantContext(grantId)
          )
          .pipe(Effect.mapError(() => unopenable)),
      seal: (token, grantId) =>
        cipher
          .encryptSecret(token, adGrantContext(grantId))
          .pipe(
            Effect.mapError(
              () => new AdSignInFailed({ reason: "notConfigured" })
            )
          ),
    });
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(SecureRandom.layerWebCrypto, Digest.layerWebCrypto)
  )
);
