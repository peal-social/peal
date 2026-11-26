import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assert, describe, it, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";

import { PostRepository } from "#publishing/application/post-repository.ts";
import { ExecutionIdSchema } from "#publishing/application/publication-scheduler.ts";
import { PostContent } from "#publishing/domain/post-content.ts";
import { PostExternalIdSchema } from "#publishing/domain/post-external-id.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import { createTarget, startTarget } from "#publishing/domain/post-target.ts";
import {
  createDraft,
  editDraft,
  withExternalId,
} from "#publishing/domain/post.ts";
import { DrizzlePostRepository } from "#publishing/infrastructure/drizzle-post-repository.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema, PostIdSchema } from "#shared/domain/ids.ts";
import type { PostId } from "#shared/domain/ids.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";

// When a post last changed (`posts.updated_at`): every statement that
// writes a column a post's answer shows, its targets' included, moves it
// forward, never back; those that write what no answer shows leave it.

const StorageTest = DrizzlePostRepository.pipe(
  Layer.provideMerge(DatabaseTest)
);

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

const at = (instant: string) => DateTime.makeUnsafe(instant);

const content = (text: string) =>
  new PostContent({ media: [], overrides: [], text });

const updatedAtOf = (postId: PostId) =>
  PostRepository.use((posts) => posts.freshness([postId])).pipe(
    Effect.map((known) =>
      Option.fromUndefinedOr(known.get(postId)).pipe(
        Option.map(DateTime.formatIso),
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

      assert.deepStrictEqual(seen, [
        "1970-01-01T00:02:00.000Z",
        "1970-01-01T00:02:00.001Z",
        "1970-01-01T00:02:00.002Z",
        "1970-01-01T00:02:00.003Z",
        "1970-01-01T00:02:00.004Z",
        "1970-01-01T00:02:00.005Z",
      ]);

      // A write whose clock is behind the row still moves it forward.
      yield* TestClock.setTime(
        DateTime.toEpochMillis(at("1970-01-01T00:00:30.000Z"))
      );
      yield* posts.setTags(postId, []);

      assert.strictEqual(
        yield* updatedAtOf(postId),
        "1970-01-01T00:02:00.006Z"
      );

      yield* posts.remove(postId);
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
          .pipe(Effect.exit);

        assert.isTrue(inserted._tag === "Failure");

        yield* posts.remove(first.postId);
        yield* posts.remove(other.postId);
      })
  );
});
