import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assert, describe, it, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { PostRepository } from "#publishing/application/post-repository.ts";
import { ExecutionIdSchema } from "#publishing/application/publication-scheduler.ts";
import { QueueStore } from "#publishing/application/queue-store.ts";
import { TagStore } from "#publishing/application/tag-store.ts";
import { WorkspacePostStore } from "#publishing/application/workspace-post-store.ts";
import { PostContent } from "#publishing/domain/post-content.ts";
import { PostExternalIdSchema } from "#publishing/domain/post-external-id.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import { createTarget, startTarget } from "#publishing/domain/post-target.ts";
import {
  createDraft,
  editDraft,
  withExternalId,
} from "#publishing/domain/post.ts";
import { QueueIdSchema } from "#publishing/domain/queue-id.ts";
import { TagIdSchema } from "#publishing/domain/tag-id.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { DrizzleQueueStore } from "#publishing/infrastructure/drizzle-queue-store.ts";
import { DrizzleTagStore } from "#publishing/infrastructure/drizzle-tag-store.ts";
import { DrizzleWorkspacePostStore } from "#publishing/infrastructure/drizzle-workspace-post-store.ts";
import { newId } from "#shared/application/ids.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  UserIdSchema,
} from "#shared/domain/ids.ts";
import type { PostId } from "#shared/domain/ids.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";

// When a post last changed (`posts.updated_at`): every statement that
// writes a column a post's answer shows, its targets' included, moves it
// forward, never back; those that write what no answer shows leave it.

const StorageTest = Layer.mergeAll(
  DrizzlePostRepository,
  DrizzleQueueStore,
  DrizzleTagStore,
  DrizzleWorkspacePostStore
).pipe(Layer.provideMerge(DatabaseTest));

// A column of the post written by hand, as an earlier write would have.
const writeRow = (postId: PostId, column: string, value: string) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`UPDATE publishing.posts SET ${sql(column)} = ${value} WHERE id = ${postId}`
  ).pipe(Effect.orDie);

const publishTargetByHand = (postId: PostId) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`UPDATE publishing.post_targets SET status = 'published', finished_at = '1970-01-01T00:00:01Z', platform_post_id = 'synthetic-1' WHERE post_id = ${postId}`
  ).pipe(Effect.orDie);

const source = path.join(import.meta.dirname, "..", "..", "..", "src");

// Each statement that writes `posts` or a post's targets, by file and by
// kind, as many as the file has: those that move the post, and those that
// do not, each with its reason. A statement in neither fails the test.
const writes = {
  "publishing/infrastructure/drizzle-content-fingerprints.ts": {
    moving: 0,
    // The content digest: no answer shows it.
    still: ["update(postTargets): the content digest"],
  },
  "publishing/infrastructure/drizzle-post-repository.ts": {
    // amendText, setExternalId, setTags, update; markEdited, markRemoved,
    // updateTarget; setTargets' delete and insert.
    moving: 9,
    still: [
      "update(posts): setExecution, the job's id, which no answer shows",
      "update(postTargets): markFirstComment, which no answer shows",
      "insert(postTargets): insert, with its post, whose own insert sets updated_at",
    ],
  },
  "publishing/infrastructure/drizzle-queue-store.ts": {
    // A queue deleted takes itself off its posts.
    moving: 1,
    still: [],
  },
  "publishing/infrastructure/drizzle-tag-store.ts": {
    // A tag deleted takes itself off its posts.
    moving: 1,
    still: [],
  },
  "publishing/infrastructure/drizzle-workspace-post-store.ts": {
    // A closed account's authorship and scheduling cleared.
    moving: 2,
    still: [],
  },
  "publishing/infrastructure/post-updates.ts": {
    // movePosts itself.
    moving: 1,
    still: [],
  },
} satisfies Readonly<
  Record<string, { readonly moving: number; readonly still: readonly string[] }>
>;

const statement =
  /\.(?:update\((?:posts|postTargets)\)|insert\(postTargets\)|delete\(postTargets\))/gu;

// A statement moves the post when what follows it, to the end of the
// write it is part of, sets `moved` or calls `movePosts`.
const movesPost = (text: string, at: number): boolean => {
  const after = text.slice(at, at + 1200);
  const end = after.search(/\n {6}[a-zA-Z]+: \(|\n {4}const |\n {4}return /u);
  const write = end === -1 ? after : after.slice(0, end);

  return write.includes("moved(") || write.includes("movePosts(");
};

const filesUnder = async (folder: string): Promise<string[]> => {
  const entries = await readdir(folder, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        return await filesUnder(full);
      }

      return full.endsWith(".ts") ? [full] : [];
    })
  );

  return nested.flat();
};

describe("the statements that write posts", () => {
  it("move updated_at, or say why not", async () => {
    const files = await filesUnder(source);

    const texts = await Promise.all(
      files.map(async (file) => await readFile(file, "utf-8"))
    );

    const found: Record<string, { moving: number; still: number }> = {};

    for (const [index, file] of files.entries()) {
      const text = texts[index] ?? "";
      const relative = path.relative(source, file).split(path.sep).join("/");

      for (const match of text.matchAll(statement)) {
        const counted = found[relative] ?? { moving: 0, still: 0 };

        found[relative] = movesPost(text, match.index)
          ? { ...counted, moving: counted.moving + 1 }
          : { ...counted, still: counted.still + 1 };
      }
    }

    assert.deepStrictEqual(
      found,
      Object.fromEntries(
        Object.entries(writes).map(([file, { moving, still }]) => [
          file,
          { moving, still: still.length },
        ])
      ),
      "A statement that writes posts or post_targets is in neither list: move updated_at through post-updates.ts, or list it with its reason"
    );
  });
});

// Writing a target moves its post's row, so whoever locks a target has
// locked its post first, as every use case does: one that locked the
// target alone would wait on the post a cancel holds while the cancel waits
// on the target. A `lockTarget` must come after `.lock(` or
// `lockInWorkspace(` in the function that holds it.
describe("the use cases that lock a target", () => {
  it("lock its post first", async () => {
    const folder = path.join(source, "publishing", "application");
    const files = await filesUnder(folder);

    const texts = await Promise.all(
      files.map(async (file) => await readFile(file, "utf-8"))
    );

    const alone: string[] = [];

    for (const [index, file] of files.entries()) {
      const text = texts[index] ?? "";

      for (const match of text.matchAll(/lockTarget\(/gu)) {
        const before = text.slice(0, match.index);
        const scope = before.slice(before.lastIndexOf("function*"));

        if (!/\.lock\(|lockInWorkspace\(/u.test(scope)) {
          alone.push(`${path.relative(source, file)}:${String(match.index)}`);
        }
      }
    }

    assert.deepStrictEqual(alone, []);
  });
});

const at = (instant: string) => DateTime.makeUnsafe(instant);

const content = (text: string) =>
  new PostContent({ media: [], overrides: [], text });

const updatedAtOf = (postId: PostId) =>
  PostRepository.use((posts) => posts.current([postId])).pipe(
    Effect.map((known) =>
      Option.fromUndefinedOr(known.get(postId)).pipe(
        Option.map(({ updatedAt }) => DateTime.formatIso(updatedAt)),
        Option.getOrElse(() => "gone")
      )
    )
  );

// A draft on one channel, inserted at `instant`.
const draftAt = (instant: string) =>
  Effect.gen(function* drafting() {
    yield* TestClock.setTime(DateTime.toEpochMillis(at(instant)));

    const posts = yield* PostRepository;
    const workspaceId = yield* freshWorkspace;
    const postId = yield* newId(PostIdSchema);
    const channelId = yield* newId(ChannelIdSchema);
    const targetId = yield* newId(PostTargetIdSchema);

    const post = createDraft(
      postId,
      workspaceId,
      content("A synthetic draft"),
      Option.none()
    );

    const target = createTarget(targetId, postId, channelId);

    yield* posts.insert(post, [target]);

    return { post, postId, target };
  });

// Virtual time stays near the epoch, where the test clock starts: a jump of
// years would wake the pool's timers for every second of them.
layer(StorageTest)("a post's updated_at", (storage) => {
  storage.effect("is the insert's instant, then each write's", () =>
    Effect.gen(function* moving() {
      const posts = yield* PostRepository;

      const { post, postId, target } = yield* draftAt(
        "1970-01-01T00:01:00.000Z"
      );

      assert.strictEqual(
        yield* updatedAtOf(postId),
        "1970-01-01T00:01:00.000Z"
      );

      // What no answer shows leaves it.
      yield* TestClock.setTime(
        DateTime.toEpochMillis(at("1970-01-01T00:02:00.000Z"))
      );
      yield* posts.setExecution(post, ExecutionIdSchema.make("synthetic"));
      yield* posts.markFirstComment(target.id);

      assert.strictEqual(
        yield* updatedAtOf(postId),
        "1970-01-01T00:01:00.000Z"
      );

      // Each write that shows moves it, twice in one millisecond too.
      const steps = [
        posts.update(
          yield* Effect.fromResult(editDraft(post, content("Changed"))),
          post
        ),
        posts.setTags(postId, []),
        posts.setExternalId(
          postId,
          Option.some(PostExternalIdSchema.make("record-1"))
        ),
        posts.amendText(postId, 0, target.channelId, "Own text"),
        posts.setTargets(postId, [target]),
        posts.updateTarget(
          yield* Effect.fromResult(
            startTarget(target, at("1970-01-01T00:02:30.000Z"))
          ),
          target
        ),
      ];

      const seen: string[] = [];

      for (const step of steps) {
        yield* step;
        seen.push(yield* updatedAtOf(postId));
      }

      // From the write's instant (plus what each statement spent before
      // it wrote, a few milliseconds at most), each a millisecond past the
      // one before at least, though the clock stood still.
      assert.isTrue(
        seen.every((each) => each.startsWith("1970-01-01T00:02:00."))
      );
      assert.deepStrictEqual(seen, [...seen].toSorted());
      assert.strictEqual(new Set(seen).size, seen.length);

      // A write whose clock is behind the row still moves it forward.
      yield* TestClock.setTime(
        DateTime.toEpochMillis(at("1970-01-01T00:00:30.000Z"))
      );
      yield* posts.setTags(postId, []);

      const behind = yield* updatedAtOf(postId);

      assert.isTrue(behind > (seen.at(-1) ?? ""));

      yield* posts.remove(postId);
    })
  );

  storage.effect(
    "moves with a live target's edit and removal, a queue or a tag deleted, and an author cleared",
    () =>
      Effect.gen(function* storeWrites() {
        const posts = yield* PostRepository;

        const { post, postId, target } = yield* draftAt(
          "1970-01-01T00:04:00.000Z"
        );

        const queueId = yield* newId(QueueIdSchema);
        const tagId = yield* newId(TagIdSchema);

        const userId = UserIdSchema.make(
          "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"
        );

        yield* publishTargetByHand(postId);
        yield* writeRow(postId, "queue_id", queueId);
        yield* writeRow(postId, "author_id", userId);
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`UPDATE publishing.posts SET tag_ids = ARRAY[${tagId}]::uuid[] WHERE id = ${postId}`
        ).pipe(Effect.orDie);

        const steps = [
          posts.markEdited(target.id, at("1970-01-01T00:04:01.000Z")),
          posts.markRemoved(target.id, at("1970-01-01T00:04:01.000Z")),
          QueueStore.use((queues) => queues.remove(post.workspaceId, queueId)),
          TagStore.use((tags) => tags.remove(post.workspaceId, tagId)),
          WorkspacePostStore.use((store) => store.clearAuthor(userId)),
        ];

        let before = yield* updatedAtOf(postId);

        for (const step of steps) {
          yield* step;

          const after = yield* updatedAtOf(postId);

          assert.isTrue(after > before, `${before} then ${after}`);
          before = after;
        }

        yield* posts.remove(postId);
      })
  );

  storage.effect(
    "gives an external id claimed by two transactions at once to one post",
    () =>
      Effect.gen(function* together() {
        const posts = yield* PostRepository;
        const sql = yield* SqlClient.SqlClient;
        const first = yield* draftAt("1970-01-01T00:05:00.000Z");
        const externalId = PostExternalIdSchema.make("record-together");
        const { workspaceId } = first.post;
        const second = yield* newId(PostIdSchema);

        // Each claims the id, then gives it to its own post.
        const claim = (postId: PostId, make: boolean) =>
          sql.withTransaction(
            Effect.gen(function* claiming() {
              const holder = yield* posts.claimExternalId(
                workspaceId,
                externalId
              );

              if (Option.isSome(holder)) {
                return "taken" as const;
              }

              yield* make
                ? posts.insert(
                    withExternalId(
                      createDraft(
                        postId,
                        workspaceId,
                        content("Second"),
                        Option.none()
                      ),
                      Option.some(externalId)
                    ),
                    []
                  )
                : posts.setExternalId(postId, Option.some(externalId));

              return "given" as const;
            })
          );

        const outcomes = yield* Effect.all(
          [claim(first.postId, false), claim(second, true)],
          { concurrency: 2 }
        );

        assert.deepStrictEqual(outcomes.toSorted(), ["given", "taken"]);

        yield* posts.remove(first.postId);
        yield* posts.remove(second);
      })
  );

  storage.effect(
    "gives one external id to one post that is not cancelled",
    () =>
      Effect.gen(function* unique() {
        const posts = yield* PostRepository;
        const first = yield* draftAt("1970-01-01T00:03:00.000Z");
        const externalId = PostExternalIdSchema.make("record-unique");

        yield* posts.setExternalId(first.postId, Option.some(externalId));

        assert.deepStrictEqual(
          yield* posts.claimExternalId(first.post.workspaceId, externalId),
          Option.some(first.postId)
        );

        // Another workspace's posts are none of its own.
        const other = yield* draftAt("1970-01-01T00:03:00.000Z");

        assert.deepStrictEqual(
          yield* posts.externalIdHolder(other.post.workspaceId, externalId),
          Option.none()
        );

        // The index refuses a second post with it in the workspace.
        const second = yield* newId(PostIdSchema);

        const inserted = yield* posts
          .insert(
            withExternalId(
              createDraft(
                second,
                first.post.workspaceId,
                content("Another"),
                Option.none()
              ),
              Option.some(externalId)
            ),
            []
          )
          .pipe(Effect.flip);

        // Answered as the domain's refusal, never a server's error.
        assert.strictEqual(inserted._tag, "PostExternalIdTaken");

        yield* posts.remove(first.postId);
        yield* posts.remove(other.postId);
      })
  );
});
