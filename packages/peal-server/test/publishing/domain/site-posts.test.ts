import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option, Result, Schema } from "effect";

import { approvalSubject } from "#publishing/domain/approval-subject.ts";
import {
  bodyViolationsOn,
  checkDraft,
  violationsOn,
} from "#publishing/domain/content-rules.ts";
import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { contentOn } from "#publishing/domain/duplicate-window.ts";
import { HashnodeOptions } from "#publishing/domain/hashnode-options.ts";
import { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import {
  PostContent,
  sentTo,
  textOn,
} from "#publishing/domain/post-content.ts";
import { PostPart } from "#publishing/domain/post-part.ts";
import { PostTarget } from "#publishing/domain/post-target.ts";
import { maxPostTextLength } from "#publishing/domain/post-text.ts";
import {
  bodyAttachmentsOf,
  bodyOfText,
  richOverride,
  richOverrideKeeping,
} from "#publishing/domain/rich-override.ts";
import { linksToShorten } from "#publishing/domain/short-links.ts";
import { SignatureIdSchema } from "#publishing/domain/signature-id.ts";
import {
  createSignature,
  withDefaultSignatures,
  withSignature,
} from "#publishing/domain/signature.ts";
import { TextOverride } from "#publishing/domain/text-override.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import {
  ChannelIdSchema,
  MediaAssetIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { textOfBody } from "#shared/domain/rich-text/rich-body.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";
import { contentOf } from "#test/publishing/support.ts";

// A post that goes to a website: the site's options, the body of its
// override, and the rules every other part of publishing keeps for it.

const site = ChannelIdSchema.make("00000000-0000-7000-8000-0000000000d1");

const mastodon = ChannelIdSchema.make("00000000-0000-7000-8000-0000000000d2");

const first = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000a001");

const second = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000a002");

const body: ArticleBody = {
  content: [
    {
      attrs: { level: 2 },
      content: [{ text: "What ships", type: "text" }],
      type: "heading",
    },
    {
      content: [
        { marks: [{ type: "bold" }], text: "Launch", type: "text" },
        { type: "hardBreak" },
        { text: "day", type: "text" },
      ],
      type: "paragraph",
    },
    { attrs: { alt: "The cake", mediaId: first }, type: "image" },
    {
      content: [
        {
          content: [
            { content: [{ text: "one", type: "text" }], type: "paragraph" },
          ],
          type: "listItem",
        },
        {
          content: [
            { content: [{ text: "two", type: "text" }], type: "paragraph" },
          ],
          type: "listItem",
        },
      ],
      type: "bulletList",
    },
    { attrs: { alt: "Again", mediaId: first }, type: "image" },
    { attrs: { alt: "The shop", mediaId: second }, type: "image" },
  ],
  type: "doc",
};

describe("a website's options", () => {
  it("need a title, within each site's length", () => {
    expect(new WordPressOptions({}).problems()).toStrictEqual([
      { _tag: "missing", field: "title" },
    ]);
    expect(
      new DevtoOptions({ title: "x".repeat(129) }).problems()
    ).toStrictEqual([
      { _tag: "tooLong", field: "title", length: 129, maximum: 128 },
    ]);
    expect(
      new WordPressOptions({ title: "x".repeat(500) }).problems()
    ).toStrictEqual([]);
  });

  it("hold an excerpt within its bound", () => {
    expect(
      new HashnodeOptions({ excerpt: "x".repeat(1001), title: "T" }).problems()
    ).toStrictEqual([
      { _tag: "tooLong", field: "excerpt", length: 1001, maximum: 1000 },
    ]);
  });

  it("refuse more tags than the site takes, or one it does not take", () => {
    expect(
      new DevtoOptions({
        tags: ["one", "two", "three", "four", "five"],
        title: "T",
      }).problems()
    ).toStrictEqual([{ _tag: "invalid", field: "tags" }]);
    expect(
      new DevtoOptions({ tags: ["not a tag"], title: "T" }).problems()
    ).toStrictEqual([{ _tag: "invalid", field: "tags" }]);
    expect(
      new WordPressOptions({ categories: [" "], title: "T" }).problems()
    ).toStrictEqual([{ _tag: "invalid", field: "categories" }]);
  });

  it("give categories on WordPress alone", () => {
    expect(Object.keys(WordPressOptions.fields)).toContain("categories");
    expect(Object.keys(DevtoOptions.fields)).not.toContain("categories");
    expect(Object.keys(HashnodeOptions.fields)).not.toContain("categories");
  });

  it("take publish or draft, and no future", () => {
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(WordPressOptions)({
          platform: "wordpress",
          siteStatus: "future",
        })
      )
    ).toBeTruthy();
  });
});

describe("a rich override", () => {
  it("answers the body's plain text, its blocks a blank line apart", () => {
    expect(textOfBody(body, maxPostTextLength)).toBe(
      "What ships\n\nLaunch\nday\n\none\ntwo"
    );
  });

  it("cuts its text, never inside a character", () => {
    const emoji: ArticleBody = {
      content: [
        { content: [{ text: "ab😀", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    };

    expect(textOfBody(emoji, 3)).toBe("ab");
  });

  it("answers the body's images in order, each once, with its first description", () => {
    expect(bodyAttachmentsOf(body)).toStrictEqual([
      new MediaAttachment({ altText: "The cake", mediaId: first }),
      new MediaAttachment({ altText: "The shop", mediaId: second }),
    ]);
  });

  it("mirrors the body on the override's text and media", () => {
    const override = richOverride(site, body);

    expect(override.text).toBe("What ships\n\nLaunch\nday\n\none\ntwo");
    expect(override.media?.map(({ mediaId }) => mediaId)).toStrictEqual([
      first,
      second,
    ]);
    expect(override.body).toStrictEqual(body);
  });

  it("may have an empty text beside a body, never without one", () => {
    expect(
      richOverride(site, {
        content: [{ attrs: { alt: "", mediaId: first }, type: "image" }],
        type: "doc",
      }).text
    ).toBe("");
    expect(() => new TextOverride({ channelId: site, text: "" })).toThrow(
      /Schema validation failed/u
    );
  });

  it("loses the images of the files gone, and is made again", () => {
    const kept = richOverrideKeeping(site, body, (id) => id !== first);

    expect(kept.media?.map(({ mediaId }) => mediaId)).toStrictEqual([second]);
    expect(
      kept.body?.content.filter((block) => block.type === "image")
    ).toHaveLength(1);
  });
});

describe("a website's body made from the post's text", () => {
  it("is a paragraph a block, a hard break a line, its addresses links, then its images", () => {
    expect(
      bodyOfText("Read https://example.com/a now\nor later\n\nBye", [
        new MediaAttachment({ altText: "Cake", mediaId: first }),
      ])
    ).toStrictEqual({
      content: [
        {
          content: [
            { text: "Read ", type: "text" },
            {
              marks: [
                { attrs: { href: "https://example.com/a" }, type: "link" },
              ],
              text: "https://example.com/a",
              type: "text",
            },
            { text: " now", type: "text" },
            { type: "hardBreak" },
            { text: "or later", type: "text" },
          ],
          type: "paragraph",
        },
        { content: [{ text: "Bye", type: "text" }], type: "paragraph" },
        { attrs: { alt: "Cake", mediaId: first }, type: "image" },
      ],
      type: "doc",
    });
  });

  it("leaves an address without a scheme as text", () => {
    expect(bodyOfText("See example.com", [])).toStrictEqual({
      content: [
        {
          content: [{ text: "See example.com", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });
});

const withBodyOn = (channelId: typeof site) =>
  new PostContent({
    media: [],
    overrides: [richOverride(channelId, body)],
    text: "Plain",
  });

describe("a body where none is taken", () => {
  it("is refused on a platform that is no website's, on a draft too", () => {
    const channel = { channelId: mastodon, platform: "mastodon" as const };

    expect(bodyViolationsOn(withBodyOn(mastodon), channel)).toStrictEqual([
      { _tag: "bodyNotTaken", channelId: mastodon, platform: "mastodon" },
    ]);
    expect(
      Result.isFailure(checkDraft(withBodyOn(mastodon), [channel]))
    ).toBeTruthy();
  });

  it("is taken on a website's first part, and refused on a later one", () => {
    const channel = { channelId: site, platform: "wordpress" as const };

    expect(bodyViolationsOn(withBodyOn(site), channel)).toStrictEqual([]);

    const later = new PostContent({
      followUps: [
        new PostPart({
          delaySeconds: 0,
          media: [],
          overrides: [richOverride(site, body)],
          text: "Later",
        }),
      ],
      media: [],
      overrides: [],
      text: "First",
    });

    expect(bodyViolationsOn(later, channel)).toStrictEqual([
      { _tag: "bodyNotTaken", channelId: site, part: 1, platform: "wordpress" },
    ]);
  });

  it("counts no text limit on a website, and its body's images as its media", () => {
    const channel = { channelId: site, platform: "wordpress" as const };
    const sent = sentTo(withBodyOn(site), site);

    expect(sent.media).toHaveLength(2);
    expect(textOn(sent, site)).toBe("What ships\n\nLaunch\nday\n\none\ntwo");
    expect(violationsOn(sent, channel)).toStrictEqual([]);
  });
});

const postId = PostIdSchema.make("00000000-0000-7000-8000-0000000000a1");

const target = new PostTarget({
  channelId: site,
  id: PostTargetIdSchema.make("00000000-0000-7000-8000-0000000000b1"),
  liveParts: [],
  options: Option.none(),
  postId,
  round: 1,
  status: { _tag: "pending" },
});

describe("a platform that states no count of files", () => {
  it("is held to what a part holds, whatever an override gives it", () => {
    const facebook = { channelId: mastodon, platform: "facebook" as const };

    const many = Array.from(
      { length: 21 },
      (_, index) =>
        new MediaAttachment({
          altText: "",
          mediaId: MediaAssetIdSchema.make(
            `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`
          ),
        })
    );

    const content = new PostContent({
      media: [],
      overrides: [
        new TextOverride({ channelId: mastodon, media: many, text: "Many" }),
      ],
      text: "Many",
    });

    expect(
      violationsOn(sentTo(content, mastodon), facebook).map(({ _tag }) => _tag)
    ).toContain("tooManyMedia");
    expect(
      violationsOn(sentTo(content, mastodon), {
        channelId: mastodon,
        platform: "googleBusiness",
      }).map(({ _tag }) => _tag)
    ).toContain("tooManyMedia");
    // TikTok takes 35 photos, but a post holds 20, as its capabilities say.
    expect(
      violationsOn(sentTo(content, mastodon), {
        channelId: mastodon,
        platform: "tiktok",
      }).map(({ _tag }) => _tag)
    ).toContain("tooManyMedia");
  });
});

describe("the approval subject and the duplicate digest", () => {
  it("of a post without a body are what they were", () => {
    const plain = contentOf("Launch day");

    expect(approvalSubject(plain, [target])).not.toContain("body");
    expect(contentOn(plain, site)).toBe('{"media":[],"text":"Launch day"}');
  });

  it("change with a body", () => {
    const plain = new PostContent({
      media: [],
      overrides: [
        new TextOverride({
          channelId: site,
          media: bodyAttachmentsOf(body),
          text: textOfBody(body, maxPostTextLength),
        }),
      ],
      text: "Plain",
    });

    expect(approvalSubject(withBodyOn(site), [target])).not.toBe(
      approvalSubject(plain, [target])
    );
    expect(contentOn(withBodyOn(site), site)).not.toBe(contentOn(plain, site));
  });
});

describe("signatures", () => {
  const workspaceId = WorkspaceIdSchema.make(
    "00000000-0000-4000-8000-000000000002"
  );

  const signature = createSignature(
    SignatureIdSchema.make("00000000-0000-7000-8000-0000000000e1"),
    workspaceId,
    {
      isDefault: true,
      name: "Team",
      scope: { _tag: "workspace" },
      text: "— The team",
    },
    DateTime.makeUnsafe("2026-06-15T07:00:00Z")
  );

  it("never go under a rich text", () => {
    const signed = withSignature(withBodyOn(site), signature);

    expect(signed.overrides[0]).toStrictEqual(richOverride(site, body));
    expect(signed.text).toContain("— The team");

    const defaults = withDefaultSignatures(
      withBodyOn(site),
      [{ channelId: site, platform: "wordpress" }],
      [signature]
    );

    expect(defaults.overrides[0]).toStrictEqual(richOverride(site, body));
  });
});

describe("links on a website", () => {
  it("are never shortened", () => {
    expect(
      linksToShorten(
        "Read https://example.test/a/very/long/address/indeed",
        "wordpress",
        {
          base: "https://s.test/",
          codeLength: 6,
        }
      )
    ).toStrictEqual([]);
  });
});
