// A workspace request's span names the workspace it acted in, which its
// address no longer does.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Tracer } from "effect";
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

const spans: Tracer.NativeSpan[] = [];

const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);

    spans.push(span);

    return span;
  },
});

const SpanLive = Layer.mergeAll(
  TestApp.layerWith(unconfirmedEmails, Layer.succeed(Tracer.Tracer, tracer)),
  MigratedSqlLive
);

// The request's own span: the one that carries its id.
const requestSpansSince = (before: number) =>
  spans.slice(before).filter((span) => span.attributes.has(requestIdAttribute));

layer(SpanLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the span of a workspace request",
  (it) => {
    it.effect("names the workspace, from the key or from the header", () =>
      Effect.gen(function* named() {
        const app = yield* TestApp;
        const owner = yield* signedUpUnconfirmed("span-workspace");
        const workspaceId = yield* workspaceOf(owner, "Traced");
        const { key } = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

        const byKey = spans.length;

        const read = yield* app.request("/api/v1/posts/tags", {
          headers: bearer(key),
        });

        assert.strictEqual(read.status, 200);
        assert.deepStrictEqual(
          requestSpansSince(byKey).map((span) =>
            span.attributes.get(workspaceIdAttribute)
          ),
          [workspaceId]
        );

        const bySession = spans.length;

        const listed = yield* app.request("/api/v1/posts/tags", {
          headers: { cookie: owner.cookies, ...forWorkspace(workspaceId) },
        });

        assert.strictEqual(listed.status, 200);
        assert.deepStrictEqual(
          requestSpansSince(bySession).map((span) =>
            span.attributes.get(workspaceIdAttribute)
          ),
          [workspaceId]
        );
      })
    );
  }
);
