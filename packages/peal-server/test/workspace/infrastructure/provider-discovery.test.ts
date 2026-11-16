// The sign-in providers' discovery, read when the server starts: a provider
// whose document lacks what OpenID Connect requires stops the server; one
// that does not answer in time is left out, said in the log, and the
// server starts all the same.
import { once } from "node:events";
import { createServer } from "node:http";

import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Redacted, Schema } from "effect";

import { fakeOidcWith } from "#test/workspace/fakes/fake-oidc.ts";
import { checkedProviders } from "#workspace/infrastructure/auth/provider-discovery.ts";
import type { SignInProviderSettings } from "#workspace/infrastructure/auth/sign-in-provider-settings.ts";

const client = {
  clientId: "synthetic-oidc-client",
  clientSecret: Redacted.make("synthetic-oidc-secret"),
};

const at = (issuer: string): SignInProviderSettings => ({
  google: Option.none(),
  oidc: Option.some({
    ...client,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    issuer,
    name: "Synthetic directory",
    scopes: ["openid", "email", "profile"],
  }),
});

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

// A server that takes the connection and never answers.
const silentServer = Effect.acquireRelease(
  Effect.promise(async () => {
    const server = createServer(() => {
      // Never answers.
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const { port } = decodeAddress(server.address());

    return { server, url: `http://127.0.0.1:${String(port)}` };
  }),
  ({ server }) =>
    Effect.promise(async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    })
);

describe("the sign-in providers' discovery", () => {
  it.live("keeps a provider whose discovery answers", () =>
    Effect.scoped(
      Effect.gen(function* answers() {
        const fake = yield* fakeOidcWith({});

        const checked = yield* checkedProviders(
          at(fake.server.url),
          "2 seconds"
        );

        assert.isTrue(Option.isSome(checked.oidc));
      })
    )
  );

  it.live("leaves out a provider that does not answer in time", () =>
    Effect.scoped(
      Effect.gen(function* silent() {
        const { url } = yield* silentServer;
        const started = Date.now();
        const checked = yield* checkedProviders(at(url), "300 millis");

        assert.isTrue(Option.isNone(checked.oidc));
        assert.isBelow(Date.now() - started, 5000);
      })
    )
  );

  it.live("leaves out a provider nobody answers for", () =>
    Effect.gen(function* refused() {
      const checked = yield* checkedProviders(
        at("http://127.0.0.1:9"),
        "2 seconds"
      );

      assert.isTrue(Option.isNone(checked.oidc));
    })
  );

  it.live("stops on a document without the signing algorithms", () =>
    Effect.scoped(
      Effect.gen(function* incomplete() {
        const fake = yield* fakeOidcWith({ withoutSigningAlgorithms: true });

        const failure = yield* checkedProviders(
          at(fake.server.url),
          "2 seconds"
        ).pipe(Effect.flip);

        assert.include(
          failure.message,
          "id_token_signing_alg_values_supported"
        );
        assert.include(failure.message, "Synthetic directory");
      })
    )
  );
});
