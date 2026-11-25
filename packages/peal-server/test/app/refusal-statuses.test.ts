// A request the API refuses before any handler runs (a body it cannot
// decode, a body in a content type it does not read) is counted, logged
// and traced with the status its caller gets, never as a failure of the
// server's own, and answered in the API's envelope.
import { assert, layer } from "@effect/vitest";
import {
  Effect,
  Exit,
  Layer,
  Logger,
  Metric,
  Option,
  References,
  Schema,
  Tracer,
} from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { forWorkspace } from "peal-contract";
import { errorsByTag } from "peal-contract/errors";

import { countRequests, httpRequests } from "#app/request-metrics.ts";
import { AppLive } from "#app/server.ts";
import { storageSettings } from "#test/media/support.ts";
import {
  apiKeyOf,
  MigratedSqlLive,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

const countOf = (status: string) =>
  Metric.value(Metric.withAttributes(httpRequests, { status })).pipe(
    Effect.map(({ count }) => count)
  );

const counts = Effect.all({ "4xx": countOf("4xx"), "5xx": countOf("5xx") });

const EnvelopeSchema = Schema.fromJsonString(
  Schema.Struct({
    _tag: Schema.String,
    code: Schema.String,
    message: Schema.String,
    requestId: Schema.String,
  })
);

const decodeEnvelope = Schema.decodeUnknownSync(EnvelopeSchema);

const catalogue = errorsByTag();

const messageOf = (tag: string) => catalogue.get(tag)?.message ?? "";

// A line of the request log (one a request, with the status it sent), as
// far as these tests read it.
interface Line {
  readonly failed: boolean;
  readonly message: unknown;
  readonly status: number;
}

const decodeStatus = Schema.decodeUnknownOption(Schema.Number);

// The app as production serves it: each request counted, logged and
// traced, to the logger and the tracer each test brings.
const observedApp = (lines: Line[], spans: Tracer.NativeSpan[]) =>
  HttpRouter.toWebHandler(
    AppLive.pipe(
      Layer.provide(HttpServer.layerServices),
      Layer.provide(storageSettings),
      Layer.provideMerge(
        Layer.merge(
          Logger.layer([
            Logger.make(({ cause, fiber, message }) => {
              const sent = decodeStatus(
                fiber.getRef(References.CurrentLogAnnotations)["http.status"]
              );

              if (Option.isSome(sent)) {
                lines.push({
                  failed: cause.reasons.length > 0,
                  message,
                  status: sent.value,
                });
              }
            }),
          ]),
          Layer.succeed(
            Tracer.Tracer,
            Tracer.make({
              span: (options) => {
                const span = new Tracer.NativeSpan(options);

                spans.push(span);

                return span;
              },
            })
          )
        )
      )
    ),
    { middleware: countRequests }
  );

layer(MigratedSqlLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "a request the API cannot decode",
  (it) => {
    it.effect("is counted with the 400 its caller gets", () =>
      Effect.gen(function* counted() {
        const { dispose, handler } = HttpRouter.toWebHandler(
          AppLive.pipe(
            Layer.provide(HttpServer.layerServices),
            Layer.provide(storageSettings)
          ),
          { disableLogger: true, middleware: countRequests }
        );

        const before = yield* counts;

        const response = yield* Effect.promise(
          async () =>
            await handler(
              new Request("http://localhost:3001/api/client-errors", {
                body: JSON.stringify({ kind: "synthetic" }),
                headers: { "content-type": "application/json" },
                method: "POST",
              })
            )
        );

        const body = yield* Effect.promise(async () => await response.text());

        yield* Effect.promise(dispose);

        const after = yield* counts;

        assert.strictEqual(response.status, 400);
        assert.include(body, '"code":"invalid_request"');
        assert.deepStrictEqual(
          {
            "4xx": after["4xx"] - before["4xx"],
            "5xx": after["5xx"] - before["5xx"],
          },
          { "4xx": 1, "5xx": 0 }
        );
      })
    );
  }
);

// A body the endpoint does not read, each as a client would send it to
// one that reads JSON, and what the API answers it.
const malformed: readonly {
  readonly answers: { readonly status: number; readonly tag: string };
  readonly body: FormData | string | Uint8Array<ArrayBuffer> | URLSearchParams;
  readonly case: string;
  readonly contentType?: string;
}[] = [
  {
    answers: { status: 415, tag: "UnsupportedContentType" },
    body: "name=synthetic",
    case: "a text body",
    contentType: "text/plain",
  },
  {
    answers: { status: 415, tag: "UnsupportedContentType" },
    body: new URLSearchParams({ name: "synthetic" }),
    case: "a URL-encoded form",
  },
  {
    answers: { status: 415, tag: "UnsupportedContentType" },
    body: (() => {
      const form = new FormData();

      form.set("name", "synthetic");

      return form;
    })(),
    case: "a multipart form",
  },
  {
    answers: { status: 415, tag: "UnsupportedContentType" },
    body: "",
    case: "an empty body of another type",
    contentType: "text/plain",
  },
  {
    // Without a type, a body is read as JSON.
    answers: { status: 400, tag: "InvalidRequest" },
    body: new TextEncoder().encode("name=synthetic"),
    case: "a body without a content type",
  },
];

layer(Layer.mergeAll(TestApp.layerWith(unconfirmedEmails), MigratedSqlLive), {
  excludeTestServices: true,
  timeout: "180 seconds",
})("a body in a content type the API does not read", (it) => {
  it.effect(
    "is answered in the envelope, and counted, logged and traced as the caller's refusal",
    () =>
      Effect.gen(function* refused() {
        const owner = yield* signedUpUnconfirmed("content-type-owner");
        const workspaceId = yield* workspaceOf(owner, "Content types");
        const { key } = yield* apiKeyOf(owner, workspaceId, ["post:update"]);

        const lines: Line[] = [];
        const spans: Tracer.NativeSpan[] = [];
        const { dispose, handler } = observedApp(lines, spans);

        const before = yield* counts;

        const answers = yield* Effect.forEach(
          malformed,
          (sent, index) =>
            Effect.promise(async () => {
              const requestId = `synthetic-content-type-${index}`;

              const headers = new Headers({
                authorization: `Bearer ${key}`,
                "x-request-id": requestId,
                ...forWorkspace(workspaceId),
              });

              if (sent.contentType !== undefined) {
                headers.set("content-type", sent.contentType);
              }

              const response = await handler(
                new Request("http://localhost:3001/api/v1/posts/tags", {
                  body: sent.body,
                  headers,
                  method: "POST",
                })
              );

              return {
                body: await response.text(),
                contentType: response.headers.get("content-type"),
                headerId: response.headers.get("x-request-id"),
                requestId,
                sent,
                status: response.status,
              };
            }),
          { concurrency: 1 }
        );

        yield* Effect.promise(dispose);

        const after = yield* counts;

        for (const answer of answers) {
          const { answers: expected, case: named } = answer.sent;

          assert.strictEqual(answer.status, expected.status, named);
          assert.strictEqual(answer.contentType, "application/json", named);
          assert.strictEqual(answer.headerId, answer.requestId, named);

          const envelope = decodeEnvelope(answer.body);

          assert.strictEqual(envelope._tag, expected.tag, named);
          assert.strictEqual(
            envelope.code,
            catalogue.get(expected.tag)?.code,
            named
          );
          assert.strictEqual(envelope.requestId, answer.requestId, named);

          if (expected.tag === "UnsupportedContentType") {
            assert.strictEqual(
              envelope.message,
              messageOf(expected.tag),
              named
            );
            assert.include(envelope.message, "application/json", named);
          }

          // Its span ended well, with the status the caller got.
          const traced = spans.filter(
            (span) =>
              span.attributes.get("peal.request_id") === answer.requestId &&
              span.attributes.has("http.response.status_code")
          );

          assert.deepStrictEqual(
            traced.map((span) => ({
              ok:
                span.status._tag === "Ended" &&
                Exit.isSuccess(span.status.exit),
              status: span.attributes.get("http.response.status_code"),
            })),
            [{ ok: true, status: expected.status }],
            named
          );
        }

        // Each request's line, one a request in the order they were sent
        // (the access log is written outside what names the request),
        // says the status its caller got, with no failure.
        assert.deepStrictEqual(
          lines,
          malformed.map(({ answers: { status } }) => ({
            failed: false,
            message: ["Sent HTTP response"],
            status,
          }))
        );

        assert.deepStrictEqual(
          {
            "4xx": after["4xx"] - before["4xx"],
            "5xx": after["5xx"] - before["5xx"],
          },
          { "4xx": malformed.length, "5xx": 0 }
        );
      })
  );
});
