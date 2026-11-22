// Meta's events reach the server without credentials, at
// /api/platform-events/meta/:app: the subscription's handshake answers its
// challenge only for the operator's verify token, and an event is taken
// only when signed with its app's secret over the bytes received, before
// anything of it is read. A server without the token takes none.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Metric } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

import { platformEvents } from "#app/platform-events/route.ts";
import { origin, TestApp } from "#test/workspace/integration/harness.ts";

const verifyToken = "synthetic-verify-token-for-meta-events-0001";
const mainSecret = "synthetic-meta-app-secret";
const instagramSecret = "synthetic-instagram-app-secret";

const configured = {
  INSTAGRAM_APP_ID: "1002",
  INSTAGRAM_APP_SECRET: instagramSecret,
  META_APP_ID: "1001",
  META_APP_SECRET: mainSecret,
  META_WEBHOOK_VERIFY_TOKEN: verifyToken,
};

const encoder = new TextEncoder();

// What Meta signs: HMAC-SHA256 of the body's bytes, in lowercase hex.
const signatureOf = (secret: string, body: Uint8Array) =>
  Effect.gen(function* signing() {
    const mac = yield* Mac.Mac;
    const key = yield* Mac.key(Mac.hmacSha256, encoder.encode(secret));

    return `sha256=${Hex.encode(yield* mac.sign(key, body))}`;
  }).pipe(
    Effect.provide(
      Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
    ),
    Effect.orDie
  );

interface Answer {
  readonly status: number;
  readonly text: string;
  readonly type: string | null;
}

const send = (
  path: string,
  init: {
    readonly body?: Uint8Array;
    readonly headers?: Readonly<Record<string, string>>;
    readonly method?: string;
  } = {}
) =>
  Effect.gen(function* sending() {
    const app = yield* TestApp;

    return yield* Effect.promise(async (): Promise<Answer> => {
      const response = await app.handler(
        new Request(new URL(path, origin).href, {
          body: init.body === undefined ? undefined : new Uint8Array(init.body),
          headers: init.headers,
          method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        })
      );

      return {
        status: response.status,
        text: await response.text(),
        type: response.headers.get("content-type"),
      };
    });
  });

const handshake = (app: string, query: Readonly<Record<string, string>>) =>
  send(
    `/api/platform-events/meta/${app}?${new URLSearchParams(query).toString()}`
  );

const subscribe = (changed: Readonly<Record<string, string>> = {}) => ({
  "hub.challenge": "1158201444",
  "hub.mode": "subscribe",
  "hub.verify_token": verifyToken,
  ...changed,
});

// A Page's text message, as Meta's Messenger samples write it.
const pageEvent = (pageId: string) =>
  encoder.encode(
    JSON.stringify({
      entry: [
        {
          id: pageId,
          messaging: [
            {
              message: { mid: "m_synthetic_1", text: "Synthetic hello" },
              recipient: { id: pageId },
              sender: { id: "synthetic-sender" },
              timestamp: 1_763_288_400_000,
            },
          ],
          time: Date.now(),
        },
      ],
      object: "page",
    })
  );

const post = (app: string, body: Uint8Array, signature?: string) =>
  send(`/api/platform-events/meta/${app}`, {
    body,
    headers:
      signature === undefined
        ? { "content-type": "application/json" }
        : {
            "content-type": "application/json",
            "x-hub-signature-256": signature,
          },
    method: "POST",
  });

const counted = (app: string, outcome: string) =>
  Metric.value(Metric.withAttributes(platformEvents, { app, outcome })).pipe(
    Effect.map(({ count }) => count)
  );

layer(TestApp.layerWith({ META_APP_ID: "1001", META_APP_SECRET: mainSecret }))(
  "Meta's events, without a verify token",
  (it) => {
    it.effect("answer 404 to the handshake and to every event", () =>
      Effect.gen(function* off() {
        const checked = yield* handshake("facebook", subscribe());

        assert.strictEqual(checked.status, 404);
        assert.notInclude(checked.text, "1158201444");

        const body = pageEvent("synthetic-page");

        const event = yield* post(
          "facebook",
          body,
          yield* signatureOf(mainSecret, body)
        );

        assert.strictEqual(event.status, 404);
      })
    );
  }
);

layer(TestApp.layerWith(configured))("Meta's events", (it) => {
  it.effect("answer the handshake's challenge, as plain text", () =>
    Effect.gen(function* answered() {
      for (const app of ["facebook", "instagram"]) {
        const checked = yield* handshake(app, subscribe());

        assert.strictEqual(checked.status, 200, app);
        assert.strictEqual(checked.text, "1158201444", app);
        assert.include(checked.type ?? "", "text/plain", app);
      }
    })
  );

  it.effect(
    "refuse a handshake with another token, mode or challenge, and never echo it",
    () =>
      Effect.gen(function* refused() {
        const refusals = [
          subscribe({ "hub.verify_token": `${verifyToken}x` }),
          subscribe({ "hub.verify_token": "" }),
          subscribe({ "hub.mode": "unsubscribe" }),
          subscribe({ "hub.challenge": "<script>synthetic</script>" }),
          subscribe({ "hub.challenge": "1".repeat(33) }),
          subscribe({ "hub.challenge": "" }),
        ];

        for (const query of refusals) {
          const checked = yield* handshake("facebook", query);

          assert.strictEqual(checked.status, 403, JSON.stringify(query));
          assert.notInclude(checked.text, "synthetic");
          assert.notInclude(checked.text, verifyToken);
          assert.notInclude(checked.text, "1158201444");
        }

        // Another app's name is no address.
        assert.strictEqual(
          (yield* handshake("threads", subscribe())).status,
          404
        );
      })
  );

  it.effect(
    "refuse an event unsigned, signed with another secret, or over other bytes, before reading it",
    () =>
      Effect.gen(function* unsigned() {
        const body = pageEvent("synthetic-page");
        const before = yield* counted("facebook", "unsigned");

        const signed = yield* signatureOf(mainSecret, body);
        const altered = new Uint8Array(body);

        altered[altered.length - 2] = 0x20;

        const answers = [
          yield* post("facebook", body),
          yield* post("facebook", body, "sha256=forged"),
          yield* post("facebook", body, signed.toUpperCase()),
          yield* post("facebook", body, signed.replace("sha256=", "sha1=")),
          yield* post(
            "facebook",
            body,
            yield* signatureOf(instagramSecret, body)
          ),
          yield* post("facebook", altered, signed),
        ];

        assert.deepStrictEqual(
          answers.map(({ status }) => status),
          [403, 403, 403, 403, 403, 403]
        );
        assert.strictEqual(
          (yield* counted("facebook", "unsigned")) - before,
          6
        );
      })
  );

  // Which of the two secrets Meta signs Instagram Login's events with is
  // for the sandbox's trial to settle: both are the operator's own, so
  // either is taken until then. The main app's address takes its own.
  it.effect(
    "take the Instagram app's events signed with either of the operator's secrets, and no other",
    () =>
      Effect.gen(function* instagram() {
        const body = encoder.encode(
          JSON.stringify({
            entry: [{ id: "synthetic-instagram-account", messaging: [] }],
            object: "instagram",
          })
        );

        const statuses = [
          yield* post(
            "instagram",
            body,
            yield* signatureOf(instagramSecret, body)
          ),
          yield* post("instagram", body, yield* signatureOf(mainSecret, body)),
          yield* post(
            "instagram",
            body,
            yield* signatureOf("synthetic-other-secret", body)
          ),
          yield* post(
            "facebook",
            body,
            yield* signatureOf(instagramSecret, body)
          ),
        ].map(({ status }) => status);

        assert.deepStrictEqual(statuses, [200, 200, 403, 403]);
      })
  );

  it.effect("refuse a body past 4 MiB, signed or not", () =>
    Effect.gen(function* large() {
      const body = encoder.encode(
        JSON.stringify({
          entry: [],
          object: "page",
          padding: "x".repeat(4 * 1024 * 1024),
        })
      );

      const answer = yield* post(
        "facebook",
        body,
        yield* signatureOf(mainSecret, body)
      );

      assert.strictEqual(answer.status, 413);

      // Without a signature of the expected form, not even read.
      const unsigned = yield* post("facebook", body, "sha256=forged");

      assert.strictEqual(unsigned.status, 403);
    })
  );

  it.effect("answer their refusals with an empty body", () =>
    Effect.gen(function* empty() {
      const body = pageEvent("synthetic-page");

      for (const answer of [
        yield* post("facebook", body, "sha256=forged"),
        yield* handshake("facebook", subscribe({ "hub.mode": "unsubscribe" })),
        yield* handshake("threads", subscribe()),
      ]) {
        assert.include([403, 404], answer.status);
        assert.strictEqual(answer.text, "");
      }
    })
  );

  it.effect("answer no other spelling of their address", () =>
    Effect.gen(function* spellings() {
      const body = pageEvent("synthetic-page");
      const signature = yield* signatureOf(mainSecret, body);

      // A semicolon is refused before any route runs
      // (`peal-contract/path-spelling`), the others by no route.
      for (const [app, status] of [
        ["facebook;x", 400],
        ["facebook/", 404],
        ["%66acebook", 404],
        ["Facebook", 404],
      ] as const) {
        assert.strictEqual(
          (yield* post(app, body, signature)).status,
          status,
          app
        );
        assert.strictEqual(
          (yield* handshake(app, subscribe())).status,
          status,
          app
        );
      }
    })
  );

  it.effect(
    "take an event older than a day, signed, without acting on it",
    () =>
      Effect.gen(function* stale() {
        const before = yield* counted("facebook", "stale");

        // Meta's `time`, in milliseconds: two days ago.
        const body = encoder.encode(
          JSON.stringify({
            entry: [
              {
                id: "synthetic-page-stale",
                messaging: [{ message: { mid: "m_synthetic_stale" } }],
                time: Date.now() - 2 * 24 * 60 * 60 * 1000,
              },
            ],
            object: "page",
          })
        );

        const answer = yield* post(
          "facebook",
          body,
          yield* signatureOf(mainSecret, body)
        );

        assert.strictEqual(answer.status, 200);
        assert.strictEqual((yield* counted("facebook", "stale")) - before, 1);
      })
  );

  it.effect(
    "take a signed body they cannot read, so Meta does not send it again, and count it",
    () =>
      Effect.gen(function* unreadable() {
        const before = yield* counted("facebook", "unreadable");

        for (const text of [
          "not json",
          '{"object":"user","entry":[]}',
          "null",
        ]) {
          const body = encoder.encode(text);

          const answer = yield* post(
            "facebook",
            body,
            yield* signatureOf(mainSecret, body)
          );

          assert.strictEqual(answer.status, 200, text);
          assert.strictEqual(answer.text, "", text);
        }

        assert.strictEqual(
          (yield* counted("facebook", "unreadable")) - before,
          3
        );
      })
  );

  it.effect(
    "take an event for an account no channel holds, and say nothing of it",
    () =>
      Effect.gen(function* ignored() {
        const before = yield* counted("facebook", "ignored");
        const body = pageEvent("synthetic-page-nobody-connected");

        const signature = yield* signatureOf(mainSecret, body);

        // Sent again, as Meta does when it misses an answer: the same.
        for (const answer of [
          yield* post("facebook", body, signature),
          yield* post("facebook", body, signature),
        ]) {
          assert.strictEqual(answer.status, 200);
          assert.strictEqual(answer.text, "");
        }

        assert.strictEqual((yield* counted("facebook", "ignored")) - before, 2);

        // Another app's name, or a path under the app's, is no address.
        assert.strictEqual(
          (yield* post("threads", body, signature)).status,
          404
        );
      })
  );
});
