import { Effect, Layer, Option } from "effect";

import { SignInProviders } from "#workspace/application/sign-in-providers.ts";

import { AuthSettings } from "./settings.ts";

/**
 * The providers the server's settings give, Google first, those whose
 * discovery has answered (provider-discovery.ts): one that did not when the
 * server started shows once it does.
 */
export const SignInProvidersLive = Layer.effect(
  SignInProviders,
  Effect.gen(function* SignInProvidersLive() {
    const { providersOffered, signInProviders } = yield* AuthSettings;

    const nameOf = (id: "google" | "oidc"): string =>
      id === "google"
        ? "Google"
        : Option.match(signInProviders.oidc, {
            onNone: () => id,
            onSome: ({ name }) => name,
          });

    return SignInProviders.of({
      offered: providersOffered.pipe(
        Effect.map((ids) => ids.map((id) => ({ id, name: nameOf(id) })))
      ),
    });
  })
);
