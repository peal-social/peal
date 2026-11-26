import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, PostExternalIdTaken, forWorkspace } from "peal-contract";
import type { Member, PostContent } from "peal-contract";

import { PostDraftsHandlers } from "#publishing/api/post-drafts.ts";
import { PostsHandlers } from "#publishing/api/posts.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { memberOf } from "#test/channels/support.ts";
import { utc } from "#test/publishing/infrastructure/harness.ts";
import { connect, onPostsServerAt } from "#test/publishing/posts-server.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// A post's own id, its caller's: unique in a workspace among posts that are
// not cancelled, given when a post is made, kept by a draft's update that
// says nothing of it, changed on any post, found again by the list, and
// never copied.

const timeout = 60_000;

const start = "2026-06-15T07:00:00Z";

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["posts", "posts.drafts"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.merge(PostsHandlers, PostDraftsHandlers).pipe(
          Layer.provideMerge(securityTest(member))
        ),
        HttpServer.layerServices
      )
    )
  );

const text = (body: string): PostContent => ({
  media: [],
  overrides: [],
  text: body,
});

const studio = Effect.gen(function* studio() {
  const workspaceId = yield* newId(WorkspaceIdSchema);
  const mastodon = yield* connect(workspaceId, "mastodon");

  const editor = yield* clientAs(
    memberOf(workspaceId, permissionsFor("editor"))
  );

  const headers = forWorkspace(workspaceId);

  // A post for the channel at a time of the day after `start`, with the
  // id given, if any.
  const send = (
    body: string,
    at: string,
    externalId?: string,
    channelIds: readonly [ChannelId, ...ChannelId[]] = [mastodon]
  ) => {
    const plain = {
      channelIds,
      content: text(body),
      when: {
        _tag: "at" as const,
        at: utc(at),
        timeZone: "Europe/Paris",
      },
    };

    return editor.posts.create({
      headers,
      payload: externalId === undefined ? plain : { ...plain, externalId },
      query: {},
    });
  };

  return { editor, headers, mastodon, send, workspaceId };
});

describe("a post's external id", () => {
  it.effect(
    "is answered with the post, and a second post with it is refused, naming the first",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* refusesTwice() {
          const { editor, headers, send } = yield* studio;

          const first = yield* send(
            "From record 42",
            "2026-06-16T08:00:00Z",
            "record-42"
          );

          assert.strictEqual(first.externalId, "record-42");

          const again = yield* send(
            "From record 42, a day later",
            "2026-06-17T08:00:00Z",
            "record-42"
          ).pipe(Effect.flip);

          assert.instanceOf(again, PostExternalIdTaken);
          assert.strictEqual(
            again instanceof PostExternalIdTaken ? again.postId : null,
            first.id
          );

          // Found again by the list, exactly.
          const found = yield* editor.posts.list({
            headers,
            query: { externalId: "record-42" },
          });

          assert.deepStrictEqual(
            found.items.map(({ id }) => id),
            [first.id]
          );

          const none = yield* editor.posts.list({
            headers,
            query: { externalId: "RECORD-42" },
          });

          assert.deepStrictEqual(none.items, []);
        })
      ),
    timeout
  );

  it.effect(
    "makes one post of two creations sent together with one id",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* together() {
          const { send } = yield* studio;

          const outcomes = yield* Effect.all(
            [
              send("One", "2026-06-16T08:00:00Z", "record-together").pipe(
                Effect.as("created"),
                Effect.catchTag("PostExternalIdTaken", () =>
                  Effect.succeed("taken")
                )
              ),
              send("Two", "2026-06-17T08:00:00Z", "record-together").pipe(
                Effect.as("created"),
                Effect.catchTag("PostExternalIdTaken", () =>
                  Effect.succeed("taken")
                )
              ),
            ],
            { concurrency: 2 }
          );

          assert.deepStrictEqual(outcomes.toSorted(), ["created", "taken"]);
        })
      ),
    timeout
  );

  it.effect(
    "is freed by a cancelled post and by a deleted draft",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* frees() {
          const { editor, headers, mastodon, send } = yield* studio;

          const first = yield* send(
            "First",
            "2026-06-16T08:00:00Z",
            "record-1"
          );

          yield* editor.posts.cancel({ headers, params: { postId: first.id } });

          const second = yield* send(
            "Second",
            "2026-06-17T08:00:00Z",
            "record-1"
          );

          assert.strictEqual(second.externalId, "record-1");

          // The list finds the post that has it, and the cancelled one
          // that had it.
          const found = yield* editor.posts.list({
            headers,
            query: { externalId: "record-1", sort: "createdAsc" },
          });

          assert.deepStrictEqual(
            found.items.map(({ id }) => id),
            [first.id, second.id]
          );

          const draft = yield* editor["posts.drafts"].create({
            headers,
            payload: {
              channelIds: [mastodon],
              content: text("A draft"),
              externalId: "record-2",
            },
          });

          yield* editor["posts.drafts"].delete({
            headers,
            params: { postId: draft.id },
          });

          const made = yield* send("Third", "2026-06-18T08:00:00Z", "record-2");

          assert.strictEqual(made.externalId, "record-2");
        })
      ),
    timeout
  );

  it.effect(
    "stays on a draft updated without it, and goes with null",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* keeps() {
          const { editor, headers, mastodon } = yield* studio;

          const draft = yield* editor["posts.drafts"].create({
            headers,
            payload: {
              channelIds: [mastodon],
              content: text("A draft"),
              externalId: "record-3",
            },
          });

          const kept = yield* editor.posts.update({
            headers,
            params: { postId: draft.id },
            payload: { channelIds: [mastodon], content: text("Changed") },
          });

          assert.strictEqual(kept.externalId, "record-3");

          const changed = yield* editor.posts.update({
            headers,
            params: { postId: draft.id },
            payload: {
              channelIds: [mastodon],
              content: text("Changed again"),
              externalId: "record-4",
            },
          });

          assert.strictEqual(changed.externalId, "record-4");

          const removed = yield* editor.posts.update({
            headers,
            params: { postId: draft.id },
            payload: {
              channelIds: [mastodon],
              content: text("Changed once more"),
              externalId: null,
            },
          });

          assert.strictEqual(removed.externalId, null);

          const read = yield* editor.posts.get({
            headers,
            params: { postId: draft.id },
          });

          assert.strictEqual(read.externalId, null);
        })
      ),
    timeout
  );

  it.effect(
    "changes on a post whatever its status, and is refused where another has it",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* changes() {
          const { editor, headers, send } = yield* studio;

          const first = yield* send("One", "2026-06-16T08:00:00Z");
          const second = yield* send("Two", "2026-06-17T08:00:00Z", "taken");

          yield* editor.posts.cancel({ headers, params: { postId: first.id } });

          const given = yield* editor.posts.setExternalId({
            headers,
            params: { postId: first.id },
            payload: { externalId: "record-5" },
          });

          assert.strictEqual(given.externalId, "record-5");
          assert.strictEqual(given.status, "cancelled");

          const refused = yield* editor.posts
            .setExternalId({
              headers,
              params: { postId: first.id },
              payload: { externalId: "taken" },
            })
            .pipe(Effect.flip);

          assert.instanceOf(refused, PostExternalIdTaken);

          // Given again to the post that has it, it changes nothing.
          const same = yield* editor.posts.setExternalId({
            headers,
            params: { postId: second.id },
            payload: { externalId: "taken" },
          });

          assert.strictEqual(same.externalId, "taken");

          const cleared = yield* editor.posts.setExternalId({
            headers,
            params: { postId: second.id },
            payload: { externalId: null },
          });

          assert.strictEqual(cleared.externalId, null);
        })
      ),
    timeout
  );

  it.effect(
    "answers the post under its idempotency key before it checks the id",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* replays() {
          const { editor, headers, mastodon } = yield* studio;

          const request = {
            headers: { ...headers, "idempotency-key": "synthetic-key-1" },
            payload: {
              channelIds: [mastodon],
              content: text("Keyed"),
              externalId: "record-6",
              when: {
                _tag: "at" as const,
                at: utc("2026-06-16T08:00:00Z"),
                timeZone: "Europe/Paris",
              },
            },
            query: {},
          };

          const first = yield* editor.posts.create(request);
          const replayed = yield* editor.posts.create(request);

          assert.strictEqual(replayed.id, first.id);
        })
      ),
    timeout
  );

  it.effect(
    "refuses a bulk item an earlier item took, and is checked by validate",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* bulk() {
          const { editor, headers, mastodon } = yield* studio;

          const item = (body: string, at: string) => ({
            channelIds: [mastodon],
            content: text(body),
            externalId: "record-7",
            when: {
              _tag: "at" as const,
              at: utc(at),
              timeZone: "Europe/Paris",
            },
          });

          const made = yield* editor.posts.bulk({
            headers,
            payload: {
              posts: [
                item("One", "2026-06-16T08:00:00Z"),
                item("Two", "2026-06-17T08:00:00Z"),
              ],
            },
          });

          const [created, refused] = made.items;

          assert.strictEqual(created?._tag, "created");
          assert.strictEqual(refused?._tag, "refused");
          assert.strictEqual(
            refused?._tag === "refused" ? refused.refusal._tag : null,
            "PostExternalIdTaken"
          );

          const checked = yield* editor.posts.validate({
            headers,
            payload: item("Three", "2026-06-18T08:00:00Z"),
          });

          assert.strictEqual(checked.valid, false);
          assert.strictEqual(
            checked.externalIdTakenBy,
            created?._tag === "created" ? created.post.id : "none"
          );
        })
      ),
    timeout
  );

  it.effect(
    "refuses an imported row whose id an earlier row gives, and makes nothing",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* imports() {
          const { editor, headers, mastodon } = yield* studio;

          const csv = [
            "text,channels,at,time_zone,external_id",
            `One,${mastodon},2026-06-16 10:00,Europe/Paris,row-1`,
            `Two,${mastodon},2026-06-17 10:00,Europe/Paris,row-1`,
          ].join("\n");

          const checked = yield* editor.posts.import({
            headers,
            payload: { csv, dryRun: true },
          });

          assert.deepStrictEqual(
            checked.rows.map(({ _tag }) => _tag),
            ["valid", "refused"]
          );

          const [, second] = checked.rows;

          assert.strictEqual(
            second?._tag === "refused" ? second.refusal._tag : null,
            "PostExternalIdTaken"
          );
          assert.include(
            second?._tag === "refused" ? (second.refusal.message ?? "") : "",
            "Row 1 of the file gives the same external_id"
          );

          const made = yield* editor.posts.import({
            headers,
            payload: { csv: csv.split("\n").slice(0, 2).join("\n") },
          });

          assert.strictEqual(made.created, 1);

          const [row] = made.rows;

          assert.strictEqual(
            row?._tag === "created" ? row.post.externalId : null,
            "row-1"
          );
        })
      ),
    timeout
  );

  it.effect(
    "is never copied",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* copies() {
          const { editor, headers, send } = yield* studio;

          const post = yield* send("One", "2026-06-16T08:00:00Z", "record-8");

          const copy = yield* editor.posts.duplicate({
            headers,
            params: { postId: post.id },
          });

          assert.strictEqual(copy.externalId, null);
        })
      ),
    timeout
  );
});
