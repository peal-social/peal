// The relay that forwards what the web app measures to PostHog, on Peal's
// own origin: off by default, the SDK's events, recordings and its
// project's configuration alone, and never the visitor's cookies,
// credentials or address, nor PostHog's cookies back.
import { once } from "node:events";

import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Option } from "effect";

import {
  assetsHostOf,
  relayConfig,
  relayed,
  relayToPostHog,
} from "#measurement/relay.ts";

const withEnv =
  (env: Record<string, string>) =>
  <A, E>(effect: Effect.Effect<A, E>) =>
    effect.pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
    );

const on = { PEAL_POSTHOG_KEY: "phc_synthetic", PEAL_POSTHOG_WEB: "on" };

// What Node's Request asks of a body given as a stream, which the DOM's
// RequestInit does not declare.
const streamed = { duplex: "half" };

const readRelay = Effect.gen(function* readRelay() {
  return yield* relayConfig;
});

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string;
}

// The relay over a fake PostHog that records what it was sent and
// answers with a cookie the browser must never get.
const relay = (
  path: string,
  env: Record<string, string>,
  init: RequestInit = {}
) =>
  Effect.gen(function* relaying() {
    const sent: Sent[] = [];

    const response = yield* relayToPostHog(
      new Request(`http://localhost:3001${path}`, init),
      async (url, request) => {
        sent.push({
          body:
            request.body instanceof ArrayBuffer
              ? new TextDecoder().decode(request.body)
              : "",
          headers: new Headers(request.headers),
          method: request.method ?? "GET",
          url,
        });

        return await Promise.resolve(
          new Response('{"status":1}', {
            headers: {
              "content-type": "application/json",
              "set-cookie": "ph_synthetic=1",
              "x-powered-by": "synthetic",
            },
            status: 200,
          })
        );
      }
    ).pipe(withEnv(env));

    return { response, sent };
  });

describe("the measurement relay", () => {
  it.effect("answers 404 while PEAL_POSTHOG_WEB is off, as by default", () =>
    Effect.gen(function* off() {
      for (const env of [{}, { ...on, PEAL_POSTHOG_WEB: "off" }]) {
        const { response, sent } = yield* relay("/pulse/e/", env, {
          body: "{}",
          method: "POST",
        });

        assert.strictEqual(response.status, 404);
        assert.deepStrictEqual(sent, []);
      }
    })
  );

  it.effect.each(["/i/v0/e/", "/i/v0/s/"])(
    "forwards %s, where the project's configuration sends the SDK",
    (path) =>
      Effect.gen(function* newer() {
        const { response, sent } = yield* relay(`/pulse${path}?ip=0`, on, {
          body: "[]",
          method: "POST",
        });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(
          sent[0]?.url,
          `https://eu.i.posthog.com${path}?ip=0`
        );
      })
  );

  it.effect("forwards events and recordings to the host, query kept", () =>
    Effect.gen(function* events() {
      const { response, sent } = yield* relay(
        "/pulse/e/?ip=0&ver=1.450.0",
        on,
        { body: "[]", method: "POST" }
      );

      assert.strictEqual(response.status, 200);
      assert.strictEqual(
        sent[0]?.url,
        "https://eu.i.posthog.com/e/?ip=0&ver=1.450.0"
      );
      assert.strictEqual(sent[0]?.body, "[]");

      const recording = yield* relay("/pulse/s/?compression=gzip-js", on, {
        body: "x",
        method: "POST",
      });

      assert.strictEqual(
        recording.sent[0]?.url,
        "https://eu.i.posthog.com/s/?compression=gzip-js"
      );
    })
  );

  it.effect(
    "forwards its project's configuration, alone, to the assets host",
    () =>
      Effect.gen(function* config() {
        const { sent } = yield* relay("/pulse/array/phc_synthetic/config", on);

        assert.strictEqual(
          sent[0]?.url,
          "https://eu-assets.i.posthog.com/array/phc_synthetic/config"
        );

        const other = yield* relay("/pulse/array/phc_another/config", on);

        assert.strictEqual(other.response.status, 404);
      })
  );

  it.effect.each([
    "/pulse",
    "/pulse/static/x.js",
    "/pulse/api/projects",
    "/pulse/flags/?v=2",
    "/pulse/i/v1/logs",
    "/pulse/i/v1/metrics",
    "/pulse/array/phc_synthetic/config.js",
    "/pulse/e",
  ])("answers 404 to %s, which the web app never sends", (path) =>
    Effect.gen(function* refused() {
      const { response, sent } = yield* relay(path, on, {
        body: "{}",
        method: "POST",
      });

      assert.strictEqual(response.status, 404);
      assert.deepStrictEqual(sent, []);
    })
  );

  it.effect("answers 405 to a method the SDK never sends there", () =>
    Effect.gen(function* method() {
      const events = yield* relay("/pulse/e/", on, { method: "GET" });

      const config = yield* relay("/pulse/array/phc_synthetic/config", on, {
        body: "{}",
        method: "POST",
      });

      assert.strictEqual(events.response.status, 405);
      assert.strictEqual(config.response.status, 405);
    })
  );

  it.effect(
    "forwards the request's type alone, and answers PostHog's type alone",
    () =>
      Effect.gen(function* headers() {
        const { response, sent } = yield* relay("/pulse/s/", on, {
          body: "x",
          headers: {
            "accept-language": "fr-FR",
            authorization: "Bearer phc_synthetic",
            "cf-connecting-ip": "192.0.2.10",
            "content-type": "text/plain",
            cookie: "peal.session_token=synthetic",
            referer:
              "http://localhost:3001/app/4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70?token=synthetic",
            "sec-ch-ua": '"Chromium";v="142"',
            "user-agent": "Mozilla/5.0 (Macintosh)",
            "x-forwarded-for": "192.0.2.10",
          },
          method: "POST",
        });

        assert.deepStrictEqual(
          [...(sent[0]?.headers.keys() ?? [])],
          ["content-type"]
        );
        assert.deepStrictEqual([...response.headers.keys()], ["content-type"]);
      })
  );

  it.effect("answers 502 when PostHog cannot be reached", () =>
    Effect.gen(function* unreachable() {
      const response = yield* relayToPostHog(
        new Request("http://localhost:3001/pulse/e/", {
          body: "[]",
          method: "POST",
        }),
        async () => await Promise.reject(new Error("unreachable"))
      ).pipe(withEnv(on));

      assert.strictEqual(response.status, 502);
    })
  );

  it.effect(
    "refuses a body over 4 MiB on its declared length, before reading it",
    () =>
      Effect.gen(function* declared() {
        let read = false;

        const body = new ReadableStream<Uint8Array>({
          pull: (stream) => {
            read = true;
            stream.close();
          },
        });

        const response = yield* relayToPostHog(
          new Request("http://localhost:3001/pulse/s/", {
            body,
            ...streamed,
            headers: { "content-length": String(5 * 1024 * 1024) },
            method: "POST",
          }),
          async () => await Promise.resolve(new Response(null))
        ).pipe(withEnv(on));

        assert.strictEqual(response.status, 413);
        assert.isFalse(read);
      })
  );

  it.effect(
    "stops reading a body that says nothing of its length past 4 MiB",
    () =>
      Effect.gen(function* undeclared() {
        const chunk = new Uint8Array(1024 * 1024);
        let pulled = 0;

        const body = new ReadableStream<Uint8Array>({
          pull: (stream) => {
            pulled += 1;
            stream.enqueue(chunk);
          },
        });

        const { response, sent } = yield* relay("/pulse/s/", on, {
          ...streamed,
          body,
          method: "POST",
        });

        assert.strictEqual(response.status, 413);
        assert.deepStrictEqual(sent, []);
        assert.isBelow(pulled, 8);
      })
  );

  it.effect("answers 504 when PostHog does not answer in time", () =>
    Effect.gen(function* slow() {
      const response = yield* relayToPostHog(
        new Request("http://localhost:3001/pulse/e/", {
          body: "[]",
          method: "POST",
        }),
        async (_, init) => {
          // Never answers: only the relay's own timeout ends it.
          if (init.signal) {
            await once(init.signal, "abort");
          }

          throw new Error("aborted");
        },
        20
      ).pipe(withEnv(on));

      assert.strictEqual(response.status, 504);
    })
  );

  it.effect("sends a self-hosted PostHog's configuration to itself", () =>
    Effect.gen(function* selfHosted() {
      const { sent } = yield* relay("/pulse/array/phc_synthetic/config", {
        ...on,
        PEAL_POSTHOG_HOST: "https://posthog.example.test/",
      });

      assert.strictEqual(
        sent[0]?.url,
        "https://posthog.example.test/array/phc_synthetic/config"
      );
      assert.strictEqual(
        assetsHostOf("https://us.i.posthog.com"),
        "https://us-assets.i.posthog.com"
      );
    })
  );

  it.effect(
    "fails on a host that is not https, or a key that is not a project token",
    () =>
      Effect.gen(function* invalid() {
        for (const env of [
          { ...on, PEAL_POSTHOG_HOST: "http://posthog.example.test" },
          { ...on, PEAL_POSTHOG_HOST: "https://posthog.example.test/?x=1" },
          { ...on, PEAL_POSTHOG_KEY: "phx_synthetic_personal" },
          { PEAL_POSTHOG_WEB: "on" },
        ]) {
          const exit = yield* readRelay.pipe(withEnv(env), Effect.exit);

          assert.isTrue(Exit.isFailure(exit), JSON.stringify(env));
        }

        const local = yield* readRelay.pipe(
          withEnv({ ...on, PEAL_POSTHOG_HOST: "http://127.0.0.1:4010" })
        );

        assert.deepStrictEqual(
          local,
          Option.some({ host: "http://127.0.0.1:4010", token: "phc_synthetic" })
        );
      })
  );

  it("knows its paths", () => {
    assert.isTrue(relayed("/pulse"));
    assert.isTrue(relayed("/pulse/e/"));
    assert.isFalse(relayed("/pulse-wave"));
    assert.isFalse(relayed("/fr/pulse/e/"));
  });
});
