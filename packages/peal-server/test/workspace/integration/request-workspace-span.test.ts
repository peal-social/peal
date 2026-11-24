// A workspace request's span names the workspace it acted in, which its
// address no longer does, and only once the caller was let in there.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Context, Effect, Layer, Tracer } from "effect";
import { forWorkspace } from "peal-contract";

import { requestIdAttribute } from "#app/request-identity.ts";
import { workspaceIdAttribute } from "#workspace/api/security.ts";

import {
  apiKeyOf,
  MigratedSqlLive,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "./harness.ts";
import { bearer } from "./partner-support.ts";

/** The spans the app made, as its tracer handed them out. */
class Spans extends Context.Service<Spans, Tracer.NativeSpan[]>()(
  "peal-server/test/RequestWorkspaceSpans"
) {}

// The spans live with the layer, built for this file's block alone.
const SpanLive = Layer.unwrap(
  Effect.sync(() => {
    const spans: Tracer.NativeSpan[] = [];

    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);

        spans.push(span);

        return span;
      },
    });

    return Layer.mergeAll(
      TestApp.layerWith(
        unconfirmedEmails,
        Layer.succeed(Tracer.Tracer, tracer)
      ),
      MigratedSqlLive,
      Layer.succeed(Spans, spans)
    );
  })
);

// The workspace each request's own span (the one that carries its id)
// names, of the requests `send` makes.
const namedBy = <A, E, R>(send: Effect.Effect<A, E, R>) =>
  Effect.gen(function* named() {
    const spans = yield* Spans;
    const before = spans.length;

    yield* send;

    return spans
      .slice(before)
      .filter((span) => span.attributes.has(requestIdAttribute))
      .map((span) => span.attributes.get(workspaceIdAttribute));
  });

layer(SpanLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the span of a workspace request",
  (it) => {
    it.effect(
      "names the workspace, from the key or from the header, never one that refused the caller",
      () =>
        Effect.gen(function* named() {
          const app = yield* TestApp;
          const owner = yield* signedUpUnconfirmed("span-workspace");
          const workspaceId = yield* workspaceOf(owner, "Traced");
          const { key } = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

          const read = (headers: Readonly<Record<string, string>>) =>
            app.request("/api/v1/posts/tags", { headers });

          assert.deepStrictEqual(yield* namedBy(read(bearer(key))), [
            workspaceId,
          ]);
          assert.deepStrictEqual(
            yield* namedBy(
              read({ cookie: owner.cookies, ...forWorkspace(workspaceId) })
            ),
            [workspaceId]
          );
          // A workspace the person does not belong to: 404, and no name.
          assert.deepStrictEqual(
            yield* namedBy(
              read({ cookie: owner.cookies, ...forWorkspace(randomUUID()) })
            ),
            [undefined]
          );
        })
    );
  }
);
