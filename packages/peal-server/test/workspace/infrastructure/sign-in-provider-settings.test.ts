import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

import { signInProvidersConfig } from "#workspace/infrastructure/auth/sign-in-provider-settings.ts";

const settingsFrom = (env: Record<string, string>) =>
  signInProvidersConfig.parse(ConfigProvider.fromUnknown(env));

const google = {
  GOOGLE_SIGN_IN_CLIENT_ID: "synthetic-google-client.example.test",
  GOOGLE_SIGN_IN_CLIENT_SECRET: "synthetic-google-secret",
};

const oidc = {
  PEAL_OIDC_CLIENT_ID: "synthetic-oidc-client",
  PEAL_OIDC_CLIENT_SECRET: "synthetic-oidc-secret",
  PEAL_OIDC_ISSUER: "https://id.example.test/realms/peal",
};

const failureOf = (env: Record<string, string>) =>
  settingsFrom(env).pipe(Effect.flip, Effect.map(String));

describe("the sign-in providers' settings", () => {
  it.effect("offer no provider when none is set", () =>
    Effect.gen(function* none() {
      const settings = yield* settingsFrom({});

      assert.isTrue(Option.isNone(settings.google));
      assert.isTrue(Option.isNone(settings.oidc));

      const blank = yield* settingsFrom({
        GOOGLE_SIGN_IN_CLIENT_ID: " ",
        GOOGLE_SIGN_IN_CLIENT_SECRET: "",
        PEAL_OIDC_CLIENT_ID: "",
        PEAL_OIDC_CLIENT_SECRET: "",
        PEAL_OIDC_ISSUER: "",
      });

      assert.isTrue(Option.isNone(blank.google));
      assert.isTrue(Option.isNone(blank.oidc));
    })
  );

  it.effect("read Google's client", () =>
    Effect.gen(function* readsGoogle() {
      const settings = yield* settingsFrom(google);

      assert.deepStrictEqual(
        settings.google.pipe(
          Option.map(({ clientId, clientSecret }) => ({
            clientId,
            clientSecret: Redacted.value(clientSecret),
          }))
        ),
        Option.some({
          clientId: "synthetic-google-client.example.test",
          clientSecret: "synthetic-google-secret",
        })
      );
      assert.isTrue(Option.isNone(settings.oidc));
    })
  );

  it.effect("read another issuer for Google, as tests point it at a fake", () =>
    Effect.gen(function* googleIssuer() {
      const settings = yield* settingsFrom({
        ...google,
        GOOGLE_SIGN_IN_ISSUER: "http://127.0.0.1:8080/",
      });

      assert.deepStrictEqual(
        settings.google.pipe(Option.map(({ issuer }) => issuer)),
        Option.some("http://127.0.0.1:8080")
      );

      // A test's setting: any other issuer behind "Continue with Google"
      // would vouch for Gmail addresses.
      for (const issuer of [
        "http://id.example.test",
        "https://id.example.test",
        "https://accounts.google.com",
      ]) {
        assert.include(
          yield* failureOf({ ...google, GOOGLE_SIGN_IN_ISSUER: issuer }),
          "GOOGLE_SIGN_IN_ISSUER"
        );
      }
    })
  );

  it.effect("read the operator's provider, with the defaults", () =>
    Effect.gen(function* readsOidc() {
      const settings = yield* settingsFrom(oidc);

      assert.deepStrictEqual(
        settings.oidc.pipe(
          Option.map(({ clientSecret, ...rest }) => ({
            ...rest,
            clientSecret: Redacted.value(clientSecret),
          }))
        ),
        Option.some({
          clientId: "synthetic-oidc-client",
          clientSecret: "synthetic-oidc-secret",
          discoveryUrl:
            "https://id.example.test/realms/peal/.well-known/openid-configuration",
          issuer: "https://id.example.test/realms/peal",
          name: "Single sign-on",
          scopes: ["openid", "email", "profile"],
        })
      );
    })
  );

  it.effect("read the button's name and the scopes given", () =>
    Effect.gen(function* readsNameAndScopes() {
      const settings = yield* settingsFrom({
        ...oidc,
        PEAL_OIDC_ISSUER: "http://127.0.0.1:8080/",
        PEAL_OIDC_NAME: "  Example Corp ",
        PEAL_OIDC_SCOPES: " email  openid groups openid ",
      });

      assert.deepStrictEqual(
        settings.oidc.pipe(
          Option.map(({ discoveryUrl, name, scopes }) => ({
            discoveryUrl,
            name,
            scopes,
          }))
        ),
        Option.some({
          discoveryUrl:
            "http://127.0.0.1:8080/.well-known/openid-configuration",
          name: "Example Corp",
          scopes: ["email", "openid", "groups"],
        })
      );
    })
  );

  it.effect.each([
    [
      "GOOGLE_SIGN_IN_CLIENT_SECRET",
      { GOOGLE_SIGN_IN_CLIENT_ID: "synthetic-google-client" },
    ],
    [
      "GOOGLE_SIGN_IN_CLIENT_ID",
      { GOOGLE_SIGN_IN_CLIENT_SECRET: "synthetic-google-secret" },
    ],
    ["PEAL_OIDC_CLIENT_SECRET", { ...oidc, PEAL_OIDC_CLIENT_SECRET: "" }],
    ["PEAL_OIDC_CLIENT_ID", { ...oidc, PEAL_OIDC_CLIENT_ID: "" }],
    ["PEAL_OIDC_ISSUER", { ...oidc, PEAL_OIDC_ISSUER: "" }],
    ["PEAL_OIDC_ISSUER", { PEAL_OIDC_NAME: "Example Corp" }],
  ] as const)("stop without %s when its group is half set", ([missing, env]) =>
    Effect.gen(function* halfSet() {
      assert.include(yield* failureOf(env), missing);
    })
  );

  it.effect.each([
    ["plain HTTP off a loopback host", "http://id.example.test"],
    ["no address", "id.example.test"],
    ["a query", "https://id.example.test/?tenant=peal"],
    ["a fragment", "https://id.example.test/#peal"],
    ["credentials", "https://user:secret@id.example.test"],
  ] as const)("refuse an issuer with %s", ([, issuer]) =>
    Effect.gen(function* badIssuer() {
      assert.include(
        yield* failureOf({ ...oidc, PEAL_OIDC_ISSUER: issuer }),
        "PEAL_OIDC_ISSUER"
      );
    })
  );

  it.effect.each([
    ["without openid", "email profile"],
    ["without email", "openid profile"],
  ] as const)("refuse scopes %s", ([, scopes]) =>
    Effect.gen(function* badScopes() {
      assert.include(
        yield* failureOf({ ...oidc, PEAL_OIDC_SCOPES: scopes }),
        "PEAL_OIDC_SCOPES"
      );
    })
  );

  it.effect.each([
    ["longer than 40 characters", "x".repeat(41)],
    ["on two lines", "Example\nCorp"],
    ["with a NUL", "Example\u0000Corp"],
    ["with half a surrogate pair", "Example \uD83D"],
  ] as const)("refuse a name %s", ([, name]) =>
    Effect.gen(function* badName() {
      assert.include(
        yield* failureOf({ ...oidc, PEAL_OIDC_NAME: name }),
        "PEAL_OIDC_NAME"
      );
    })
  );
});
