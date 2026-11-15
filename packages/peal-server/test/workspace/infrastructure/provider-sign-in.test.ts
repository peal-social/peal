import { describe, expect, it } from "@effect/vitest";

import { refusedProviderFields } from "#workspace/infrastructure/auth/provider-sign-in.ts";

const invitation = "0b9f1c2e-4f2a-4d4b-9a51-3c1f6f0a2b7e";

const start = {
  callbackURL: "/",
  errorCallbackURL: "/sign-in",
  provider: "oidc",
};

describe("starting a provider's sign-in", () => {
  it.each([
    ["the sign-in page's", start],
    [
      "the sign-up page's",
      {
        ...start,
        additionalData: { invitation, locale: "fr" },
        newUserCallbackURL: "/",
        requestSignUp: true,
      },
    ],
    ["an authorization's", { ...start, oauth_query: "client_id=peal-cli" }],
    ["a redirect-less", { ...start, disableRedirect: true }],
  ])("takes %s body", (_, body) => {
    expect(refusedProviderFields(body)).toStrictEqual([]);
  });

  it.each([
    [
      "a token the client fetched itself",
      { idToken: { token: "x" } },
      "idToken",
    ],
    ["scopes Peal never asks", { scopes: ["calendar"] }, "scopes"],
    [
      "parameters for the provider",
      { additionalParams: { hd: "x" } },
      "additionalParams",
    ],
    [
      "an account to sign in as",
      { loginHint: "ada@example.test" },
      "loginHint",
    ],
    [
      "state Peal does not read",
      { additionalData: { next: "/x" } },
      "additionalData",
    ],
    [
      "an invitation that is no id",
      { additionalData: { invitation: "../x" } },
      "additionalData",
    ],
    [
      "a language Peal does not speak",
      { additionalData: { locale: "de" } },
      "additionalData",
    ],
    ["state that is no object", { additionalData: "x" }, "additionalData"],
  ])("refuses %s", (_, fields, refused) => {
    expect(refusedProviderFields({ ...start, ...fields })).toStrictEqual([
      refused,
    ]);
  });
});
