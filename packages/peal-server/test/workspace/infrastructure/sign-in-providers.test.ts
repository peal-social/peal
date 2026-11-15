import { describe, expect, it } from "@effect/vitest";
import { Option, Redacted } from "effect";

import {
  googleIssuer,
  googleProvider,
  oidcProvider,
  profileToUser,
  signInProviderConfigs,
  signInProviderIds,
} from "#workspace/infrastructure/auth/sign-in-providers.ts";

const client = {
  clientId: "synthetic-google-client",
  clientSecret: Redacted.make("synthetic-google-secret"),
};

const oidc = {
  clientId: "synthetic-oidc-client",
  clientSecret: Redacted.make("synthetic-oidc-secret"),
  discoveryUrl:
    "https://id.example.test/realms/peal/.well-known/openid-configuration",
  issuer: "https://id.example.test/realms/peal",
  name: "Example Corp",
  scopes: ["openid", "email", "groups"],
};

const rightToLeftOverride = String.fromCodePoint(0x20_2e);

const replacementCharacter = String.fromCodePoint(0xff_fd);

describe("the sign-in providers", () => {
  it("sign in with Google through its discovery, verifying ID tokens", () => {
    const google = googleProvider(client);

    expect(googleIssuer).toBe("https://accounts.google.com");
    expect(google).toMatchObject({
      clientId: "synthetic-google-client",
      clientSecret: "synthetic-google-secret",
      disableImplicitSignUp: true,
      disableProviderLogout: true,
      discoveryUrl:
        "https://accounts.google.com/.well-known/openid-configuration",
      name: "Google",
      overrideUserInfo: false,
      pkce: true,
      prompt: "select_account",
      providerId: "google",
      requireIdTokenVerification: true,
      scopes: ["openid", "email", "profile"],
    });
    // No refresh token: Peal needs none once the person is signed in.
    expect(google.accessType).toBeUndefined();
  });

  it("sign in with the operator's provider by its own name and scopes", () => {
    expect(oidcProvider(oidc)).toMatchObject({
      clientId: "synthetic-oidc-client",
      clientSecret: "synthetic-oidc-secret",
      disableImplicitSignUp: true,
      disableProviderLogout: true,
      discoveryUrl: oidc.discoveryUrl,
      name: "Example Corp",
      overrideUserInfo: false,
      pkce: true,
      providerId: "oidc",
      requireIdTokenVerification: true,
      scopes: ["openid", "email", "groups"],
    });
  });

  it("list the providers set, Google first", () => {
    expect(signInProviderIds).toStrictEqual(["google", "oidc"]);
    expect(
      signInProviderConfigs({ google: Option.none(), oidc: Option.none() })
    ).toStrictEqual([]);
    expect(
      signInProviderConfigs({
        google: Option.some(client),
        oidc: Option.some(oidc),
      }).map(({ providerId }) => providerId)
    ).toStrictEqual(["google", "oidc"]);
  });

  it("keep the provider's name storable, and never its picture", () => {
    expect(
      profileToUser({
        email: "ada@example.test",
        name: `  Ada\u0000 ${rightToLeftOverride}Lovelace\nKing \uD83D `,
      })
    ).toStrictEqual({
      image: undefined,
      name: `Ada Lovelace King ${replacementCharacter}`,
    });
  });

  it("name an account by its address when the provider gives no name", () => {
    expect(profileToUser({ email: "grace.hopper@example.test" })).toStrictEqual(
      { image: undefined, name: "grace.hopper" }
    );
    expect(
      profileToUser({
        email: "grace.hopper@example.test",
        name: " \u0000 ",
      })
    ).toStrictEqual({ image: undefined, name: "grace.hopper" });
  });

  it("bound a long name", () => {
    expect(
      profileToUser({
        email: "long@example.test",
        name: "x".repeat(500),
      }).name
    ).toHaveLength(100);
  });
});
