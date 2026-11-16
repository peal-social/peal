import { describe, expect, it } from "@effect/vitest";
import { Duration, Option, Schema } from "effect";

import { previewOn } from "#publishing/domain/channel-preview.ts";
import {
  mediaViolationsOn,
  violationsOn,
} from "#publishing/domain/content-rules.ts";
import type { ChannelOnPlatform } from "#publishing/domain/content-rules.ts";
import { editViolationsOn } from "#publishing/domain/live-post-edit.ts";
import { platformRules } from "#publishing/domain/platform-rules.ts";
import { SlackOptions } from "#publishing/domain/slack-options.ts";
import { describeOptionsOn } from "#publishing/domain/target-options.ts";
import { measureText } from "#publishing/domain/text-length.ts";
import { ChannelIdSchema, MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import { contentOf, mediaFile } from "#test/publishing/support.ts";

const mebibyte = 1024 * 1024;

const slack: ChannelOnPlatform = {
  channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000d03"),
  platform: "slack",
};

const image = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000c001");

const other = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000c002");

const ids = (count: number): readonly MediaAssetId[] =>
  Array.from({ length: count }, (_, index) =>
    MediaAssetIdSchema.make(
      `00000000-0000-7000-8000-${(index + 0xc_10).toString(16).padStart(12, "0")}`
    )
  );

// An emoji outside the Basic Multilingual Plane: two UTF-16 units.
const emoji = "\u{1F600}";

const tags = (violations: readonly { readonly _tag: string }[]) =>
  violations.map(({ _tag }) => _tag);

describe("Slack's text unit", () => {
  it("counts the text as Slack takes it: UTF-16 units, with &, < and > as their entities", () => {
    expect(measureText("abc", "escapedUtf16Units")).toBe(3);
    expect(measureText(emoji, "escapedUtf16Units")).toBe(2);
    expect(measureText("&", "escapedUtf16Units")).toBe("&amp;".length);
    expect(measureText("<!channel>", "escapedUtf16Units")).toBe(
      "&lt;!channel&gt;".length
    );
  });
});

describe("Slack's rules", () => {
  it("takes 4,000 units of text alone, counted as sent", () => {
    expect(violationsOn(contentOf("a".repeat(4000)), slack)).toStrictEqual([]);
    expect(violationsOn(contentOf(emoji.repeat(2000)), slack)).toStrictEqual(
      []
    );
    expect(violationsOn(contentOf("&".repeat(800)), slack)).toStrictEqual([]);
    expect(violationsOn(contentOf("&".repeat(801)), slack)).toStrictEqual([
      {
        _tag: "textTooLong",
        ...slack,
        length: 4005,
        maximum: 4000,
        unit: "escapedUtf16Units",
      },
    ]);
  });

  it("holds a text with images to 3,000 units, a section block's", () => {
    expect(
      violationsOn(contentOf("a".repeat(3000), { media: [image] }), slack)
    ).toStrictEqual([]);
    expect(
      violationsOn(contentOf("a".repeat(3001), { media: [image] }), slack)
    ).toStrictEqual([
      {
        _tag: "textTooLong",
        ...slack,
        length: 3001,
        maximum: 3000,
        unit: "escapedUtf16Units",
      },
    ]);
  });

  it("checks an edit against the limit of what the part holds", () => {
    expect(
      tags(
        editViolationsOn({
          channel: slack,
          content: contentOf("A synthetic post", { media: [image] }),
          options: Option.none(),
          part: 0,
          text: "a".repeat(3001),
        })
      )
    ).toStrictEqual(["textTooLong"]);
    expect(
      editViolationsOn({
        channel: slack,
        content: contentOf("A synthetic post"),
        options: Option.none(),
        part: 0,
        text: "a".repeat(3001),
      })
    ).toStrictEqual([]);
  });

  it("takes text alone and images alone, ten at most", () => {
    expect(
      violationsOn(contentOf("", { media: ids(10) }), slack)
    ).toStrictEqual([]);
    expect(
      tags(violationsOn(contentOf("", { media: ids(11) }), slack))
    ).toContain("tooManyMedia");
  });

  it("takes PNG, JPEG and GIF images, the image block's types, and no video", () => {
    expect(
      mediaViolationsOn(contentOf("", { media: [image, other] }), slack, [
        mediaFile(image, { contentType: "image/png" }),
        mediaFile(other, { contentType: "image/gif" }),
      ])
    ).toStrictEqual([]);
    expect(
      tags(
        mediaViolationsOn(contentOf("", { media: [image, other] }), slack, [
          mediaFile(image, { contentType: "image/webp" }),
          mediaFile(other, {
            contentType: "video/mp4",
            dimensions: Option.some({ height: 1920, width: 1080 }),
            duration: Option.some(Duration.seconds(30)),
          }),
        ])
      )
    ).toStrictEqual(["mediaTypeUnsupported", "mediaTypeUnsupported"]);
  });

  it("holds each image to Peal's 50 MiB", () => {
    expect(
      tags(
        mediaViolationsOn(contentOf("", { media: [image] }), slack, [
          mediaFile(image, { byteSize: 50 * mebibyte + 1 }),
        ])
      )
    ).toStrictEqual(["mediaTooLarge"]);
  });

  it("shows alt text of 1,000 characters, and takes a thread of parts", () => {
    expect(platformRules.slack.media?.showsAltText).toBeTruthy();
    expect(platformRules.slack.media?.maxAltTextLength).toBe(1000);
    expect(platformRules.slack.followUps?.kind).toBe("thread");
  });

  it("previews a part with images against 3,000, and a text alone against 4,000", () => {
    expect(
      previewOn(
        contentOf("A synthetic text", { media: [image] }),
        slack,
        []
      ).textCounts.map(({ maximum }) => maximum)
    ).toStrictEqual([3000]);
    expect(
      previewOn(contentOf("A synthetic text"), slack, []).textCounts.map(
        ({ maximum }) => maximum
      )
    ).toStrictEqual([4000]);
  });
});

describe(SlackOptions, () => {
  it("needs nothing, and unfurls no link when left out", () => {
    expect(new SlackOptions({}).problems()).toStrictEqual([]);
    expect(
      Schema.decodeUnknownSync(SlackOptions)({
        platform: "slack",
        unfurlLinks: true,
      })
    ).toStrictEqual(new SlackOptions({ unfurlLinks: true }));
    expect(describeOptionsOn("slack").map(({ name }) => name)).toStrictEqual([
      "unfurlLinks",
    ]);
    expect(SlackOptions.notes.unfurlLinks.ifLeftOut).toBeFalsy();
  });
});
