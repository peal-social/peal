import { Config, Effect, Layer, Option, Redacted } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

import { SupportChatIdentity } from "#shared/application/support-chat-identity.ts";

const encoder = new TextEncoder();

/**
 * The support chat's identity secret (`PEAL_CRISP_IDENTITY_SECRET`), which
 * the chat provider issues for the website once identity verification is
 * on in its settings: none when unset or blank.
 */
export const supportChatSecretConfig = Config.option(
  Config.Redacted("PEAL_CRISP_IDENTITY_SECRET")
).pipe(
  Config.map(Option.filter((secret) => Redacted.value(secret).trim() !== ""))
);

/**
 * The signature the chat provider verifies an email with: HMAC-SHA256 of
 * the address under the website's secret, in lower-case hex.
 */
export const emailSignatureOf = Effect.fn("SupportChatIdentity.signature")(
  function* emailSignatureOf(secret: Redacted.Redacted, email: string) {
    const mac = yield* Mac.Mac;

    const key = yield* Mac.key(
      Mac.hmacSha256,
      encoder.encode(Redacted.value(secret).trim())
    );

    return Hex.encode(yield* mac.sign(key, encoder.encode(email)));
  },
  // A key or tag that cannot be computed is a bug, not an answer.
  Effect.orDie
);

/** The identity of a server with this secret, or none without. */
export const supportChatIdentityOf = (
  secret: Option.Option<Redacted.Redacted>
): Layer.Layer<SupportChatIdentity, never, Mac.Mac> =>
  Option.match(secret, {
    onNone: () => SupportChatIdentity.none,
    onSome: (key) =>
      Layer.effect(
        SupportChatIdentity,
        Effect.gen(function* supportChatIdentity() {
          const mac = yield* Mac.Mac;

          return SupportChatIdentity.of({
            sign: (email) =>
              emailSignatureOf(key, email).pipe(
                Effect.provideService(Mac.Mac, mac),
                Effect.map(Option.some)
              ),
          });
        })
      ),
  });

/**
 * The support chat's identity as the server runs it, from
 * PEAL_CRISP_IDENTITY_SECRET, read when the server starts.
 */
export const SupportChatIdentityLive = Layer.unwrap(
  supportChatSecretConfig.pipe(Effect.map(supportChatIdentityOf))
).pipe(
  Layer.provide(
    Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
  )
);
