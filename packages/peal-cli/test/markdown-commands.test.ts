import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";
import type { SignedIn } from "./signed-in.ts";
import {
  failedTargetId,
  finishedId,
  mastodonId,
  readyMediaId,
} from "./studio.ts";
import type { Studio } from "./studio.ts";

// A website's body from a Markdown file, through peal post, peal drafts
// save and peal posts edit, against the in-memory studio: the file is read
// before any request, its images named by a path or an https address are
// stored first, once each, and sent as media:<id>; with --dry-run, only
// media ids are taken. The studio judges no platform, so a channel of it
// stands for the website.

const inStudio = ["--workspace", "studio"];

const stateOf = (studio: Studio) => Ref.get(studio.state);

// A file of the test's own, in a folder of the session's.
const written = (session: SignedIn, name: string, content: string) =>
  Effect.gen(function* writing() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(session.directory, name);

    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);

    return file;
  });

// What the studio takes as a picture: it reads no file's bytes.
const picture = "synthetic png";

// peal post now on the channel, its body from `flag`.
const post = (flag: string) => [
  "post",
  "A synthetic article",
  "--channel",
  mastodonId,
  "--now",
  "--markdown",
  flag,
  ...inStudio,
];

// peal posts edit of the finished post on the channel.
const edit = (...more: readonly string[]) => [
  "posts",
  "edit",
  finishedId,
  "--channel",
  mastodonId,
  ...more,
  ...inStudio,
];

// The Markdown a post sent on the channel, as the studio kept it.
const markdownSent = (studio: Studio, text: string) =>
  stateOf(studio).pipe(
    Effect.map(
      ({ posts }) =>
        posts
          .find(({ content }) => content.text === text)
          ?.content.overrides.find(({ channelId }) => channelId === mastodonId)
          ?.bodyMarkdown
    )
  );

const mediaIdsIn = (markdown: string | undefined) =>
  [...(markdown ?? "").matchAll(/media:(?<id>[\da-f-]{36})/gu)].map(
    (match) => match.groups?.["id"] ?? ""
  );

describe("peal post --markdown", () => {
  it.effect(
    "stores a file's local image and its address once each, and sends their ids",
    () =>
      Effect.gen(function* stores() {
        const session = yield* signedIn();

        yield* written(session, "article/peas.png", picture);

        const file = yield* written(
          session,
          "article/body.md",
          [
            "## Sow early",
            "![A row of peas](peas.png)",
            "![The same peas, again](./peas.png)",
            "![A banner](https://files.example.test/banner.png)",
            `![Kept](media:${readyMediaId})`,
            "![By reference][cover]",
            "[cover]: https://files.example.test/banner.png",
          ].join("\n\n")
        );

        yield* session.printed([
          "post",
          "A synthetic article",
          "--channel",
          mastodonId,
          "--at",
          "2026-11-20T10:00",
          "--markdown",
          `${mastodonId}=${file}`,
          ...inStudio,
        ]);

        const sent = yield* markdownSent(session.studio, "A synthetic article");
        const state = yield* stateOf(session.studio);
        const [uploaded, , imported] = mediaIdsIn(sent);

        assert.strictEqual(
          sent,
          [
            "## Sow early",
            `![A row of peas](media:${String(uploaded)})`,
            `![The same peas, again](media:${String(uploaded)})`,
            `![A banner](media:${String(imported)})`,
            `![Kept](media:${readyMediaId})`,
            "![By reference][cover]",
            `[cover]: media:${String(imported)}`,
          ].join("\n\n")
        );
        assert.deepStrictEqual(
          state.changes.filter((change) => !change.startsWith("send:")),
          [
            `upload:${String(uploaded)}:image/png`,
            `complete:${String(uploaded)}`,
            `import:${String(imported)}:https://files.example.test/banner.png`,
          ]
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("with --dry-run, takes media ids only and stores nothing", () =>
    Effect.gen(function* dryRun() {
      const session = yield* signedIn();

      yield* written(session, "peas.png", picture);

      const storing = yield* written(
        session,
        "storing.md",
        "![Peas](peas.png)"
      );

      const kept = yield* written(
        session,
        "kept.md",
        `## Ready\n\n![Kept](media:${readyMediaId})`
      );

      assert.include(
        yield* session.refused([
          "post",
          "A synthetic check",
          "--channel",
          mastodonId,
          "--now",
          "--dry-run",
          "--markdown",
          `${mastodonId}=${storing}`,
          ...inStudio,
        ]),
        "names its images by media id only"
      );

      yield* session.printed([
        "post",
        "A synthetic check",
        "--channel",
        mastodonId,
        "--now",
        "--dry-run",
        "--markdown",
        `${mastodonId}=${kept}`,
        ...inStudio,
      ]);

      const state = yield* stateOf(session.studio);

      assert.deepStrictEqual(state.stored, []);
      assert.isFalse(
        state.changes.some(
          (change) =>
            change.startsWith("upload:") || change.startsWith("import:")
        )
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "refuses a file it cannot read, or one past a body's bound, before any request",
    () =>
      Effect.gen(function* refuses() {
        const session = yield* signedIn();
        const huge = yield* written(session, "huge.md", "a".repeat(400_001));

        assert.include(
          yield* session.refused(post(`${mastodonId}=${huge}`)),
          "400000 characters at most"
        );
        assert.include(
          yield* session.refused(post(`${mastodonId}=missing.md`)),
          "Cannot read missing.md"
        );
        assert.include(
          yield* session.refused(post("missing.md")),
          "--markdown takes <channel-id>=<file>"
        );
        assert.deepStrictEqual((yield* stateOf(session.studio)).changes, []);
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});

describe("peal drafts save --markdown", () => {
  it.effect("saves the file's body on its channel", () =>
    Effect.gen(function* saves() {
      const session = yield* signedIn();
      const file = yield* written(session, "draft.md", "## Draft\n\nSoon.");

      yield* session.printed([
        "drafts",
        "save",
        "--text",
        "A synthetic draft",
        "--channel",
        mastodonId,
        "--markdown",
        `${mastodonId}=${file}`,
        ...inStudio,
      ]);

      assert.strictEqual(
        yield* markdownSent(session.studio, "A synthetic draft"),
        "## Draft\n\nSoon."
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});

describe("peal posts edit --markdown-file", () => {
  it.effect("sends the file as the body, and is never given with --body", () =>
    Effect.gen(function* edits() {
      const session = yield* signedIn();

      yield* Ref.update(session.studio.state, (current) => ({
        ...current,
        posts: current.posts.map((found) =>
          found.id === finishedId
            ? {
                ...found,
                targets: found.targets.map((target) =>
                  target.id === failedTargetId
                    ? {
                        ...target,
                        failureReason: null,
                        permalink: "https://social.example.test/@studio/1",
                        status: "published" as const,
                      }
                    : target
                ),
              }
            : found
        ),
      }));

      const file = yield* written(session, "edit.md", "## Corrected\n\nNow.");

      assert.include(
        yield* session.refused(
          edit("--markdown-file", file, "--body", '{"type":"doc","content":[]}')
        ),
        "Give --body or --markdown-file, not both"
      );

      yield* session.printed(edit("--markdown-file", file));

      assert.deepStrictEqual((yield* stateOf(session.studio)).changes, [
        `edit:${failedTargetId}:0`,
        "markdown:## Corrected\n\nNow.",
      ]);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
