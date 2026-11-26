import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import {
  Api,
  PostContentInvalid,
  TextOverrideSchema,
  forWorkspace,
} from "peal-contract";
import type { PostContent } from "peal-contract";

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

// A post to a website through the posts endpoints: its options, and a
// rich text of its own on the channel, mirrored on the override's text
// and media.

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

const bodyShowing = (mediaId: string) => ({
  content: [
    {
      attrs: { level: 2 },
      content: [{ text: "What ships", type: "text" }],
      type: "heading",
    },
    { attrs: { alt: "The cake", mediaId }, type: "image" },
  ],
  type: "doc" as const,
});

describe("a post to a website", () => {
  it.effect(
    "keeps its rich text, answering its text and media as the body's, and schedules with a title",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* rich() {
          const workspaceId = yield* freshWorkspace;
          const site = yield* connect(workspaceId, "wordpress");
          const client = yield* editorIn(workspaceId);
          const photo = yield* storeMedia(workspaceId);

          const content: PostContent = {
            media: [],
            overrides: [
              { body: bodyShowing(photo), channelId: site, text: "" },
            ],
            text: "The plain text",
          };

          const draft = yield* client["posts.drafts"].create({
            headers: forWorkspace(workspaceId),
            payload: { channelIds: [site], content },
          });

          const [override] = draft.content.overrides;

          assert.strictEqual(override?.text, "What ships");
          assert.deepStrictEqual(
            override?.media?.map(({ mediaId }) => mediaId),
            [photo]
          );
          assert.deepStrictEqual(override?.body, bodyShowing(photo));

          // Without a title, the site would refuse it.
          const refused = yield* client.posts
            .schedule({
              headers: forWorkspace(workspaceId),
              params: { postId: draft.id },
              payload: { ...later, channelIds: [site] },
            })
            .pipe(Effect.flip);

          assert(refused instanceof PostContentInvalid);
          assert.deepStrictEqual(
            refused.violations.map(({ _tag }) => _tag),
            ["optionMissing"]
          );

          const titled = yield* client.posts.update({
            headers: forWorkspace(workspaceId),
            params: { postId: draft.id },
            payload: {
              channelIds: [site],
              content,
              options: [
                {
                  channelId: site,
                  options: { platform: "wordpress", title: "Launch day" },
                },
              ],
            },
          });

          const scheduled = yield* client.posts.schedule({
            headers: forWorkspace(workspaceId),
            params: { postId: titled.id },
            payload: { ...later, channelIds: [site] },
          });

          assert.strictEqual(scheduled.status, "scheduled");
        })
      ),
    timeout
  );

  it.effect(
    "refuses a rich text off the allow-list, and one on a channel that is no website's",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* refused() {
          const workspaceId = yield* freshWorkspace;
          const site = yield* connect(workspaceId, "wordpress");
          const mastodon = yield* connect(workspaceId, "mastodon");
          const client = yield* editorIn(workspaceId);

          const invalid = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: {
                channelIds: [site],
                content: {
                  media: [],
                  overrides: [
                    {
                      body: {
                        content: [{ type: "script" }],
                        type: "doc",
                      },
                      channelId: site,
                      text: "",
                    },
                  ],
                  text: "Plain",
                },
              },
            })
            .pipe(Effect.flip);

          assert(invalid instanceof PostContentInvalid);
          assert.deepStrictEqual(invalid.violations, [
            { _tag: "bodyInvalid", channelId: site },
          ]);

          const elsewhere = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: {
                channelIds: [mastodon],
                content: {
                  media: [],
                  overrides: [
                    {
                      body: {
                        content: [
                          {
                            content: [{ text: "Rich", type: "text" }],
                            type: "paragraph",
                          },
                        ],
                        type: "doc",
                      },
                      channelId: mastodon,
                      text: "",
                    },
                  ],
                  text: "Plain",
                },
              },
            })
            .pipe(Effect.flip);

          assert(elsewhere instanceof PostContentInvalid);
          assert.deepStrictEqual(
            elsewhere.violations.map(({ _tag }) => _tag),
            ["bodyNotTaken"]
          );
        })
      ),
    timeout
  );
});

describe("what a request may not crash on", () => {
  it("refuses an override with no text and no body as it is read", () => {
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(TextOverrideSchema)({
          channelId: "00000000-0000-7000-8000-0000000000d1",
          text: "",
        })
      )
    ).toBeTruthy();
  });

  it.effect(
    "answers a later part's 21 files on a channel as too many, and a rich text of 101 files as invalid",
    () =>
      onPostsWithLibraryAt(
        start,
        Effect.gen(function* bounds() {
          const workspaceId = yield* freshWorkspace;
          const facebook = yield* connect(workspaceId, "facebook");
          const site = yield* connect(workspaceId, "wordpress");
          const client = yield* editorIn(workspaceId);

          const photos = yield* Effect.forEach(Array.from({ length: 21 }), () =>
            storeMedia(workspaceId)
          );

          const many = photos.map((mediaId) => ({
            altText: "A synthetic picture",
            mediaId,
          }));

          const checked = yield* client.posts.validate({
            headers: forWorkspace(workspaceId),
            payload: {
              channelIds: [facebook],
              content: {
                followUps: [
                  {
                    delaySeconds: 0,
                    media: [],
                    overrides: [
                      { channelId: facebook, media: many, text: "Later" },
                    ],
                    text: "Later",
                  },
                ],
                media: [],
                overrides: [
                  { channelId: facebook, media: many, text: "First" },
                ],
                text: "First",
              },
            },
          });

          assert.isFalse(checked.valid);
          assert.include(
            checked.channels[0]?.violations.map(({ _tag }) => _tag) ?? [],
            "tooManyMedia"
          );

          const images = Array.from({ length: 101 }, (_, index) => ({
            attrs: {
              alt: "",
              mediaId: `01900000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
            },
            type: "image",
          }));

          const crowded = yield* client["posts.drafts"]
            .create({
              headers: forWorkspace(workspaceId),
              payload: {
                channelIds: [site],
                content: {
                  media: [],
                  overrides: [
                    {
                      body: { content: images, type: "doc" },
                      channelId: site,
                      text: "",
                    },
                  ],
                  text: "Plain",
                },
              },
            })
            .pipe(Effect.flip);

          assert(crowded instanceof PostContentInvalid);
          assert.deepStrictEqual(crowded.violations, [
            { _tag: "bodyInvalid", channelId: site },
          ]);
        })
      ),
    timeout
  );
});
