import { describe, expect, it } from "@effect/vitest";
import { Option, Redacted } from "effect";

import { authWithoutDatabase, servedRoutes } from "#test/workspace/support.ts";

// A provider whose discovery nobody answers: the plugin is registered all
// the same, and retries the discovery on the first request naming it.
const withProviders = () =>
  authWithoutDatabase({
    google: Option.some({
      clientId: "synthetic-google-client",
      clientSecret: Redacted.make("synthetic-google-secret"),
    }),
    oidc: Option.some({
      clientId: "synthetic-oidc-client",
      clientSecret: Redacted.make("synthetic-oidc-secret"),
      discoveryUrl: "http://127.0.0.1:9/.well-known/openid-configuration",
      issuer: "http://127.0.0.1:9",
      name: "Single sign-on",
      scopes: ["openid", "email", "profile"],
    }),
  });

const pluginIds = async (auth: ReturnType<typeof authWithoutDatabase>) => {
  const { options } = await auth.$context;

  return (options.plugins ?? []).map(({ id }) => id);
};

describe("the auth plugins", () => {
  // Better Auth runs plugins' after hooks in the order of its plugins. On a
  // sign-in during an OAuth authorization, two-step verification's hook
  // deletes the session the password made, and answers with the second
  // step; the OAuth server's resumes the authorization with the session it
  // finds. Two-step verification's must run first, so that it finds none.
  it("run two-step verification's hooks before the OAuth server's", async () => {
    const ids = await pluginIds(authWithoutDatabase());

    expect(ids).toContain("two-factor");
    expect(ids).toContain("oauth-provider");
    expect(ids).toContain("device-authorization");
    expect(ids.indexOf("two-factor")).toBeLessThan(
      ids.indexOf("oauth-provider")
    );
    expect(ids.indexOf("two-factor")).toBeLessThan(
      ids.indexOf("device-authorization")
    );
  });

  // The provider's callback signs the person in, and the OAuth server's
  // after hook then resumes an authorization that was waiting for it.
  it("register the sign-in providers only when one is set, before the OAuth server", async () => {
    await expect(pluginIds(authWithoutDatabase())).resolves.not.toContain(
      "generic-oauth"
    );

    const ids = await pluginIds(withProviders());

    expect(ids.indexOf("two-factor")).toBeLessThan(
      ids.indexOf("generic-oauth")
    );
    expect(ids.indexOf("generic-oauth")).toBeLessThan(
      ids.indexOf("oauth-provider")
    );
  });

  // A provider reaches an account only through a confirmed address on both
  // sides, and Peal keeps none of a provider's tokens: the routes that link,
  // unlink, or hand out and renew those tokens are off. The account page
  // may still list the ways an account signs in. A new route of this kind
  // in a Better Auth upgrade fails here until it is placed.
  it("keep only the account routes Peal uses", async () => {
    const auth = withProviders();
    const { options } = await auth.$context;
    const disabled = new Set(options.disabledPaths);

    const accountRoutes = servedRoutes(auth).filter((path) =>
      /account|social|access-token|refresh-token|callback\/:id/u.test(path)
    );

    expect(
      [...new Set(accountRoutes)]
        .toSorted()
        .map((path) => [path, disabled.has(path) ? "disabled" : "kept"])
    ).toStrictEqual([
      ["/account-info", "disabled"],
      ["/callback/:id", "kept"],
      ["/get-access-token", "disabled"],
      ["/link-social", "disabled"],
      ["/list-accounts", "kept"],
      ["/refresh-token", "disabled"],
      ["/sign-in/social", "kept"],
      ["/unlink-account", "disabled"],
    ]);
  });
});
