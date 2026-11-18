// The relay that forwards what the web app measures to PostHog, on Peal's
// own origin: off by default, PostHog's ingestion and configuration paths
// alone, and never the visitor's cookies, credentials or address.
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Option } from "effect";
import { NextRequest } from "next/server";

import { forwardedHeader } from "#api/forward.ts";
import {
  assetsHostOf,
  forwardToPostHog,
  relayConfig,
  relayed,
} from "#measurement/relay.ts";

const withEnv =
  (env: Record<string, string>) =>
  <A, E>(effect: Effect.Effect<A, E>) =>
    effect.pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
    );

const on = { PEAL_POSTHOG_WEB: "on" };

const readRelay = Effect.gen(function* readRelay() {
  return yield* relayConfig;
});

const forward = (
  path: string,
  env: Record<string, string>,
  init: { headers?: Record<string, string>; method?: string } = {}
) =>
  forwardToPostHog(new NextRequest(`http://localhost:3001${path}`, init)).pipe(
    withEnv(env)
  );

const rewriteOf = (response: Response) =>
  response.headers.get("x-middleware-rewrite");

// The request headers a rewrite forwards, as Next passes them on.
const forwardedNames = (response: Response): readonly string[] =>
  (response.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .filter((name) => name !== "");

describe("the measurement relay", () => {
  it.effect("answers 404 while PEAL_POSTHOG_WEB is off, as by default", () =>
    Effect.gen(function* off() {
      const unset = yield* forward("/pulse/e/?ip=0", {});

      const explicit = yield* forward("/pulse/e/?ip=0", {
        PEAL_POSTHOG_WEB: "off",
      });

      assert.strictEqual(unset.status, 404);
      assert.strictEqual(explicit.status, 404);
      assert.isNull(rewriteOf(unset));
    })
  );

  it.effect("forwards events to the host, query kept", () =>
    Effect.gen(function* events() {
      const response = yield* forward("/pulse/e/?ip=0&ver=1.451.1", on, {
        method: "POST",
      });

      assert.strictEqual(
        rewriteOf(response),
        "https://eu.i.posthog.com/e/?ip=0&ver=1.451.1"
      );
    })
  );

  it.effect("forwards the project's configuration to the assets host", () =>
    Effect.gen(function* config() {
      const response = yield* forward("/pulse/array/phc_synthetic/config", on);

      assert.strictEqual(
        rewriteOf(response),
        "https://eu-assets.i.posthog.com/array/phc_synthetic/config"
      );
    })
  );

  it.effect.each(["/pulse/static/x.js", "/pulse/api/projects", "/pulse"])(
    "answers 404 to %s, which the SDK never sends",
    (path) =>
      Effect.gen(function* refused() {
        const response = yield* forward(path, on);

        assert.strictEqual(response.status, 404);
        assert.isNull(rewriteOf(response));
      })
  );

  it.effect("answers 405 to a method the SDK never sends", () =>
    Effect.gen(function* method() {
      const response = yield* forward("/pulse/e/", on, { method: "DELETE" });

      assert.strictEqual(response.status, 405);
    })
  );

  it.effect(
    "forwards neither cookies, credentials, the visitor's address nor where they came from",
    () =>
      Effect.gen(function* stripped() {
        const response = yield* forward("/pulse/s/?compression=gzip-js", on, {
          headers: {
            "accept-language": "fr-FR",
            authorization: "Bearer phc_synthetic",
            "cf-connecting-ip": "192.0.2.10",
            "cf-ipcountry": "FR",
            "content-type": "text/plain",
            cookie: "better-auth.session_token=synthetic",
            forwarded: "for=192.0.2.10",
            referer:
              "http://localhost:3001/app/4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70?token=synthetic",
            "true-client-ip": "192.0.2.10",
            "x-forwarded-for": "192.0.2.10",
            "x-forwarded-host": "localhost:3001",
            [forwardedHeader]: "1",
            "x-real-ip": "192.0.2.10",
          },
          method: "POST",
        });

        const names = forwardedNames(response);

        assert.include(names, "content-type");
        assert.include(names, "host");
        assert.strictEqual(
          response.headers.get("x-middleware-request-host"),
          "eu.i.posthog.com"
        );

        for (const name of [
          "accept-language",
          "authorization",
          "cf-connecting-ip",
          "cf-ipcountry",
          "cookie",
          "forwarded",
          "referer",
          "true-client-ip",
          "x-forwarded-for",
          "x-forwarded-host",
          forwardedHeader,
          "x-real-ip",
        ]) {
          assert.notInclude(names, name);
          assert.isNull(response.headers.get(`x-middleware-request-${name}`));
        }
      })
  );

  it.effect("sends a self-hosted PostHog's configuration to itself", () =>
    Effect.gen(function* selfHosted() {
      const response = yield* forward("/pulse/array/phc_synthetic/config", {
        ...on,
        PEAL_POSTHOG_HOST: "https://posthog.example.test/",
      });

      assert.strictEqual(
        rewriteOf(response),
        "https://posthog.example.test/array/phc_synthetic/config"
      );
      assert.strictEqual(
        assetsHostOf("https://posthog.example.test"),
        "https://posthog.example.test"
      );
      assert.strictEqual(
        assetsHostOf("https://us.i.posthog.com"),
        "https://us-assets.i.posthog.com"
      );
    })
  );

  it.effect("fails on a host that is not https, or carries a query", () =>
    Effect.gen(function* invalid() {
      for (const host of [
        "http://posthog.example.test",
        "https://posthog.example.test/?x=1",
        "https://user:secret@posthog.example.test",
      ]) {
        const exit = yield* readRelay.pipe(
          withEnv({ ...on, PEAL_POSTHOG_HOST: host }),
          Effect.exit
        );

        assert.isTrue(Exit.isFailure(exit), host);
      }

      const local = yield* readRelay.pipe(
        withEnv({ ...on, PEAL_POSTHOG_HOST: "http://127.0.0.1:4010" })
      );

      assert.deepStrictEqual(local, Option.some("http://127.0.0.1:4010"));
    })
  );

  it("knows its paths", () => {
    assert.isTrue(relayed("/pulse"));
    assert.isTrue(relayed("/pulse/e/"));
    assert.isFalse(relayed("/pulsewave"));
    assert.isFalse(relayed("/fr/pulse/e/"));
  });
});
