import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer } from "effect";
import { Base64Url } from "effect/encoding";
import { HttpServer } from "effect/http";
import { HttpApiError, HttpApiTest } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { Api, forWorkspace } from "peal-contract";
import type { PostContent, PostSort } from "peal-contract";

import { PostDraftsHandlers } from "#publishing/api/post-drafts.ts";
import { PostsHandlers } from "#publishing/api/posts.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { memberOf } from "#test/channels/support.ts";
import { connect, onPostsServerAt } from "#test/publishing/posts-server.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// GET …/posts by change: `updatedAt`, `updatedSince` and the walk a sync
// makes with `sort=updatedAsc`, which holds back the last five seconds so
// a change is read late, maybe twice, never not at all.

const timeout = 120_000;

const start = "2026-06-15T07:00:00Z";

const text = (body: string): PostContent => ({
  media: [],
  overrides: [],
  text: body,
});

const studio = Effect.gen(function* studio() {
  const workspaceId = yield* newId(WorkspaceIdSchema);
  const mastodon = yield* connect(workspaceId, "mastodon");
  const member = memberOf(workspaceId, permissionsFor("editor"));

  const editor = yield* HttpApiTest.groups(Api, [
    "posts",
    "posts.drafts",
  ]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.merge(PostsHandlers, PostDraftsHandlers).pipe(
          Layer.provideMerge(securityTest(member))
        ),
        HttpServer.layerServices
      )
    )
  );

  const headers = forWorkspace(workspaceId);

  const draft = (body: string) =>
    editor["posts.drafts"].create({
      headers,
      payload: { channelIds: [mastodon], content: text(body) },
    });

  // Every post a walk reads, page after page, in its order.
  const walk = (
    sort: PostSort,
    limit: number,
    since?: DateTime.Utc
  ): Effect.Effect<{ ids: string[]; pages: number }, unknown> =>
    Effect.gen(function* walking() {
      const ids: string[] = [];
      let pages = 0;
      let cursor: string | undefined;

      do {
        const page = yield* editor.posts.list({
          headers,
          query: {
            limit,
            sort,
            ...(cursor === undefined ? {} : { cursor }),
            ...(since === undefined ? {} : { updatedSince: since }),
          },
        });

        ids.push(...page.items.map(({ id }) => id));
        pages += 1;
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);

      return { ids, pages };
    });

  return { draft, editor, headers, mastodon, walk, workspaceId };
});

const seconds = (count: number) => TestClock.adjust(Duration.seconds(count));

describe("a walk by change", () => {
  it.effect(
    "reads 2,500 posts changed at one instant once each, in 25 pages",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* manyAtOnce() {
          const { walk, workspaceId } = yield* studio;

          // As the migration leaves the rows from before it: one instant.
          yield* SqlClient.SqlClient.use(
            (sql) => sql`
              INSERT INTO publishing.posts (id, workspace_id, status, updated_at)
              SELECT
                ('01900000-0000-7000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
                ${workspaceId}::uuid,
                'draft',
                '2026-06-15T06:00:00Z'::timestamptz
              FROM generate_series(1, 2500) AS n
            `
          );

          const { ids, pages } = yield* walk("updatedAsc", 100);

          assert.strictEqual(pages, 25);
          assert.strictEqual(ids.length, 2500);
          assert.strictEqual(new Set(ids).size, 2500);

          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`DELETE FROM publishing.posts WHERE workspace_id = ${workspaceId}::uuid`
          );
        })
      ),
    timeout
  );

  it.effect(
    "reads a post changed during the walk again at its end, and skips none",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* changedMidway() {
          const { draft, editor, headers, mastodon } = yield* studio;

          // A second apart, so the walk's order is theirs.
          const one = yield* draft("One");

          yield* seconds(1);

          const two = yield* draft("Two");

          yield* seconds(1);

          const three = yield* draft("Three");

          yield* seconds(10);

          const first = yield* editor.posts.list({
            headers,
            query: { limit: 1, sort: "updatedAsc" },
          });

          assert.deepStrictEqual(
            first.items.map(({ id }) => id),
            [one.id]
          );

          // Changed once read: it moves to the end.
          const changed = yield* editor.posts.update({
            headers,
            params: { postId: one.id },
            payload: { channelIds: [mastodon], content: text("One, changed") },
          });

          assert.isTrue(
            DateTime.isGreaterThan(changed.updatedAt, one.updatedAt)
          );

          const rest = yield* editor.posts.list({
            headers,
            query: {
              cursor: first.nextCursor ?? "",
              limit: 10,
              sort: "updatedAsc",
            },
          });

          // Changed in the last seconds: held back for now.
          assert.deepStrictEqual(
            rest.items.map(({ id }) => id),
            [two.id, three.id]
          );
          assert.strictEqual(rest.nextCursor, null);

          yield* seconds(6);

          const again = yield* editor.posts.list({
            headers,
            query: {
              limit: 10,
              sort: "updatedAsc",
              updatedSince: three.updatedAt,
            },
          });

          assert.deepStrictEqual(
            again.items.map(({ id }) => id),
            [three.id, one.id]
          );
        })
      ),
    timeout
  );

  it.effect(
    "leaves a post changed two seconds ago off every page, until five have passed",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* settles() {
          const { draft, editor, headers } = yield* studio;

          const made = yield* draft("Just now");

          yield* seconds(2);

          const early = yield* editor.posts.list({
            headers,
            query: { sort: "updatedAsc" },
          });

          assert.deepStrictEqual(early.items, []);

          // The other orders hold nothing back.
          const latest = yield* editor.posts.list({
            headers,
            query: { sort: "updatedDesc" },
          });

          assert.deepStrictEqual(
            latest.items.map(({ id }) => id),
            [made.id]
          );

          yield* seconds(3);

          const settled = yield* editor.posts.list({
            headers,
            query: { sort: "updatedAsc" },
          });

          assert.deepStrictEqual(
            settled.items.map(({ id }) => id),
            [made.id]
          );
        })
      ),
    timeout
  );

  it.effect(
    "filters by updatedSince whatever the order",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* since() {
          const { draft, walk } = yield* studio;

          yield* draft("Before");
          yield* seconds(10);

          const after = yield* draft("After");

          yield* seconds(10);

          for (const sort of [
            "createdAsc",
            "createdDesc",
            "updatedAsc",
            "updatedDesc",
          ] as const) {
            const { ids } = yield* walk(sort, 5, after.updatedAt);

            assert.deepStrictEqual(ids, [after.id], sort);
          }

          // A list by time holds no draft, which has none.
          const { ids: timed } = yield* walk(
            "scheduledAsc",
            5,
            after.updatedAt
          );

          assert.deepStrictEqual(timed, []);
        })
      ),
    timeout
  );

  it.effect(
    "refuses a cursor of another order, and pages from one given before",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* cursors() {
          const { draft, editor, headers } = yield* studio;

          const older = yield* draft("Older");

          yield* seconds(1);

          const newer = yield* draft("Newer");

          yield* seconds(10);

          const byCreation = yield* editor.posts.list({
            headers,
            query: { limit: 1, sort: "createdDesc" },
          });

          const refused = yield* editor.posts
            .list({
              headers,
              query: {
                cursor: byCreation.nextCursor ?? "",
                sort: "updatedAsc",
              },
            })
            .pipe(Effect.flip);

          assert.instanceOf(refused, HttpApiError.BadRequest);

          // A cursor as a release before this one wrote it: no updatedAt.
          const before = Base64Url.encode(
            JSON.stringify({
              postId: newer.id,
              scheduledAt: null,
              sort: "createdDesc",
            })
          );

          const next = yield* editor.posts.list({
            headers,
            query: { cursor: before, sort: "createdDesc" },
          });

          assert.deepStrictEqual(
            next.items.map(({ id }) => id),
            [older.id]
          );

          // A post's answer says when it was made, from its id.
          assert.isTrue(
            DateTime.isLessThanOrEqualTo(older.createdAt, newer.createdAt)
          );
        })
      ),
    timeout
  );
});
