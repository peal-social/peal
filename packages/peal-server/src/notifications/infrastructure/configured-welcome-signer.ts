import { Effect, Layer } from "effect";
import { Digest } from "effect/crypto";

import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";

import { mailSendersConfig, mailWelcomeSignerConfig } from "./mail-settings.ts";

const encoder = new TextEncoder();

/**
 * Who signs the welcome, as `PEAL_MAIL_WELCOME_SIGNER` names them, and the
 * SHA-256 of the personal sender.
 */
export const ConfiguredWelcomeSigner = Layer.effect(
  WelcomeSigner,
  Effect.gen(function* ConfiguredWelcomeSigner() {
    const digest = yield* Digest.Digest;
    const { personal } = yield* mailSendersConfig;

    return WelcomeSigner.of({
      name: yield* mailWelcomeSignerConfig,
      senderDigest: yield* digest
        .digestHex(Digest.sha256, encoder.encode(personal))
        .pipe(Effect.orDie),
    });
  })
).pipe(Layer.provide(Digest.layerWebCrypto));
