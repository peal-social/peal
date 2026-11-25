import { Effect, Layer } from "effect";

import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";

import { mailWelcomeSignerConfig } from "./mail-settings.ts";

/** Who signs the welcome, as `PEAL_MAIL_WELCOME_SIGNER` names them. */
export const ConfiguredWelcomeSigner = Layer.effect(
  WelcomeSigner,
  mailWelcomeSignerConfig.pipe(Effect.map((name) => WelcomeSigner.of({ name })))
);
