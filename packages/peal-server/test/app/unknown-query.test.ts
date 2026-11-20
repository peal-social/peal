// A query parameter an endpoint does not take is refused, through the whole
// server, never ignored: a misspelt filter would otherwise answer as if it
// were applied. The health checks take whatever a monitor adds.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import {
  confirmedAccount,
  IntegrationLive,
  origin,
  signIn,
  TestApp,
} from "#test/workspace/integration/harness.ts";

const CodedSchema = Schema.fromJsonString(
  Schema.Struct({
    code: Schema.String,
    field: Schema.optionalKey(Schema.String),
  })
);

const decodeCoded = Schema.decodeUnknownOption(CodedSchema);

const answerTo = Effect.fn("answerTo")(function* answerTo(
  path: string,
  cookie: string
) {
  const app = yield* TestApp;

  const response = yield* Effect.promise(
    async () =>
      await app.handler(
        new Request(`${origin}${path}`, { headers: { cookie, origin } })
      )
  );

  const text = yield* Effect.promise(async () => await response.text());

  return {
    body: decodeCoded(text).pipe(Option.getOrUndefined),
    status: response.status,
  };
});

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "query parameters an endpoint does not take",
  (it) => {
    it.effect("are refused as InvalidRequest, naming the parameter", () =>
      Effect.gen(function* refusing() {
        const account = yield* confirmedAccount("unknown-query");
        const cookie = yield* signIn(account.email);

        const taken = yield* answerTo("/api/me/notices?limit=5", cookie);

        const unknown = yield* answerTo(
          "/api/me/notices?limit=5&limits=1",
          cookie
        );

        assert.strictEqual(taken.status, 200);
        assert.strictEqual(unknown.status, 400);
        assert.strictEqual(unknown.body?.code, "invalid_request");
        assert.strictEqual(unknown.body?.field, "query.limits");

        const health = yield* answerTo("/api/health?probe=1", cookie);

        assert.strictEqual(health.status, 204);
      })
    );
  }
);
