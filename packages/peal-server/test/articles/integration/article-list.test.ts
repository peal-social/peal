// The list of a workspace's articles, through the API: each without its
// body, which `get` reads, and those scheduled in a range when one is
// given, from included to excluded, as the posts' list reads it.
import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { forWorkspace } from "peal-contract";

import {
  bodyOf,
  IntegrationLive,
  signedUp,
  TestApp,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";
import { seedChannel } from "#test/workspace/integration/seed.ts";

const PageSchema = Schema.Struct({
  items: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});

const CursorPageSchema = Schema.Struct({
  items: Schema.Array(Schema.Struct({ id: Schema.String })),
  nextCursor: Schema.NullOr(Schema.String),
});

const IdSchema = Schema.Struct({ id: Schema.String });

const articleOf = (title: string) => ({
  body: {
    content: [{ content: [{ text: title, type: "text" }], type: "paragraph" }],
    type: "doc",
  },
  title,
});

layer(IntegrationLive)("the articles' list", (it) => {
  it.effect(
    "gives each article without its body, and those scheduled in a range",
    () =>
      Effect.gen(function* listed() {
        const app = yield* TestApp;
        const sql = yield* SqlClient.SqlClient;
        const owner = yield* signedUp("article-list");
        const workspaceId = yield* workspaceOf(owner, "Article list");
        const headers = { cookie: owner.cookies, ...forWorkspace(workspaceId) };

        const channelId = yield* seedChannel(workspaceId, "list.example", {
          platform: "wordpress",
        });

        const create = (title: string) =>
          app
            .request("/api/v1/articles", {
              body: { ...articleOf(title), channelId },
              headers,
            })
            .pipe(Effect.flatMap((reply) => bodyOf(IdSchema, reply)));

        const draft = yield* create("A synthetic draft");
        const early = yield* create("A synthetic early article");
        const late = yield* create("A synthetic late article");

        // Scheduled in the stored form, so no job waits for them.
        const scheduleAt = (id: string, at: string) =>
          sql`UPDATE publishing.articles
            SET status = 'scheduled', scheduled_at = ${at}::timestamptz,
              schedule_zone = 'Europe/Paris',
              state = ${JSON.stringify({ _tag: "scheduled", schedule: { at, timeZone: "Europe/Paris" } })}::jsonb
            WHERE id = ${id}`;

        yield* scheduleAt(early.id, "2099-03-01T09:00:00.000Z");
        yield* scheduleAt(late.id, "2099-03-08T09:00:00.000Z");

        const list = (query: string) =>
          app.request(`/api/v1/articles${query}`, { headers });

        const all = yield* list("").pipe(
          Effect.flatMap((reply) => bodyOf(PageSchema, reply))
        );

        assert.deepStrictEqual(
          all.items.map(({ id }) => id),
          [late.id, early.id, draft.id]
        );
        assert.isTrue(all.items.every((item) => !("body" in item)));

        const ids = (query: string) =>
          list(query).pipe(
            Effect.flatMap((reply) => bodyOf(PageSchema, reply)),
            Effect.map(({ items }) => items.map(({ id }) => id))
          );

        // From included, to excluded; a range leaves drafts out.
        assert.deepStrictEqual(
          yield* ids(
            "?from=2099-03-01T09:00:00.000Z&to=2099-03-08T09:00:00.000Z"
          ),
          [early.id]
        );
        assert.deepStrictEqual(yield* ids("?from=2099-03-02T00:00:00.000Z"), [
          late.id,
        ]);
        assert.deepStrictEqual(yield* ids("?to=2099-03-08T09:00:00.001Z"), [
          late.id,
          early.id,
        ]);

        // A range read a page at a time, as the calendar reads it, to the
        // last page.
        const range =
          "from=2099-03-01T00:00:00.000Z&to=2099-03-09T00:00:00.000Z";

        const paged: string[] = [];
        let cursor: string | null = "";

        while (cursor !== null) {
          const after: string = cursor === "" ? "" : `&cursor=${cursor}`;

          const page = yield* list(`?limit=1&${range}${after}`).pipe(
            Effect.flatMap((reply) => bodyOf(CursorPageSchema, reply))
          );

          paged.push(...page.items.map(({ id }) => id));
          cursor = page.nextCursor;
        }

        assert.deepStrictEqual(paged, [late.id, early.id]);

        // A status and a range both hold.
        assert.deepStrictEqual(
          yield* ids(
            `?status=scheduled&from=2099-03-01T00:00:00.000Z&to=2099-03-08T00:00:00.000Z`
          ),
          [early.id]
        );
        assert.deepStrictEqual(yield* ids(`?status=draft&${range}`), []);

        // A range that ends where it starts is refused.
        const refused = yield* list(
          "?from=2099-03-08T09:00:00.000Z&to=2099-03-08T09:00:00.000Z"
        );

        assert.strictEqual(refused.status, 400);
        assert.strictEqual(
          (yield* bodyOf(Schema.Struct({ _tag: Schema.String }), refused))._tag,
          "InvalidTimeRange"
        );

        // Read whole, an article keeps its body.
        const read = yield* app.request(`/api/v1/articles/${early.id}`, {
          headers,
        });

        assert.isTrue(
          "body" in
            (yield* bodyOf(Schema.Record(Schema.String, Schema.Unknown), read))
        );

        yield* sql`DELETE FROM publishing.articles WHERE workspace_id = ${workspaceId}`;
      })
  );
});
