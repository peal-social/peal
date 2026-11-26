import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Result } from "effect";
import { SqlClient } from "effect/sql";

import { PostRepository } from "#publishing/application/post-repository.ts";
import { emptyContent } from "#publishing/domain/post-content.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import {
  cancelTarget,
  createTarget,
  publishedBySite,
  startTarget,
  withSitePost,
} from "#publishing/domain/post-target.ts";
import { createDraft } from "#publishing/domain/post.ts";
import type { SitePost } from "#publishing/domain/site-post.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema, PostIdSchema } from "#shared/domain/ids.ts";
import type { PostId } from "#shared/domain/ids.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";

// The post a website holds for a target before it goes out is kept in
// the target's own columns (`platform_post_id`, `permalink`,
// `site_publish_at`), whatever the target's status until it is
// published, and a target the site published itself says so
// (`published_by_site`).

const StorageTest = DrizzlePostRepository.pipe(
  Layer.provideMerge(DatabaseTest)
);

const deletePost = (postId: PostId) =>
  SqlClient.SqlClient.use(
    (sql) => sql`DELETE FROM publishing.posts WHERE id = ${postId}`
  ).pipe(Effect.orDie);

const at = DateTime.makeUnsafe("2026-06-16T09:00:00Z");

const sitePost: SitePost = {
  permalink: "https://site.example/?p=7",
  platformPostId: PlatformPostIdSchema.make("7"),
  publishAt: at,
};

// A draft on a WordPress site, saved: its id and its one target.
const savedDraft = Effect.gen(function* savedDraft() {
  const posts = yield* PostRepository;
  const workspaceId = yield* freshWorkspace;
  const postId = yield* newId(PostIdSchema);

  const target = createTarget(
    yield* newId(PostTargetIdSchema),
    postId,
    yield* newId(ChannelIdSchema),
    Option.some(new WordPressOptions({ title: "A synthetic article" }))
  );

  yield* posts.insert(
    createDraft(postId, workspaceId, emptyContent, Option.none()),
    [target]
  );

  return { postId, target };
});

layer(StorageTest)("a target's post on its site", (it) => {
  it.effect(
    "is kept as the site answered, through every status until published",
    () =>
      Effect.gen(function* keeps() {
        const posts = yield* PostRepository;
        const sql = yield* SqlClient.SqlClient;
        const { postId, target } = yield* savedDraft;

        yield* Effect.gen(function* checks() {
          assert.isTrue(
            yield* posts.setSitePost(target.id, Option.some(sitePost))
          );

          const [held] = yield* posts.targets(postId);

          assert(held !== undefined);
          assert.deepStrictEqual(held.onSite, sitePost);

          // A cancel keeps it: a removal needs it.
          const cancelled = Result.getOrThrow(cancelTarget(held, at));

          assert.isTrue(yield* posts.updateTarget(cancelled, held));

          const [kept] = yield* posts.targets(postId);

          assert.deepStrictEqual(kept, cancelled);
          assert.deepStrictEqual(kept?.onSite, sitePost);

          // The site took it off.
          assert.isTrue(yield* posts.setSitePost(target.id, Option.none()));

          const [gone] = yield* posts.targets(postId);

          assert.isUndefined(gone?.onSite);

          const [row] = yield* sql<{
            readonly platform_post_id: string | null;
            readonly site_publish_at: Date | null;
          }>`SELECT platform_post_id, site_publish_at FROM publishing.post_targets WHERE id = ${target.id}`;

          assert.deepStrictEqual(row, {
            platform_post_id: null,
            site_publish_at: null,
          });
        }).pipe(Effect.ensuring(deletePost(postId)));
      })
  );

  it.effect("published by the site, says so, and is never written over", () =>
    Effect.gen(function* published() {
      const posts = yield* PostRepository;
      const { postId, target } = yield* savedDraft;

      yield* Effect.gen(function* checks() {
        const held = withSitePost(target, Option.some(sitePost));

        assert.isTrue(yield* posts.updateTarget(held, target));

        const started = Result.getOrThrow(startTarget(held, at));

        assert.isTrue(yield* posts.updateTarget(started, held));

        const [publishing] = yield* posts.targets(postId);

        assert.deepStrictEqual(publishing?.onSite, sitePost);

        const bySite = Result.getOrThrow(publishedBySite(started));

        assert.isTrue(yield* posts.updateTarget(bySite, started));

        const [stored] = yield* posts.targets(postId);

        assert.deepStrictEqual(stored, bySite);
        assert(stored?.status._tag === "published");
        assert.isTrue(stored.status.bySite);
        assert.isUndefined(stored.onSite);

        // A call answered late finds it out: nothing is changed.
        assert.isFalse(
          yield* posts.setSitePost(target.id, Option.some(sitePost))
        );
        assert.deepStrictEqual(yield* posts.targets(postId), [bySite]);
      }).pipe(Effect.ensuring(deletePost(postId)));
    })
  );

  it.effect("is nothing on a row written before sites held posts", () =>
    Effect.gen(function* older() {
      const posts = yield* PostRepository;
      const sql = yield* SqlClient.SqlClient;
      const { postId, target } = yield* savedDraft;

      yield* Effect.gen(function* checks() {
        // The release before wrote a published row with no new column set.
        yield* sql`UPDATE publishing.post_targets SET status = 'published', platform_post_id = '9', finished_at = now() WHERE id = ${target.id}`;

        const [stored] = yield* posts.targets(postId);

        assert(stored?.status._tag === "published");
        assert.isUndefined(stored.status.bySite);
        assert.isUndefined(stored.onSite);
      }).pipe(Effect.ensuring(deletePost(postId)));
    })
  );

  it.effect("counts each hand-over of the target, from one", () =>
    Effect.gen(function* counts() {
      const posts = yield* PostRepository;
      const { postId, target } = yield* savedDraft;

      yield* Effect.gen(function* checks() {
        assert.strictEqual(yield* posts.nextHandOver(target.id), 1);
        assert.strictEqual(yield* posts.nextHandOver(target.id), 2);
        // Nothing else of the target changes.
        assert.deepStrictEqual(yield* posts.targets(postId), [target]);
      }).pipe(Effect.ensuring(deletePost(postId)));
    })
  );

  it.effect("is not a post a target loses when it is gone", () =>
    Effect.gen(function* gone() {
      const posts = yield* PostRepository;
      const { postId, target } = yield* savedDraft;

      yield* deletePost(postId);

      assert.isFalse(
        yield* posts.setSitePost(target.id, Option.some(sitePost))
      );
    })
  );
});
