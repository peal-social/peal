import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";
import { draftId, finishedId, mastodonId } from "./studio.ts";
import type { Studio } from "./studio.ts";

// A post's own id, the caller's, against the in-memory studio: given when a
// post or a draft is made, changed on any post, found again by the list.

const inStudio = ["--workspace", "studio"];

const externalIdOf = (studio: Studio, postId: string) =>
  Ref.get(studio.state).pipe(
    Effect.map(
      ({ posts }) => posts.find(({ id }) => id === postId)?.externalId ?? null
    )
  );

const changes = (studio: Studio) =>
  Ref.get(studio.state).pipe(Effect.map(({ changes: made }) => made));

describe("a post's external id", () => {
  it.effect("gives a finished post one, shows it, and takes it off", () =>
    Effect.gen(function* gives() {
      const session = yield* signedIn();

      assert.strictEqual(
        yield* session.printed([
          "posts",
          "external-id",
          finishedId,
          "record-42",
          ...inStudio,
        ]),
        `Post ${finishedId} has the external id record-42.`
      );
      assert.strictEqual(
        yield* externalIdOf(session.studio, finishedId),
        "record-42"
      );
      assert.include(
        yield* session.printed(["posts", "show", finishedId, ...inStudio]),
        "External id: record-42"
      );

      assert.strictEqual(
        yield* session.printed([
          "posts",
          "external-id",
          finishedId,
          "--clear",
          ...inStudio,
        ]),
        `Post ${finishedId} has no external id now.`
      );
      assert.strictEqual(yield* externalIdOf(session.studio, finishedId), null);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("asks for an id or --clear, one of them, before any request", () =>
    Effect.gen(function* oneOf() {
      const session = yield* signedIn();

      for (const args of [
        ["posts", "external-id", finishedId],
        ["posts", "external-id", finishedId, "record-42", "--clear"],
      ]) {
        assert.include(
          yield* session.refused([...args, ...inStudio]),
          "Give the post's external id, or --clear to take it off: one of them."
        );
      }

      assert.deepStrictEqual(yield* changes(session.studio), []);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("sends a post with one, and refuses a second, naming the first", () =>
    Effect.gen(function* sends() {
      const session = yield* signedIn();

      const send = [
        "post",
        "A synthetic post from a record.",
        "--channel",
        mastodonId,
        "--now",
        "--external-id",
        "record-7",
        ...inStudio,
      ];

      yield* session.printed(send);

      const refused = yield* session.refused(send);

      assert.match(
        refused,
        /Post \S+ has this external id already: nothing was made or changed\./u
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("keeps a draft's id unless a flag says otherwise", () =>
    Effect.gen(function* keeps() {
      const session = yield* signedIn();

      yield* session.printed([
        "drafts",
        "save",
        "--post",
        draftId,
        "--external-id",
        "record-9",
        ...inStudio,
      ]);
      assert.strictEqual(yield* externalIdOf(session.studio, draftId), "record-9");

      yield* session.printed([
        "drafts",
        "save",
        "--post",
        draftId,
        "--text",
        "A synthetic draft, changed.",
        ...inStudio,
      ]);
      assert.strictEqual(yield* externalIdOf(session.studio, draftId), "record-9");

      yield* session.printed([
        "drafts",
        "save",
        "--post",
        draftId,
        "--clear-external-id",
        ...inStudio,
      ]);
      assert.strictEqual(yield* externalIdOf(session.studio, draftId), null);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("lists by an external id and by change", () =>
    Effect.gen(function* lists() {
      const session = yield* signedIn();

      yield* session.printed([
        "posts",
        "external-id",
        finishedId,
        "record-42",
        ...inStudio,
      ]);

      const found = yield* session.printed([
        "posts",
        "list",
        "--external-id",
        "record-42",
        "--sort",
        "updatedAsc",
        "--updated-since",
        "2026-11-01T00:00:00Z",
        ...inStudio,
      ]);

      assert.include(found, finishedId);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
