import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "peal-contract";

import { CaptchaChallenge } from "#workspace/application/captcha-challenge.ts";
import { SignInProviders } from "#workspace/application/sign-in-providers.ts";
import { SignUpGate } from "#workspace/application/sign-up-gate.ts";
import { SignUpSettings } from "#workspace/application/sign-up-settings.ts";

/**
 * The captcha the sign-up and password reset forms show, who may sign up,
 * and the providers people may sign in with, for anyone.
 */
export const CaptchaHandlers = HttpApiBuilder.group(
  Api,
  "captcha",
  Effect.fn(function* captchaHandlers(handlers) {
    const { turnstileSiteKey } = yield* CaptchaChallenge;
    const { mode } = yield* SignUpSettings;
    const signUps = yield* SignUpGate;
    const providers = yield* SignInProviders;

    return handlers.handle("get", () =>
      signUps.modeNow().pipe(
        // The server's setting when the accounts cannot be read: the gate
        // decides on the sign-up itself.
        Effect.orElseSucceed(() => mode),
        Effect.flatMap((signUp) =>
          providers.offered.pipe(Effect.map((offered) => ({ offered, signUp })))
        ),
        Effect.map(({ offered, signUp }) => ({
          signInProviders: offered.map(({ id, name }) => ({ id, name })),
          signUp,
          turnstileSiteKey: Option.getOrNull(turnstileSiteKey),
        }))
      )
    );
  })
);
