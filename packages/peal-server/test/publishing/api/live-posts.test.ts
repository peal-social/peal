import { assert, describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";
import {
  Api,
  LivePostNotChangeable,
  PostContentInvalid,
  PostNotFound,
  UnknownMedia,
  forWorkspace,
} from "peal-contract";
import type { ChannelOptions, Member, Permission } from "peal-contract";

import { PostsHandlers } from "#publishing/api/posts.ts";
import { livePostChangePermission } from "#publishing/domain/live-post-change.ts";
import { refused as forbiddenFor } from "#shared/api/forbidden.ts";
import { newId } from "#shared/application/ids.ts";
import { PostIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { FakeRemovals } from "#test/publishing/fakes/fake-live-post-clients.ts";
import {
  eventually,
  isFinished,
} from "#test/publishing/infrastructure/harness.ts";
import { connect, onPostsServerAt } from "#test/publishing/posts-server.ts";
import { securityTest } from "#workspace/api/security.ts";
import { withheldWhileImpersonating } from "#workspace/domain/membership.ts";
import { publishingPermissions } from "#workspace/domain/oauth-grant.ts";
import { partnerKeyPermissions } from "#workspace/domain/partner-key.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";
import type { Role } from "#workspace/domain/roles.ts";

// The endpoints that unpublish a live post, on the in-memory cluster: a
// fake platform publishes, another deletes.

const timeout = 60_000;

const start = "2026-07-01T08:00:00Z";

const freshId = newId(WorkspaceIdSchema);

const clientWith = (
  userId: string,
  workspaceId: WorkspaceId,
  permissions: readonly Permission[]
) => {
  const member: Member = {
    permissions,
    principal: { _tag: "user", impersonatedBy: null, userId },
    workspaceId,
  };

  return HttpApiTest.groups(Api, ["posts"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        PostsHandlers.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );
};

const clientAs = (userId: string, workspaceId: WorkspaceId, role: Role) =>
  clientWith(userId, workspaceId, permissionsFor(role));

// A post sent now on `channels`, once it went out.
const sentOn = Effect.fn("test.sentOn")(function* sentOn(
  client: Effect.Success<ReturnType<typeof clientAs>>,
  workspaceId: WorkspaceId,
  channelIds: readonly string[],
  text: string,
  options: readonly ChannelOptions[] = []
) {
  const post = yield* client.posts.create({
    headers: { ...forWorkspace(workspaceId) },

    payload: {
      channelIds: [...channelIds],
      content: { media: [], overrides: [], text },
      options: [...options],
      when: { _tag: "now" },
    },
    query: {},
  });

  yield* eventually(
    "the post went out",
    isFinished(PostIdSchema.make(post.id))
  );

  return yield* client.posts.get({
    headers: forWorkspace(workspaceId),
    params: { postId: post.id },
  });
});

describe("who may unpublish", () => {
  it("is who may publish: owners, admins and editors", () => {
    expect(livePostChangePermission).toBe("post:publish");
    expect(
      (["owner", "admin", "editor", "contributor", "viewer"] as const).filter(
        (role) => permissionsFor(role).includes(livePostChangePermission)
      )
    ).toStrictEqual(["owner", "admin", "editor"]);
  });

  it("takes workspace:publish of an OAuth client, and is withheld while staff act as a member", () => {
    expect(publishingPermissions.has(livePostChangePermission)).toBeTruthy();
    expect(
      withheldWhileImpersonating.has(livePostChangePermission)
    ).toBeTruthy();
    // A partner's key may be given it.
    expect(partnerKeyPermissions).toContain(livePostChangePermission);
  });
});

describe("the unpublishing endpoints", () => {
  it.effect(
    "unpublish a channel, list the changes, and show the target removed",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* unpublishes() {
          const workspaceId = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
          const viewer = yield* clientAs(yield* freshId, workspaceId, "viewer");

          const contributor = yield* clientAs(
            yield* freshId,
            workspaceId,
            "contributor"
          );

          const mastodon = yield* connect(workspaceId, "mastodon");
          const sent = yield* sentOn(editor, workspaceId, [mastodon], "Live");
          const [target] = sent.targets;

          assert(target !== undefined);
          assert.strictEqual(target.removedAt, null);

          const params = { postId: sent.id, targetId: target.id };

          assert.deepStrictEqual(
            yield* Effect.all([
              viewer.posts
                .unpublishTarget({
                  headers: forWorkspace(workspaceId),
                  params,
                  query: {},
                })
                .pipe(Effect.flip),
              contributor.posts
                .unpublishTarget({
                  headers: forWorkspace(workspaceId),
                  params,
                  query: {},
                })
                .pipe(Effect.flip),
              contributor.posts
                .unpublish({
                  headers: forWorkspace(workspaceId),
                  params: { postId: sent.id },
                })
                .pipe(Effect.flip),
            ]),
            [
              forbiddenFor("missingPermission", "post:publish"),
              forbiddenFor("missingPermission", "post:publish"),
              forbiddenFor("missingPermission", "post:publish"),
            ]
          );

          // Another workspace finds nothing of it.
          const stranger = yield* clientAs(
            yield* freshId,
            yield* freshId,
            "editor"
          );

          assert.deepStrictEqual(
            yield* stranger.posts
              .unpublishTarget({
                headers: forWorkspace(yield* freshId),
                params: { ...params },
                query: {},
              })
              .pipe(Effect.flip),
            new PostNotFound()
          );

          const change = yield* editor.posts.unpublishTarget({
            headers: forWorkspace(workspaceId),
            params,
            query: {},
          });

          assert.strictEqual(change.kind, "unpublish");
          assert.strictEqual(change.targetId, target.id);
          assert.strictEqual(change.partsLeft, 1);

          yield* eventually(
            "the change is done",
            viewer.posts
              .changes({
                headers: forWorkspace(workspaceId),
                params: { postId: sent.id },
              })
              .pipe(
                Effect.map(({ items }) =>
                  items.some(({ status }) => status === "done")
                )
              )
          );

          const { items } = yield* viewer.posts.changes({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id },
          });

          assert.deepStrictEqual(
            items.map(({ code, id, partsLeft, status }) => [
              id,
              status,
              partsLeft,
              code,
            ]),
            [[change.id, "done", 0, null]]
          );

          const after = yield* viewer.posts.get({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id },
          });

          assert.strictEqual(after.targets[0]?.status, "published");
          assert.isNotNull(after.targets[0]?.removedAt ?? null);
          assert.strictEqual(after.targets[0]?.permalink, target.permalink);

          assert.deepStrictEqual(
            yield* editor.posts
              .unpublishTarget({
                headers: forWorkspace(workspaceId),
                params,
                query: {},
              })
              .pipe(Effect.flip),
            new LivePostNotChangeable({ reason: "alreadyRemoved" })
          );

          // Found among the removed posts, and not among the others.
          const removed = yield* viewer.posts.list({
            headers: forWorkspace(workspaceId),
            query: { removed: "true" },
          });

          const kept = yield* viewer.posts.list({
            headers: forWorkspace(workspaceId),
            query: { removed: "false" },
          });

          assert.deepStrictEqual(
            removed.items.map(({ id }) => id),
            [sent.id]
          );
          assert.deepStrictEqual(kept.items, []);
        })
      ),
    timeout
  );

  it.effect(
    "unpublish a whole post channel by channel, and wait for a change",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* whole() {
          const workspaceId = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
          const mastodon = yield* connect(workspaceId, "mastodon");
          const threads = yield* connect(workspaceId, "threads");

          const sent = yield* sentOn(
            editor,
            workspaceId,
            [mastodon, threads],
            "On two channels"
          );

          const onMastodon = sent.targets.find(
            ({ channelId }) => channelId === mastodon
          );

          const onThreads = sent.targets.find(
            ({ channelId }) => channelId === threads
          );

          assert(onMastodon !== undefined && onThreads !== undefined);

          // The deletion answers only when the test lets it.
          yield* FakeRemovals.use((removals) =>
            removals.script(mastodon, [{ _tag: "hang" }])
          );

          const asked = yield* editor.posts.unpublish({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id },
          });

          assert.deepStrictEqual(
            asked.changes.map(({ status, targetId }) => [targetId, status]),
            [[onMastodon.id, "pending"]]
          );
          assert.deepStrictEqual(asked.refused, [
            { reason: "notSupported", targetId: onThreads.id },
          ]);

          // Asked again while it is pending, with a wait: refused at once.
          assert.deepStrictEqual(
            yield* editor.posts
              .unpublishTarget({
                headers: forWorkspace(workspaceId),
                params: {
                  postId: sent.id,
                  targetId: onMastodon.id,
                },
                query: { wait: 30 },
              })
              .pipe(Effect.flip),
            new LivePostNotChangeable({ reason: "changeInProgress" })
          );

          yield* FakeRemovals.use((removals) => removals.release(mastodon));

          // A wait on a change already done answers it as it is.
          yield* eventually(
            "the change is done",
            editor.posts
              .changes({
                headers: forWorkspace(workspaceId),
                params: { postId: sent.id },
              })
              .pipe(
                Effect.map(({ items }) =>
                  items.every(({ status }) => status === "done")
                )
              )
          );
        })
      ),
    timeout
  );

  it.effect("answer a change once it ended, within the wait", () =>
    onPostsServerAt(
      start,
      Effect.gen(function* waits() {
        const workspaceId = yield* freshId;
        const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
        const mastodon = yield* connect(workspaceId, "mastodon");
        const sent = yield* sentOn(editor, workspaceId, [mastodon], "Waited");
        const [target] = sent.targets;

        assert(target !== undefined);

        const waiting = yield* editor.posts
          .unpublishTarget({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id, targetId: target.id },
            query: { wait: 30 },
          })
          .pipe(Effect.forkChild);

        for (
          let round = 0;
          round < 100 && waiting.pollUnsafe() === undefined;
          round += 1
        ) {
          yield* TestClock.adjust(Duration.millis(500));
          yield* TestClock.withLive(Effect.sleep(Duration.millis(20)));
        }

        const change = yield* Fiber.join(waiting);

        assert.strictEqual(change.status, "done");
        assert.strictEqual(change.partsLeft, 0);
      })
    )
  );
});

describe("the editing endpoint", () => {
  it.effect(
    "edits a channel's text, refuses who may not and what does not fit, and shows the target edited",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* edits() {
          const workspaceId = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
          const viewer = yield* clientAs(yield* freshId, workspaceId, "viewer");

          const contributor = yield* clientAs(
            yield* freshId,
            workspaceId,
            "contributor"
          );

          const mastodon = yield* connect(workspaceId, "mastodon");
          const other = yield* connect(workspaceId, "mastodon");
          const bluesky = yield* connect(workspaceId, "bluesky");

          const sent = yield* sentOn(
            editor,
            workspaceId,
            [mastodon, other, bluesky],
            "Live with a typo"
          );

          const on = (channelId: string) => {
            const found = sent.targets.find(
              (target) => target.channelId === channelId
            );

            assert(found !== undefined);

            return {
              postId: sent.id,
              targetId: found.id,
              workspaceId,
            };
          };

          assert.strictEqual(sent.targets[0]?.editedAt, null);

          const fix = { text: "Live, corrected" };

          assert.deepStrictEqual(
            yield* Effect.all([
              viewer.posts
                .editTarget({
                  headers: forWorkspace(workspaceId),
                  params: on(mastodon),
                  payload: fix,
                  query: {},
                })
                .pipe(Effect.flip),
              contributor.posts
                .editTarget({
                  headers: forWorkspace(workspaceId),
                  params: on(mastodon),
                  payload: fix,
                  query: {},
                })
                .pipe(Effect.flip),
            ]),
            [
              forbiddenFor("missingPermission", "post:publish"),
              forbiddenFor("missingPermission", "post:publish"),
            ]
          );

          assert.deepStrictEqual(
            yield* editor.posts
              .editTarget({
                headers: forWorkspace(workspaceId),
                params: on(bluesky),
                payload: fix,
                query: {},
              })
              .pipe(Effect.flip),
            new LivePostNotChangeable({ reason: "notSupported" })
          );

          const tooLong = yield* editor.posts
            .editTarget({
              headers: forWorkspace(workspaceId),
              params: on(mastodon),
              payload: { text: "x".repeat(501) },
              query: {},
            })
            .pipe(Effect.flip);

          assert.isTrue(
            tooLong instanceof PostContentInvalid &&
              tooLong.violations.map(({ _tag }) => _tag).join(",") ===
                "textTooLong"
          );

          const change = yield* editor.posts.editTarget({
            headers: forWorkspace(workspaceId),
            params: on(mastodon),
            payload: { part: 0, text: "Live, corrected" },
            query: {},
          });

          assert.strictEqual(change.kind, "edit");
          assert.strictEqual(change.partsLeft, 1);
          assert.notProperty(change, "text");

          yield* eventually(
            "the edit is done",
            viewer.posts
              .changes({
                headers: forWorkspace(workspaceId),
                params: { postId: sent.id },
              })
              .pipe(
                Effect.map(({ items }) =>
                  items.some(({ status }) => status === "done")
                )
              )
          );

          const after = yield* viewer.posts.get({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id },
          });

          const edited = after.targets.find(
            ({ channelId }) => channelId === mastodon
          );

          assert.isNotNull(edited?.editedAt ?? null);
          assert.strictEqual(edited?.status, "published");
          assert.strictEqual(
            after.targets.find(({ channelId }) => channelId === other)
              ?.editedAt,
            null
          );
          assert.deepStrictEqual(after.content.overrides, [
            { channelId: mastodon, text: "Live, corrected" },
          ]);
          assert.strictEqual(after.content.text, "Live with a typo");
        })
      ),
    timeout
  );

  it.effect(
    "names a rich text off the allow-list, and one a social network does not take",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* rich() {
          const workspaceId = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
          const mastodon = yield* connect(workspaceId, "mastodon");
          const sent = yield* sentOn(editor, workspaceId, [mastodon], "Live");
          const [target] = sent.targets;

          assert(target !== undefined);

          const edit = (body: { readonly content: readonly unknown[] }) =>
            editor.posts
              .editTarget({
                headers: forWorkspace(workspaceId),
                params: { postId: sent.id, targetId: target.id },
                payload: { body: { content: body.content, type: "doc" } },
                query: {},
              })
              .pipe(Effect.flip);

          const offList = yield* edit({ content: [{ type: "script" }] });

          const notTaken = yield* edit({
            content: [
              { content: [{ text: "Rich", type: "text" }], type: "paragraph" },
            ],
          });

          assert.isTrue(offList instanceof PostContentInvalid);
          assert.isTrue(notTaken instanceof PostContentInvalid);
          assert.deepStrictEqual(
            offList instanceof PostContentInvalid ? offList.violations : [],
            [{ _tag: "bodyInvalid", channelId: mastodon }]
          );
          assert.deepStrictEqual(
            notTaken instanceof PostContentInvalid
              ? notTaken.violations.map(({ _tag }) => _tag)
              : [],
            ["bodyNotTaken"]
          );
        })
      ),
    timeout
  );

  it.effect(
    "edits a website's options, and answers a file not the workspace's as UnknownMedia",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* website() {
          const workspaceId = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");
          const wordpress = yield* connect(workspaceId, "wordpress");

          const sent = yield* sentOn(
            editor,
            workspaceId,
            [wordpress],
            "Live on the site",
            [
              {
                channelId: wordpress,
                options: { platform: "wordpress", title: "Before" },
              },
            ]
          );

          const [target] = sent.targets;

          assert(target !== undefined);

          const params = { postId: sent.id, targetId: target.id };

          const unknown = yield* editor.posts
            .editTarget({
              headers: forWorkspace(workspaceId),
              params,
              payload: {
                options: {
                  coverMediaId: "00000000-0000-7000-8000-00000000a0fd",
                  platform: "wordpress",
                  title: "With a cover",
                },
              },
              query: {},
            })
            .pipe(Effect.flip);

          assert.instanceOf(unknown, UnknownMedia);

          const change = yield* editor.posts.editTarget({
            headers: forWorkspace(workspaceId),
            params,
            payload: { options: { platform: "wordpress", title: "After" } },
            query: {},
          });

          assert.strictEqual(change.kind, "edit");

          yield* eventually(
            "the edit is done",
            editor.posts
              .changes({
                headers: forWorkspace(workspaceId),
                params: { postId: sent.id },
              })
              .pipe(
                Effect.map(({ items }) =>
                  items.some(({ status }) => status === "done")
                )
              )
          );

          const after = yield* editor.posts.get({
            headers: forWorkspace(workspaceId),
            params: { postId: sent.id },
          });

          assert.deepStrictEqual(after.targets[0]?.options, {
            platform: "wordpress",
            title: "After",
          });
          assert.notStrictEqual(after.targets[0]?.editedAt ?? null, null);
        })
      ),
    timeout
  );

  it.effect(
    "finds no target of another post, nor a post of another workspace",
    () =>
      onPostsServerAt(
        start,
        Effect.gen(function* scoped() {
          const workspaceId = yield* freshId;
          const elsewhere = yield* freshId;
          const editor = yield* clientAs(yield* freshId, workspaceId, "editor");

          const stranger = yield* clientAs(yield* freshId, elsewhere, "editor");

          const mastodon = yield* connect(workspaceId, "mastodon");
          const first = yield* sentOn(editor, workspaceId, [mastodon], "First");

          const second = yield* sentOn(
            editor,
            workspaceId,
            [mastodon],
            "Second"
          );

          const [ofSecond] = second.targets;

          assert(ofSecond !== undefined);

          const fix = { text: "Corrected" };

          const otherPost = yield* editor.posts
            .editTarget({
              headers: forWorkspace(workspaceId),
              params: { postId: first.id, targetId: ofSecond.id },
              payload: fix,
              query: {},
            })
            .pipe(Effect.flip);

          const otherWorkspace = yield* stranger.posts
            .editTarget({
              headers: forWorkspace(elsewhere),
              params: {
                postId: second.id,
                targetId: ofSecond.id,
              },
              payload: fix,
              query: {},
            })
            .pipe(Effect.flip);

          assert.instanceOf(otherPost, PostNotFound);
          assert.instanceOf(otherWorkspace, PostNotFound);

          const changes = yield* editor.posts.changes({
            headers: forWorkspace(workspaceId),
            params: { postId: second.id },
          });

          assert.lengthOf(changes.items, 0);
        })
      ),
    timeout
  );
});
