import { assert, describe, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

import {
  multipartBody,
  multipartFormBody,
} from "#shared/infrastructure/platforms/multipart-stream.ts";

const encoder = new TextEncoder();

const decoder = new TextDecoder();

// A synthetic file whose bytes come in several chunks, as a store sends
// them.
const file = (name: string, fileName: string, text: string) => ({
  byteSize: encoder.encode(text).length,
  bytes: Stream.fromIterable(
    Array.from({ length: text.length }, (_, index) =>
      encoder.encode(text.slice(index, index + 1))
    )
  ),
  contentType: "image/png",
  fileName,
  name,
});

const read = (bytes: Stream.Stream<Uint8Array>) =>
  Stream.runCollect(bytes).pipe(
    Effect.map((chunks) =>
      chunks.reduce((all, chunk) => all + decoder.decode(chunk), "")
    )
  );

describe(multipartFormBody, () => {
  it.effect("frames fields, then each file in turn, byte for byte", () =>
    Effect.gen(function* framing() {
      const body = multipartFormBody({
        boundary: "peal-synthetic",
        fields: [
          { name: "chat_id", value: "-100" },
          { name: "payload_json", value: '{"content":"Hi"}' },
        ],
        files: [
          file("files[0]", "one.png", "first"),
          file("files[1]", 'two "b".png', "second"),
        ],
      });

      const text = yield* read(body.bytes);

      assert.strictEqual(
        text,
        [
          "--peal-synthetic",
          'Content-Disposition: form-data; name="chat_id"',
          "",
          "-100",
          "--peal-synthetic",
          'Content-Disposition: form-data; name="payload_json"',
          "",
          '{"content":"Hi"}',
          "--peal-synthetic",
          'Content-Disposition: form-data; name="files[0]"; filename="one.png"',
          "Content-Type: image/png",
          "",
          "first",
          "--peal-synthetic",
          'Content-Disposition: form-data; name="files[1]"; filename="two %22b%22.png"',
          "Content-Type: image/png",
          "",
          "second",
          "--peal-synthetic--",
          "",
        ].join("\r\n")
      );
      assert.strictEqual(body.contentLength, encoder.encode(text).length);
      assert.strictEqual(
        body.contentType,
        "multipart/form-data; boundary=peal-synthetic"
      );
    })
  );

  it.effect("frames one file as multipartBody always did", () =>
    Effect.gen(function* single() {
      const form = {
        boundary: "peal-synthetic",
        fields: [{ name: "description", value: "A synthetic image" }],
      };

      const one = multipartBody({
        ...form,
        file: file("file", "a.png", "bytes"),
      });

      const many = multipartFormBody({
        ...form,
        files: [file("file", "a.png", "bytes")],
      });

      assert.strictEqual(yield* read(one.bytes), yield* read(many.bytes));
      assert.strictEqual(one.contentLength, many.contentLength);
    })
  );

  it.effect("frames fields alone", () =>
    Effect.gen(function* fieldsAlone() {
      const body = multipartFormBody<never, never>({
        boundary: "peal-synthetic",
        fields: [{ name: "chat_id", value: "-100" }],
        files: [],
      });

      assert.strictEqual(
        yield* read(body.bytes),
        [
          "--peal-synthetic",
          'Content-Disposition: form-data; name="chat_id"',
          "",
          "-100",
          "--peal-synthetic--",
          "",
        ].join("\r\n")
      );
    })
  );

  it.effect("opens a file only once the files before it are sent", () =>
    Effect.gen(function* lazily() {
      const opened: string[] = [];

      const tracked = (name: string) => ({
        ...file(name, `${name}.png`, "x"),
        bytes: Stream.suspend((): Stream.Stream<Uint8Array> => {
          opened.push(name);

          return Stream.make(encoder.encode("x"));
        }),
      });

      const body = multipartFormBody({
        boundary: "peal-synthetic",
        fields: [],
        files: [tracked("a"), tracked("b")],
      });

      assert.deepStrictEqual(opened, []);

      yield* Stream.runDrain(body.bytes);

      assert.deepStrictEqual(opened, ["a", "b"]);
    })
  );
});
