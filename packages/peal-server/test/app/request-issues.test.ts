// A request that misses several fields is told of each in one answer, not
// one field a round trip.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { forWorkspace } from "peal-contract";

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

// The status of a POST of `body` to the workspace's `path`, and the
// places its answer's issues name.
const refused = (name: string, path: string, body: Schema.Json) =>
  Effect.gen(function* refusing() {
    const app = yield* TestApp;
    const owner = yield* signedUp(name);
    const workspaceId = yield* workspaceOf(owner, "Request issues");

    const response = yield* Effect.promise(
      async () =>
        await app.handler(
          new Request(`${origin}/api/v1${path}`, {
            body: JSON.stringify(body),
            headers: {
              ...forWorkspace(workspaceId),
              "content-type": "application/json",
              cookie: owner.cookies,
              origin,
            },
            method: "POST",
          })
        )
    );

    const text = yield* Effect.promise(async () => await response.text());

    const fields = decodeRefusal(text).pipe(
      Option.map(({ issues }) => issues.map((issue) => issue.path.join("."))),
      Option.getOrElse((): readonly string[] => [])
    );

    return { fields, status: response.status };
  });

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "a request missing several fields",
  (it) => {
    it.effect("names every field it lacks", () =>
      Effect.gen(function* naming() {
        const { fields, status } = yield* refused(
          "request-issues",
          "/posts/01a1fb36-df6b-75e0-a3b4-1de09779ec94/schedule",
          {}
        );

        assert.strictEqual(status, 400);
        assert.includeMembers(
          [...fields],
          ["body.at", "body.channelIds", "body.timeZone"]
        );
      })
    );

    it.effect(
      "names the field to change of a rule on neither a post nor a channel, or on both",
      () =>
        Effect.gen(function* scoping() {
          const post = "01a1fb36-df6b-75e0-a3b4-1de09779ec94";
          const channel = "01a1fb36-df6b-75e0-a3b4-1de09779ec95";

          const neither = yield* refused("follow-up-neither", "/follow-ups", {
            comment: "Thanks!",
            likes: 10,
          });

          const both = yield* refused("comment-rule-both", "/inbox/rules", {
            channelId: channel,
            keywords: ["price"],
            postId: post,
            reply: "Sent you the prices.",
          });

          assert.strictEqual(neither.status, 400);
          assert.deepStrictEqual(neither.fields, ["body.postId"]);
          assert.strictEqual(both.status, 400);
          assert.deepStrictEqual(both.fields, ["body.channelId"]);
        })
    );
  }
);
