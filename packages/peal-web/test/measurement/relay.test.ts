// The relay that forwards what the web app measures to PostHog, on Peal's
// own origin: off by default, the SDK's events, recordings and its
// project's configuration alone, and never the visitor's cookies,
// credentials or address, nor PostHog's cookies back. Its site mode, under
// /pulse/site, relays the site's, the docs' and the blog's events alone,
// with the visitor's address and browser description, which PostHog works
// its cookieless count out from.
import { once } from "node:events";

import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Option, Schema } from "effect";

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

  it.effect(
    "gives the SDK its own endpoints, whatever the configuration names",
    () =>
      Effect.gen(function* endpoints() {
        const response = yield* relayToPostHog(
          new Request("http://localhost:3001/pulse/array/phc_synthetic/config"),
          async () =>
            await Promise.resolve(
              Response.json({
                analytics: { endpoint: "/i/v0/e/" },
                sessionRecording: { endpoint: "/i/v0/s/", sampleRate: null },
                supportedCompression: ["gzip", "gzip-js"],
              })
            )
        ).pipe(withEnv(on));

        const text = yield* Effect.promise(async () => await response.text());

        assert.deepStrictEqual(
          Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json))(text),
          {
            analytics: { endpoint: "/e/" },
            sessionRecording: { endpoint: "/s/", sampleRate: null },
            supportedCompression: ["gzip", "gzip-js"],
          }
        );
      })
  );

  it.effect(
    "passes a configuration it cannot read, or one without endpoints, as it is",
    () =>
      Effect.gen(function* untouched() {
        for (const body of ["not json", '{"sessionRecording":false}']) {
          const response = yield* relayToPostHog(
            new Request(
              "http://localhost:3001/pulse/array/phc_synthetic/config"
            ),
            async () => await Promise.resolve(new Response(body))
          ).pipe(withEnv(on));

          assert.strictEqual(
            yield* Effect.promise(async () => await response.text()),
            body === "not json" ? body : '{"sessionRecording":false}'
          );
        }
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

const site = {
  AUTH_IP_HEADERS: "cf-connecting-ip",
  PEAL_POSTHOG_KEY: "phc_synthetic",
  PEAL_POSTHOG_SITE: "on",
};

// What a browser sends with an event, beside what the edge adds.
const browserHeaders = {
  accept: "*/*",
  "accept-language": "fr-FR",
  authorization: "Bearer phc_synthetic",
  "cf-connecting-ip": "203.0.113.7",
  "content-type": "text/plain",
  cookie: "ph_phc_synthetic_posthog=synthetic; peal.consent=allowed",
  origin: "https://peal.example.test",
  referer: "https://peal.example.test/pricing?email=synthetic%40example.test",
  "sec-ch-ua": '"Chromium";v="142"',
  "user-agent": "Mozilla/5.0 (Macintosh)",
  "x-forwarded-for": "192.0.2.10",
};

describe("the measurement relay's site mode", () => {
  it.effect(
    "answers 404 while PEAL_POSTHOG_SITE is off, as by default, while the app's mode still answers",
    () =>
      Effect.gen(function* off() {
        for (const env of [on, { ...on, PEAL_POSTHOG_SITE: "off" }]) {
          const { response, sent } = yield* relay("/pulse/site/e/", env, {
            body: "[]",
            method: "POST",
          });

          assert.strictEqual(response.status, 404);
          assert.deepStrictEqual(sent, []);

          const app = yield* relay("/pulse/e/", env, {
            body: "[]",
            method: "POST",
          });

          assert.strictEqual(app.response.status, 200);
        }
      })
  );

  it.effect(
    "posts to the host's /e/, query kept, with the app's mode off",
    () =>
      Effect.gen(function* alone() {
        const { response, sent } = yield* relay(
          "/pulse/site/e/?ip=0&ver=1.450.0",
          site,
          { body: "[]", method: "POST" }
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(
          sent[0]?.url,
          "https://eu.i.posthog.com/e/?ip=0&ver=1.450.0"
        );
        assert.strictEqual(sent[0]?.method, "POST");
        assert.strictEqual(sent[0]?.body, "[]");

        const app = yield* relay("/pulse/e/", site, {
          body: "[]",
          method: "POST",
        });

        assert.strictEqual(app.response.status, 404);
      })
  );

  it.effect(
    "forwards the type, the browser's description and the visitor's address alone, and answers PostHog's type alone",
    () =>
      Effect.gen(function* headers() {
        const { response, sent } = yield* relay("/pulse/site/e/", site, {
          body: "[]",
          headers: browserHeaders,
          method: "POST",
        });

        assert.deepStrictEqual(
          [...(sent[0]?.headers.keys() ?? [])].toSorted(),
          ["accept", "content-type", "user-agent", "x-forwarded-for"]
        );
        assert.strictEqual(
          sent[0]?.headers.get("x-forwarded-for"),
          "203.0.113.7"
        );
        assert.strictEqual(
          sent[0]?.headers.get("user-agent"),
          "Mozilla/5.0 (Macintosh)"
        );
        assert.deepStrictEqual([...response.headers.keys()], ["content-type"]);
      })
  );

  it.effect(
    "reads the address from the first header AUTH_IP_HEADERS names that the request carries",
    () =>
      Effect.gen(function* first() {
        const { sent } = yield* relay(
          "/pulse/site/e/",
          { ...site, AUTH_IP_HEADERS: "x-real-ip, x-forwarded-for" },
          {
            body: "[]",
            headers: { "x-forwarded-for": "2001:db8::7, 192.0.2.10" },
            method: "POST",
          }
        );

        assert.strictEqual(
          sent[0]?.headers.get("x-forwarded-for"),
          "2001:db8::7"
        );
      })
  );

  it.effect(
    "forwards no address when the header holds none, or none is named",
    () =>
      Effect.gen(function* noAddress() {
        const cases: readonly (readonly [
          Record<string, string>,
          Record<string, string>,
        ])[] = [
          [site, { ...browserHeaders, "cf-connecting-ip": "synthetic" }],
          [site, { "x-forwarded-for": "192.0.2.10" }],
          [{ ...site, AUTH_IP_HEADERS: "" }, browserHeaders],
          [
            { PEAL_POSTHOG_KEY: "phc_synthetic", PEAL_POSTHOG_SITE: "on" },
            browserHeaders,
          ],
        ];

        for (const [env, headers] of cases) {
          const { response, sent } = yield* relay("/pulse/site/e/", env, {
            body: "[]",
            headers,
            method: "POST",
          });

          assert.strictEqual(response.status, 200);
          assert.isFalse(
            sent[0]?.headers.has("x-forwarded-for"),
            JSON.stringify(env)
          );
        }
      })
  );

  it.effect.each([
    "/pulse/site",
    "/pulse/site/",
    "/pulse/site/e",
    "/pulse/site/s/",
    "/pulse/site/i/v0/e/",
    "/pulse/site/i/v0/s/",
    "/pulse/site/array/phc_synthetic/config",
    "/pulse/site/flags/?v=2",
    "/pulse/site/static/x.js",
  ])("answers 404 to %s, which the site's SDK never sends", (path) =>
    Effect.gen(function* refused() {
      for (const method of ["GET", "POST"]) {
        const { response, sent } = yield* relay(
          path,
          site,
          method === "POST" ? { body: "[]", method } : { method }
        );

        assert.strictEqual(response.status, 404);
        assert.deepStrictEqual(sent, []);
      }
    })
  );

  it.effect("answers 405 to another method than POST", () =>
    Effect.gen(function* method() {
      const { response, sent } = yield* relay("/pulse/site/e/", site, {
        method: "GET",
      });

      assert.strictEqual(response.status, 405);
      assert.deepStrictEqual(sent, []);
    })
  );

  it.effect("refuses a body over 256 KiB", () =>
    Effect.gen(function* tooLarge() {
      const declared = yield* relay("/pulse/site/e/", site, {
        body: "[]",
        headers: { "content-length": String(257 * 1024) },
        method: "POST",
      });

      assert.strictEqual(declared.response.status, 413);

      const undeclared = yield* relay("/pulse/site/e/", site, {
        body: "x".repeat(257 * 1024),
        method: "POST",
      });

      assert.strictEqual(undeclared.response.status, 413);
      assert.deepStrictEqual(undeclared.sent, []);
    })
  );

  it.effect(
    "leaves the app's mode forwarding neither the address nor the browser's description",
    () =>
      Effect.gen(function* app() {
        const { sent } = yield* relay(
          "/pulse/e/",
          { ...on, ...site },
          { body: "[]", headers: browserHeaders, method: "POST" }
        );

        assert.deepStrictEqual(
          [...(sent[0]?.headers.keys() ?? [])],
          ["accept", "content-type"]
        );
      })
  );

  it.effect("fails on a key that is not a project token, or none", () =>
    Effect.gen(function* invalid() {
      for (const env of [
        { ...site, PEAL_POSTHOG_KEY: "phx_synthetic_personal" },
        { PEAL_POSTHOG_SITE: "on" },
        { ...site, PEAL_POSTHOG_SITE: "yes" },
      ]) {
        const exit = yield* relay("/pulse/site/e/", env, {
          body: "[]",
          method: "POST",
        }).pipe(Effect.exit);

        assert.isTrue(Exit.isFailure(exit), JSON.stringify(env));
      }
    })
  );
});
