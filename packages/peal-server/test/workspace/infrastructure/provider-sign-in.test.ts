import { describe, expect, it } from "@effect/vitest";

import {
  refusedProviderFields,
  refusedStart,
} from "#workspace/infrastructure/auth/provider-sign-in.ts";

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

// Whatever a value the route itself drops: a refusal never rests on a
// decode that could fail open.
describe("a start whose other fields are odd", () => {
  it.each([0, false, null, { query: "x" }])(
    "still refuses what it asks for with oauth_query %j",
    (oddity) => {
      for (const field of [
        { idToken: { token: "x" } },
        { scopes: ["extra_scope"] },
        { additionalParams: { foo: "bar" } },
        { loginHint: "someone@example.test" },
        { additionalData: { evil: "x" } },
      ]) {
        expect(
          refusedStart({ ...start, ...field, oauth_query: oddity })
        ).not.toStrictEqual([]);
      }
    }
  );

  it.each([null, 0, false, ""])(
    "refuses a refused field even as %j",
    (value) => {
      expect(refusedStart({ ...start, idToken: value })).toStrictEqual([
        "idToken",
      ]);
    }
  );

  it.each([
    ["a list", []],
    ["a string", "x"],
    ["nothing", null],
  ])("refuses a body that is %s", (_, body) => {
    expect(refusedStart(body)).toStrictEqual(["body"]);
  });

  it("takes the pages' bodies", () => {
    expect(
      refusedStart({ ...start, oauth_query: "client_id=peal-cli" })
    ).toStrictEqual([]);
  });
});
