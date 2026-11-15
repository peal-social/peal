// A DEV account is checked with the member's key on DEV's own API before
// it is connected: the key must open the account, and Peal keeps the
// account's id, its username and its name.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { SiteRefused } from "#channels/application/site-refused.ts";
import { devtoVerifyKey } from "#channels/infrastructure/platforms/devto/devto-key-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { fakeDevTo, gardener } from "#test/channels/fakes/fake-devto.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

const Http = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

const verifyOn = (api: string, key: string) =>
  devtoVerifyKey({ api }).pipe(
    Effect.flatMap((verify) =>
      verify({
        apiKey: Redacted.make(key),
        platform: "devto",
        publication: Option.none(),
      })
    )
  );

layer(Http)("checking a DEV key", (it) => {
  it.effect("reads the account the key opens, with Forem's API v1", () =>
    Effect.gen(function* found() {
      const devto = yield* fakeDevTo();

      const site = yield* verifyOn(devto.api, gardener.key);

      assert.strictEqual(site.accountId, String(gardener.id));
      assert.strictEqual(site.handle, `dev.to/${gardener.username}`);
      assert.deepStrictEqual(site.displayName, Option.some(gardener.name));
      assert.isTrue(Option.isSome(site.avatarUrl));

      const [me] = devto.requests();

      assert.strictEqual(me?.headers["api-key"], gardener.key);
      assert.include(me?.headers.accept, "application/vnd.forem.api-v1+json");
    })
  );

  it.effect("refuses a key DEV refuses", () =>
    Effect.gen(function* refused() {
      const devto = yield* fakeDevTo();

      const failure = yield* verifyOn(devto.api, "synthetic-wrong").pipe(
        Effect.flip
      );

      assert.deepStrictEqual(
        failure,
        new SiteRefused({ reason: "credentialsRefused" })
      );
    })
  );

  it.effect("is unavailable when DEV fails or limits, never refused", () =>
    Effect.gen(function* down() {
      for (const status of [429, 500, 503]) {
        const devto = yield* fakeDevTo({
          intercept: () => ({ body: { error: "busy", status }, status }),
        });

        const failure = yield* verifyOn(devto.api, gardener.key).pipe(
          Effect.flip
        );

        assert.deepStrictEqual(failure, new PlatformUnavailable());
      }
    })
  );

  it.effect("reads a 401 from something other than DEV as unavailable", () =>
    Effect.gen(function* proxy() {
      const devto = yield* fakeDevTo({
        intercept: () => ({ status: 401 }),
      });

      const failure = yield* verifyOn(devto.api, gardener.key).pipe(
        Effect.flip
      );

      assert.deepStrictEqual(failure, new PlatformUnavailable());
    })
  );
});
