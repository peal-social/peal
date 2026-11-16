import { Effect, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { Api } from "peal-contract";
import type { SignInProvider, SignUpMode } from "peal-contract";

import { serverUrl } from "#api/server-url.ts";

/** What the sign-up page reads of the server's settings. */
export interface SignUpSettings {
  /** Who may sign up: anyone, unless the server says otherwise. */
  readonly mode: SignUpMode;
  /** The identity providers people may sign in with, in order. */
  readonly providers: readonly SignInProvider[];
  readonly siteKey: Option.Option<string>;
}

const readSettings = Effect.fn("signUpSettings")(function* readSettings() {
  const client = yield* HttpApiClient.make(Api, { baseUrl: yield* serverUrl });

  const { signInProviders, signUp, turnstileSiteKey } =
    yield* client.captcha.get();

  const settings: SignUpSettings = {
    mode: signUp ?? "open",
    providers: signInProviders ?? [],
    siteKey: Option.fromNullOr(turnstileSiteKey),
  };

  return settings;
}, Effect.provide(FetchHttpClient.layer));

/**
 * For Server Components: the Turnstile site key, who may sign up and the
 * providers to sign in with. When the server cannot tell, the form shows no
 * widget and no provider, and anyone may try: the server refuses what it
 * would not take.
 */
export const signUpSettings = async (): Promise<SignUpSettings> =>
  await Effect.runPromise(
    readSettings().pipe(
      Effect.timeout("5 seconds"),
      Effect.catchCause((cause) =>
        Effect.logWarning("The captcha settings could not be read", cause).pipe(
          Effect.as<SignUpSettings>({
            mode: "open",
            providers: [],
            siteKey: Option.none(),
          })
        )
      )
    )
  );

/**
 * For Server Components: the Turnstile site key the sign-up and password
 * reset forms show the widget with, or none when the server asks for no
 * captcha. When the server cannot tell, the form shows no widget, and the
 * server refuses it if it wanted one.
 */
export const captchaSiteKey = async (): Promise<Option.Option<string>> => {
  const { siteKey } = await signUpSettings();

  return siteKey;
};
