// A request the API refuses before any handler runs (a body it cannot
// decode) is counted, logged and traced with the status its caller gets,
// never as a failure of the server's own.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Metric } from "effect";
import { HttpRouter, HttpServer } from "effect/http";

import { countRequests, httpRequests } from "#app/request-metrics.ts";
import { AppLive } from "#app/server.ts";
import { storageSettings } from "#test/media/support.ts";
import { MigratedSqlLive } from "#test/workspace/integration/harness.ts";

const countOf = (status: string) =>
  Metric.value(Metric.withAttributes(httpRequests, { status })).pipe(
    Effect.map(({ count }) => count)
  );

const counts = Effect.all({ "4xx": countOf("4xx"), "5xx": countOf("5xx") });

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
