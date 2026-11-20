// A request that misses several fields is told of each in one answer, not
// one field a round trip.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import {
  IntegrationLive,
  origin,
  signedUp,
  TestApp,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

const RefusalSchema = Schema.fromJsonString(
  Schema.Struct({
    code: Schema.String,
    issues: Schema.Array(Schema.Struct({ path: Schema.Array(Schema.String) })),
  })
);

const decodeRefusal = Schema.decodeUnknownOption(RefusalSchema);

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "a request missing several fields",
  (it) => {
    it.effect("names every field it lacks", () =>
      Effect.gen(function* naming() {
        const app = yield* TestApp;
        const owner = yield* signedUp("request-issues");
        const workspaceId = yield* workspaceOf(owner, "Request issues");

        const response = yield* Effect.promise(
          async () =>
            await app.handler(
              new Request(
                `${origin}/api/workspaces/${workspaceId}/posts/01a1fb36-df6b-75e0-a3b4-1de09779ec94/schedule`,
                {
                  body: "{}",
                  headers: {
                    "content-type": "application/json",
                    cookie: owner.cookies,
                    origin,
                  },
                  method: "POST",
                }
              )
            )
        );

        const text = yield* Effect.promise(async () => await response.text());

        const fields = decodeRefusal(text).pipe(
          Option.map(({ issues }) => issues.map(({ path }) => path.join("."))),
          Option.getOrElse((): readonly string[] => [])
        );

        assert.strictEqual(response.status, 400);
        assert.includeMembers(
          [...fields],
          ["body.at", "body.channelIds", "body.timeZone"]
        );
      })
    );
  }
);
