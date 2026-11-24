// A request's body is held to its route's limit, through the whole server:
// one declared larger is refused before it is read, one that says nothing
// of its length when its read goes past, each with 413 in the API's
// envelope; the routes that take a workspace's content take more.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";

import { AppLive } from "#app/server.ts";
import { storageSettings } from "#test/media/support.ts";
import { MigratedSqlLive } from "#test/workspace/integration/harness.ts";

const origin = "http://localhost:3001";

const mebibytes = (count: number) => "x".repeat(count * 1024 * 1024);

const CodedSchema = Schema.fromJsonString(
  Schema.Struct({ code: Schema.String })
);

const decodeCode = Schema.decodeUnknownOption(CodedSchema);

// A sign-in for an address nobody has, padded to a size.
const signInBody = (padding: string) =>
  JSON.stringify({
    email: "nobody-synthetic@example.test",
    padding,
    password: "synthetic-password",
  });

// A body sent in chunks, without a length, as a client streaming it does.
const streamed = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(text);
      const chunk = 64 * 1024;

      for (let at = 0; at < bytes.length; at += chunk) {
        controller.enqueue(bytes.subarray(at, at + chunk));
      }

      controller.close();
    },
  });

layer(MigratedSqlLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "a request's body",
  (it) => {
    it.effect(
      "answers 413 past its route's limit, declared or read, in the API's envelope",
      () =>
        Effect.gen(function* limited() {
          const { dispose, handler } = HttpRouter.toWebHandler(
            AppLive.pipe(
              Layer.provide(HttpServer.layerServices),
              Layer.provide(storageSettings)
            ),
            { disableLogger: true }
          );

          const answer = (path: string, init: RequestInit) =>
            Effect.promise(async () => {
              const response = await handler(
                new Request(`${origin}${path}`, { method: "POST", ...init })
              );

              const text = await response.text();

              return {
                code: Option.getOrUndefined(
                  decodeCode(text).pipe(Option.map(({ code }) => code))
                ),
                status: response.status,
              };
            });

          const json = { "content-type": "application/json" };

          // A body with its length, as every client but a streaming one
          // sends it (Request leaves the header to the one that sends it).
          const declared = (body: string, type = json["content-type"]) => ({
            body,
            headers: {
              "content-length": String(new TextEncoder().encode(body).length),
              "content-type": type,
            },
          });

          // Declared, on routes that need no credentials.
          const deletion = yield* answer(
            "/api/data-deletion/facebook",
            declared(
              `signed_request=${mebibytes(2)}`,
              "application/x-www-form-urlencoded"
            )
          );

          const confirmation = yield* answer(
            "/api/contract-requests/confirmation",
            declared(JSON.stringify({ token: mebibytes(2) }))
          );

          // Better Auth's, which reads the web request itself.
          const signIn = yield* answer(
            "/api/auth/sign-in/email",
            declared(JSON.stringify({ email: mebibytes(2) }))
          );

          // Read: a body in chunks, with no length to refuse it by, and one
          // whose length is not declared.
          const chunked = yield* answer("/api/contract-requests/confirmation", {
            body: streamed(JSON.stringify({ token: mebibytes(2) })),
            duplex: "half",
            headers: json,
          });

          // Better Auth's, in chunks: read under the limit before it is
          // handed over, a byte past it refused, a small one answered as
          // sent.
          const pastSize = 1024 * 1024 + 1 - signInBody("").length;

          const chunkedSignIn = yield* answer("/api/auth/sign-in/email", {
            body: streamed(signInBody("x".repeat(pastSize))),
            duplex: "half",
            headers: json,
          });

          const atLimitSignIn = yield* answer("/api/auth/sign-in/email", {
            body: streamed(signInBody("x".repeat(pastSize - 1))),
            duplex: "half",
            headers: json,
          });

          const undeclared = yield* answer("/api/data-deletion/facebook", {
            body: `signed_request=${mebibytes(2)}`,
            headers: { "content-type": "application/x-www-form-urlencoded" },
          });

          // The content routes take more, up to their own limit: past it
          // they refuse, below it the credential is what is missing.
          const posts = `/api/v1/posts/bulk`;

          const bulk = yield* answer(
            posts,
            declared(JSON.stringify({ posts: mebibytes(2) }))
          );

          const tooMany = yield* answer(
            posts,
            declared(JSON.stringify({ posts: mebibytes(9) }))
          );

          const mcp = yield* answer(
            "/api/mcp",
            declared(JSON.stringify({ params: mebibytes(9) }))
          );

          yield* Effect.promise(dispose);

          for (const refused of [
            deletion,
            confirmation,
            chunked,
            undeclared,
            tooMany,
          ]) {
            assert.deepStrictEqual(refused, {
              code: "payload_too_large",
              status: 413,
            });
          }

          assert.strictEqual(signIn.status, 413);
          assert.strictEqual(chunkedSignIn.status, 413);
          // Exactly at the limit, Better Auth reads it: nobody has that
          // address.
          assert.strictEqual(atLimitSignIn.status, 401);
          assert.strictEqual(mcp.status, 413);
          assert.strictEqual(bulk.status, 401);
        })
    );
  }
);
