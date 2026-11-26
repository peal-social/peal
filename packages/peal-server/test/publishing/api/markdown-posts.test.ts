import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import {
  Api,
  LivePostEditSchema,
  PostContentInvalid,
  TextOverrideSchema,
  UnknownMedia,
  forWorkspace,
} from "peal-contract";
import type { BodyProblem, PostContent, RichText } from "peal-contract";

import { PostDraftsHandlers } from "#publishing/api/post-drafts.ts";
import { PostsHandlers } from "#publishing/api/posts.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { memberOf } from "#test/channels/support.ts";
import { utc } from "#test/publishing/infrastructure/harness.ts";
import {
  onPostsWithLibraryAt,
  storeMedia,
} from "#test/publishing/library-media.ts";
import { connect } from "#test/publishing/posts-server.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// A website's body sent as Markdown through the posts endpoints: read into
// the rich text, which is what is stored and answered, with its text and
// files mirrored on the override; the Markdown itself is never answered.

const timeout = 60_000;

const start = "2026-06-15T07:00:00Z";

const later = { at: utc("2026-06-16T07:30:00Z"), timeZone: "Europe/Paris" };

const freshWorkspace = newId(WorkspaceIdSchema);

const editorIn = (workspaceId: WorkspaceId) =>
  HttpApiTest.groups(Api, ["posts", "posts.drafts"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.merge(PostsHandlers, PostDraftsHandlers).pipe(
          Layer.provideMerge(
            securityTest(memberOf(workspaceId, permissionsFor("editor")))
          )
        ),
        HttpServer.layerServices
      )
    )
  );

const markdownShowing = (mediaId: string) =>
  `## What ships\n\nThe *new* editor.\n\n![The cake](media:${mediaId})\n\n\`\`\`ts\nconst done = true;\n\`\`\``;

const bodyShowing = (mediaId: string): RichText => ({
  content: [
    {
      attrs: { level: 2 },
      content: [{ text: "What ships", type: "text" }],
      type: "heading",
    },
    {
      content: [
        { text: "The ", type: "text" },
        { marks: [{ type: "italic" }], text: "new", type: "text" },
        { text: " editor.", type: "text" },
      ],
      type: "paragraph",
    },
    { attrs: { alt: "The cake", mediaId }, type: "image" },
    {
      attrs: { language: "ts" },
      content: [{ text: "const done = true;", type: "text" }],
      type: "codeBlock",
    },
  ],
  type: "doc",
});

const titled = (channelId: string) =>
  [
    { channelId, options: { platform: "wordpress", title: "Launch day" } },
  ] as const;

describe("a website's body sent as Markdown", () => {
  it.effect(
    "is kept and answered as the rich text, on a draft, a post and a bulk item",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* fromMarkdown() {
          const workspaceId = yield* freshWorkspace;
          const site = yield* connect(workspaceId, "wordpress");
          const client = yield* editorIn(workspaceId);
          const photo = yield* storeMedia(workspaceId);

          const content: PostContent = {
            media: [],
            overrides: [
              {
                bodyMarkdown: markdownShowing(photo),
                channelId: site,
                text: "",
              },
            ],
            text: "The plain text",
          };

          const draft = yield* client["posts.drafts"].create({
            headers: forWorkspace(workspaceId),
            payload: { channelIds: [site], content },
          });

          const [override] = draft.content.overrides;

          assert(override !== undefined);

          assert.deepStrictEqual(override, {
            body: bodyShowing(photo),
            channelId: site,
            media: [{ altText: "The cake", mediaId: photo }],
            text: "What ships\n\nThe new editor.\n\nconst done = true;",
          });

          const read = yield* client.posts.get({
            headers: forWorkspace(workspaceId),
            params: { postId: draft.id },
          });

          assert.deepStrictEqual(read.content.overrides, [override]);

          const post = yield* client.posts.create({
            headers: forWorkspace(workspaceId),
            payload: {
              channelIds: [site],
              content,
              options: titled(site),
              when: { _tag: "at", ...later },
            },
            query: {},
          });

          assert.strictEqual(post.status, "scheduled");
          assert.deepStrictEqual(post.content.overrides, [override]);

          const bulk = yield* client.posts.bulk({
            headers: forWorkspace(workspaceId),
            payload: {
              posts: [
                {
                  // The same post as the one just made, on purpose.
                  allowDuplicate: true,
                  channelIds: [site],
                  content,
                  options: titled(site),
                  when: { _tag: "at", ...later },
                },
              ],
            },
          });

          const [item] = bulk.items;

          assert(item?._tag === "created");
          assert.deepStrictEqual(item.post.content.overrides, [override]);

          // Checked, it is the rich text that is checked.
          const checked = yield* client.posts.validate({
            headers: forWorkspace(workspaceId),
            payload: { channelIds: [site], content, options: titled(site) },
          });

          assert.isTrue(checked.valid);

          // A draft whose body is updated from Markdown keeps the new one.
          const updated = yield* client.posts.update({
            headers: forWorkspace(workspaceId),
            params: { postId: draft.id },
            payload: {
              channelIds: [site],
              content: {
                ...content,
                overrides: [
                  { bodyMarkdown: "Shorter.", channelId: site, text: "" },
                ],
              },
            },
          });

          assert.deepStrictEqual(updated.content.overrides, [
            {
              body: {
                content: [
                  {
                    content: [{ text: "Shorter.", type: "text" }],
                    type: "paragraph",
                  },
                ],
                type: "doc",
              },
              channelId: site,
              media: [],
              text: "Shorter.",
            },
          ]);
        })
      ),
    timeout
  );

  it.effect(
    "is refused with each problem's place, as data when it is checked",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* refused() {
          const workspaceId = yield* freshWorkspace;
          const site = yield* connect(workspaceId, "wordpress");
          const client = yield* editorIn(workspaceId);

          const content: PostContent = {
            media: [],
            overrides: [
              {
                bodyMarkdown:
                  "# Title twice\n\n| a | b |\n| - | - |\n\n![x](https://img.example/a.png)",
                channelId: site,
                text: "",
              },
            ],
            text: "Plain",
          };

          const problems: readonly BodyProblem[] = [
            { column: 1, line: 1, problem: "headingLevel" },
            { column: 1, line: 3, problem: "table" },
            { column: 1, line: 6, problem: "image" },
          ];

          const invalid = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: { channelIds: [site], content },
            })
            .pipe(Effect.flip);

          assert(invalid instanceof PostContentInvalid);
          assert.deepStrictEqual(invalid.violations, [
            { _tag: "bodyInvalid", channelId: site, problems },
          ]);

          const checked = yield* client.posts.validate({
            headers: forWorkspace(workspaceId),
            payload: { channelIds: [site], content },
          });

          assert.isFalse(checked.valid);
          assert.deepInclude(checked.violations, {
            _tag: "bodyInvalid",
            channelId: site,
            problems,
          });
        })
      ),
    timeout
  );

  it.effect(
    "is no body on a social network, and shows no file of another workspace",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* elsewhere() {
          const workspaceId = yield* freshWorkspace;
          const site = yield* connect(workspaceId, "wordpress");
          const mastodon = yield* connect(workspaceId, "mastodon");
          const client = yield* editorIn(workspaceId);
          const theirs = yield* storeMedia(yield* freshWorkspace);

          const social = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: {
                channelIds: [mastodon],
                content: {
                  media: [],
                  overrides: [
                    { bodyMarkdown: "Rich", channelId: mastodon, text: "" },
                  ],
                  text: "Plain",
                },
              },
            })
            .pipe(Effect.flip);

          assert(social instanceof PostContentInvalid);
          assert.deepStrictEqual(
            social.violations.map(({ _tag }) => _tag),
            ["bodyNotTaken"]
          );

          const unknown = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: {
                channelIds: [site],
                content: {
                  media: [],
                  overrides: [
                    {
                      bodyMarkdown: `![Not ours](media:${theirs})`,
                      channelId: site,
                      text: "",
                    },
                  ],
                  text: "Plain",
                },
              },
            })
            .pipe(Effect.flip);

          assert.instanceOf(unknown, UnknownMedia);
        })
      ),
    timeout
  );
});

describe("a body and a body as Markdown", () => {
  const body = { content: [], type: "doc" };

  it("are never both on an override, nor on an edit", () => {
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(TextOverrideSchema)({
          body,
          bodyMarkdown: "Both",
          channelId: "00000000-0000-7000-8000-0000000000d1",
          text: "",
        })
      )
    ).toBeTruthy();
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(LivePostEditSchema)({
          body,
          bodyMarkdown: "Both",
        })
      )
    ).toBeTruthy();
  });

  it("each stands for the text an override may leave empty", () => {
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(TextOverrideSchema)({
          bodyMarkdown: "Alone",
          channelId: "00000000-0000-7000-8000-0000000000d1",
          text: "",
        })
      )
    ).toBeTruthy();
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(LivePostEditSchema)({
          bodyMarkdown: "Alone",
        })
      )
    ).toBeTruthy();
  });
});
