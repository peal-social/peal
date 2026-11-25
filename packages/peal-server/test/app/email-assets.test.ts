// The pictures the emails show, through the whole server: what mail clients
// and mail services' proxies fetch, without credentials.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { emailAssets } from "peal-emails";

import {
  IntegrationLive,
  origin,
  TestApp,
} from "#test/workspace/integration/harness.ts";

const path = "/api/email-assets/";

const answerTo = Effect.fn("answerTo")(function* answerTo(
  address: string,
  init: RequestInit = {}
) {
  const app = yield* TestApp;

  const response = yield* Effect.promise(
    async () => await app.handler(new Request(address, init))
  );

  const bytes = yield* Effect.promise(
    async () => new Uint8Array(await response.arrayBuffer())
  );

  return { bytes, headers: response.headers, status: response.status };
});

const CodedSchema = Schema.fromJsonString(
  Schema.Struct({ code: Schema.String })
);

const codeOf = (bytes: Uint8Array) =>
  Schema.decodeUnknownOption(CodedSchema)(new TextDecoder().decode(bytes)).pipe(
    Option.map(({ code }) => code),
    Option.getOrUndefined
  );

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the emails' pictures",
  (it) => {
    it.effect.each([...emailAssets])(
      "answers %s as it is, for a day in any cache",
      ([name, asset]) =>
        Effect.gen(function* found() {
          const answer = yield* answerTo(`${origin}${path}${name}`);

          assert.strictEqual(answer.status, 200);
          assert.deepStrictEqual(
            Buffer.compare(answer.bytes, asset.bytes),
            0,
            name
          );
          assert.strictEqual(
            answer.headers.get("content-type"),
            asset.contentType
          );
          assert.strictEqual(
            answer.headers.get("cache-control"),
            "public, max-age=86400"
          );
          assert.strictEqual(
            answer.headers.get("x-content-type-options"),
            "nosniff"
          );
          assert.strictEqual(answer.headers.get("x-robots-tag"), "noindex");
          assert.isNull(answer.headers.get("set-cookie"));
        })
    );

    it.effect("reads no query: the same answer whatever follows the name", () =>
      Effect.gen(function* queried() {
        const answer = yield* answerTo(
          `${origin}${path}mark.png?reader=synthetic`
        );

        assert.strictEqual(answer.status, 200);
        assert.strictEqual(
          Buffer.compare(
            answer.bytes,
            emailAssets.get("mark.png")?.bytes ?? new Uint8Array()
          ),
          0
        );
      })
    );

    it.effect("answers HEAD with the headers alone", () =>
      Effect.gen(function* head() {
        const answer = yield* answerTo(`${origin}${path}header.gif`, {
          method: "HEAD",
        });

        assert.strictEqual(answer.status, 200);
        assert.strictEqual(answer.headers.get("content-type"), "image/gif");
        assert.strictEqual(answer.bytes.length, 0);
      })
    );

    it.effect.each([
      { code: "not_found", name: "", status: 404 },
      { code: "not_found", name: "unknown.png", status: 404 },
      { code: "not_found", name: "MARK.PNG", status: 404 },
      { code: "not_found", name: "mark.png%00", status: 404 },
      { code: "not_found", name: "assets/mark.png", status: 404 },
      { code: "not_found", name: "toString", status: 404 },
      // Paths a proxy would read another way, refused before any route.
      { code: "bad_request", name: "..%2Fassets.ts", status: 400 },
      { code: "bad_request", name: "..%2f..%2fpackage.json", status: 400 },
      { code: "bad_request", name: "mark.png;x", status: 400 },
    ])(
      "answers $status to $name, in the API's envelope",
      ({ code, name, status }) =>
        Effect.gen(function* refused() {
          const answer = yield* answerTo(`${origin}${path}${name}`);

          assert.strictEqual(answer.status, status);
          assert.strictEqual(codeOf(answer.bytes), code);
        })
    );

    // `Request` resolves dot segments, as Bun does before the server reads
    // an address: what is left is another path of the server's.
    it.effect("never leaves the list through dot segments", () =>
      Effect.gen(function* dots() {
        const answer = yield* answerTo(`${origin}${path}../theme.ts`);

        assert.strictEqual(answer.status, 404);
        assert.strictEqual(codeOf(answer.bytes), "not_found");
      })
    );
  }
);
