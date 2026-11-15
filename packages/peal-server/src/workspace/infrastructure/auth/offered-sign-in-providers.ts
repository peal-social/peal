import { Effect, Layer, Option } from "effect";

import { SignInProviders } from "#workspace/application/sign-in-providers.ts";

import { AuthSettings } from "./settings.ts";

/** The providers the server's settings give, Google first. */
export const SignInProvidersLive = Layer.effect(
  SignInProviders,
  Effect.gen(function* SignInProvidersLive() {
    const { signInProviders } = yield* AuthSettings;

    return SignInProviders.of({
      offered: [
        ...Option.match(signInProviders.google, {
          onNone: () => [],
          onSome: () => [{ id: "google" as const, name: "Google" }],
        }),
        ...Option.match(signInProviders.oidc, {
          onNone: () => [],
          onSome: ({ name }) => [{ id: "oidc" as const, name }],
        }),
      ],
    });
  })
);
