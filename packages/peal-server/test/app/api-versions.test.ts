import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Metric } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { apiChangelog, apiVersion, apiVersionHeader } from "peal-contract";

import { ApiAnswersLive } from "#app/answers.ts";
import {
  apiVersionRequests,
  countsVersion,
  sentVersionOf,
} from "#app/api-versions.ts";

// One route that answers, one that breaks, and the liveness probe.
const Routes = HttpRouter.use((router) =>
  Effect.all([
    router.add("GET", "/api/things", HttpServerResponse.text("ok")),
    router.add("GET", "/api/broken", Effect.die("a bug")),
    router.add("GET", "/api/health", HttpServerResponse.text("ok")),
  ])
);

const countOf = (version: string) =>
  Metric.value(Metric.withAttributes(apiVersionRequests, { version })).pipe(
    Effect.map(({ count }) => count)
  );

const counts = Effect.all({
  known: countOf(apiVersion),
  none: countOf("none"),
  unknown: countOf("unknown"),
});

const ask = (
  handler: (request: Request) => Promise<Response>,
  path: string,
  sent?: string
) =>
  Effect.promise(
    async () =>
      await handler(
        new Request(`http://localhost/api/${path}`, {
          headers: sent === undefined ? {} : { [apiVersionHeader]: sent },
        })
      )
  );

describe("API versions", () => {
  it("speaks the latest release's day", () => {
    assert.strictEqual(apiVersion, apiChangelog.entries[0]?.date);
    assert.match(apiVersion, /^\d{4}-\d{2}-\d{2}$/u);
  });

  it("names a version it knows, and nothing else, as clients sent it", () => {
    assert.strictEqual(sentVersionOf(apiVersion), apiVersion);
    assert.strictEqual(sentVersionOf(` ${apiVersion} `), apiVersion);
    assert.strictEqual(sentVersionOf(undefined), "none");
    assert.strictEqual(sentVersionOf(""), "none");
    assert.strictEqual(sentVersionOf("2020-01-01"), "unknown");
    assert.strictEqual(sentVersionOf("latest"), "unknown");
  });

  it("counts the API's requests, never the probes", () => {
    assert.isTrue(countsVersion("/api/posts"));
    assert.isFalse(countsVersion("/api/health"));
    assert.isFalse(countsVersion("/api/ready"));
    assert.isFalse(countsVersion("/openapi.json"));
  });

  it.effect(
    "tells every answer its version, and counts what each client sent",
    () =>
      Effect.gen(function* told() {
        const before = yield* counts;

        const { dispose, handler } = HttpRouter.toWebHandler(
          Layer.mergeAll(Routes, ApiAnswersLive),
          { disableLogger: true }
        );

        const answers = yield* Effect.all(
          [
            ask(handler, "things", apiVersion),
            ask(handler, "things", "1999-12-31"),
            ask(handler, "things"),
            ask(handler, "broken", apiVersion),
            ask(handler, "missing"),
            ask(handler, "health"),
          ],
          { concurrency: 1 }
        );

        yield* Effect.promise(dispose);

        assert.deepStrictEqual(
          answers.map((answer) => answer.status),
          [200, 200, 200, 500, 404, 200]
        );

        for (const answer of answers) {
          assert.strictEqual(answer.headers.get(apiVersionHeader), apiVersion);
        }

        const after = yield* counts;

        assert.deepStrictEqual(
          {
            known: after.known - before.known,
            none: after.none - before.none,
            unknown: after.unknown - before.unknown,
          },
          { known: 2, none: 2, unknown: 1 }
        );
      })
  );
});
