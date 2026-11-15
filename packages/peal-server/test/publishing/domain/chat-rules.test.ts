import { describe, expect, it } from "@effect/vitest";
import { Duration, Option } from "effect";

import {
  mediaViolationsOn,
  violationsOn,
} from "#publishing/domain/content-rules.ts";
import type { ChannelOnPlatform } from "#publishing/domain/content-rules.ts";
import { editViolationsOn } from "#publishing/domain/live-post-edit.ts";
import type { MediaFile } from "#publishing/domain/media-file.ts";
import { platformRules } from "#publishing/domain/platform-rules.ts";
import { ChannelIdSchema, MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import { contentOf, mediaFile } from "#test/publishing/support.ts";

const mebibyte = 1024 * 1024;

const discord: ChannelOnPlatform = {
  channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000d01"),
  platform: "discord",
};

const telegram: ChannelOnPlatform = {
  channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000d02"),
  platform: "telegram",
};

const ids = (count: number): readonly MediaAssetId[] =>
  Array.from({ length: count }, (_, index) =>
    MediaAssetIdSchema.make(
      `00000000-0000-7000-8000-${(index + 0xa_00).toString(16).padStart(12, "0")}`
    )
  );

const image = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000b001");

const clip = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000b002");

const other = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000b003");

const fourth = MediaAssetIdSchema.make("00000000-0000-7000-8000-00000000b004");

// An emoji outside the Basic Multilingual Plane: two UTF-16 units.
const emoji = "\u{1F600}";

const tags = (violations: readonly { readonly _tag: string }[]) =>
  violations.map(({ _tag }) => _tag);

const video = (mediaId: MediaAssetId, byteSize = 10 * mebibyte): MediaFile =>
  mediaFile(mediaId, {
    byteSize,
    contentType: "video/mp4",
    dimensions: Option.some({ height: 1920, width: 1080 }),
    duration: Option.some(Duration.seconds(30)),
  });

describe("Discord's rules", () => {
  it("takes 2,000 UTF-16 units of text, an emoji counting two", () => {
    expect(violationsOn(contentOf("a".repeat(2000)), discord)).toStrictEqual(
      []
    );
    expect(violationsOn(contentOf(emoji.repeat(1000)), discord)).toStrictEqual(
      []
    );
    expect(
      violationsOn(contentOf(`${emoji.repeat(1000)}a`), discord)
    ).toStrictEqual([
      {
        _tag: "textTooLong",
        ...discord,
        length: 2001,
        maximum: 2000,
        unit: "utf16Units",
      },
    ]);
  });

  it("takes text alone and media alone, ten files at most", () => {
    expect(
      violationsOn(contentOf("", { media: ids(1) }), discord)
    ).toStrictEqual([]);
    expect(
      tags(
        violationsOn(contentOf("A synthetic post", { media: ids(11) }), discord)
      )
    ).toStrictEqual(["tooManyMedia"]);
  });

  it("takes images and videos together, each of 20 MiB at most", () => {
    const files = [mediaFile(image), video(clip)];

    expect(
      mediaViolationsOn(contentOf("", { media: [image, clip] }), discord, files)
    ).toStrictEqual([]);

    const tooLarge = video(other, 20 * mebibyte + 1);

    expect(
      mediaViolationsOn(contentOf("", { media: [other] }), discord, [tooLarge])
    ).toStrictEqual([
      {
        _tag: "mediaTooLarge",
        ...discord,
        byteSize: 20 * mebibyte + 1,
        maximum: 20 * mebibyte,
        mediaId: other,
      },
    ]);
  });

  it("refuses files that weigh more than 25 MiB together", () => {
    const fits = [video(image, 15 * mebibyte), video(clip, 10 * mebibyte)];

    expect(
      mediaViolationsOn(contentOf("", { media: [image, clip] }), discord, fits)
    ).toStrictEqual([]);

    const over = [video(image, 15 * mebibyte), video(clip, 10 * mebibyte + 1)];

    expect(
      mediaViolationsOn(contentOf("", { media: [image, clip] }), discord, over)
    ).toStrictEqual([
      {
        _tag: "mediaTotalTooLarge",
        ...discord,
        maximum: 25 * mebibyte,
        total: 25 * mebibyte + 1,
      },
    ]);
  });

  it("keeps alt text of 1,024 characters", () => {
    expect(platformRules.discord.media?.maxAltTextLength).toBe(1024);
    expect(platformRules.discord.media?.showsAltText).toBeTruthy();
  });

  it("takes a thread of parts", () => {
    expect(platformRules.discord.followUps?.kind).toBe("thread");
  });
});

describe("Telegram's rules", () => {
  it("takes 4,096 UTF-16 units of text alone", () => {
    expect(violationsOn(contentOf("a".repeat(4096)), telegram)).toStrictEqual(
      []
    );
    expect(
      violationsOn(contentOf(`${emoji.repeat(2048)}a`), telegram)
    ).toStrictEqual([
      {
        _tag: "textTooLong",
        ...telegram,
        length: 4097,
        maximum: 4096,
        unit: "utf16Units",
      },
    ]);
  });

  it("holds a text with media to 1,024 UTF-16 units, its caption", () => {
    expect(
      violationsOn(contentOf("a".repeat(1024), { media: [image] }), telegram)
    ).toStrictEqual([]);
    expect(
      violationsOn(contentOf(emoji.repeat(512), { media: [image] }), telegram)
    ).toStrictEqual([]);
    expect(
      violationsOn(contentOf("a".repeat(1025), { media: [image] }), telegram)
    ).toStrictEqual([
      {
        _tag: "textTooLong",
        ...telegram,
        length: 1025,
        maximum: 1024,
        unit: "utf16Units",
      },
    ]);
  });

  it("checks an edit of a caption against 1,024, and of a text against 4,096", () => {
    expect(
      tags(
        editViolationsOn({
          channel: telegram,
          content: contentOf("A synthetic post", { media: [image] }),
          options: Option.none(),
          part: 0,
          text: "a".repeat(1025),
        })
      )
    ).toStrictEqual(["textTooLong"]);
    expect(
      editViolationsOn({
        channel: telegram,
        content: contentOf("A synthetic post"),
        options: Option.none(),
        part: 0,
        text: "a".repeat(1025),
      })
    ).toStrictEqual([]);
  });

  it("refuses a photo whose sides add up to more than 10,000 pixels", () => {
    const photo = (width: number, height: number) =>
      mediaFile(image, { dimensions: Option.some({ height, width }) });

    expect(
      mediaViolationsOn(contentOf("", { media: [image] }), telegram, [
        photo(5000, 5000),
      ])
    ).toStrictEqual([]);
    expect(
      mediaViolationsOn(contentOf("", { media: [image] }), telegram, [
        photo(5001, 5000),
      ])
    ).toStrictEqual([
      {
        _tag: "sideSumTooLarge",
        ...telegram,
        height: 5000,
        maximum: 10_000,
        mediaId: image,
        width: 5001,
      },
    ]);
  });

  it("refuses a photo of a ratio past 20 either way", () => {
    expect(
      tags(
        mediaViolationsOn(contentOf("", { media: [image] }), telegram, [
          mediaFile(image, {
            dimensions: Option.some({ height: 100, width: 2001 }),
          }),
        ])
      )
    ).toStrictEqual(["aspectRatioUnsupported"]);
  });

  it("sends a GIF alone", () => {
    expect(
      tags(
        mediaViolationsOn(contentOf("", { media: [other, image] }), telegram, [
          mediaFile(other, { contentType: "image/gif" }),
          mediaFile(image),
        ])
      )
    ).toStrictEqual(["tooManyMedia"]);
  });

  it("takes an album of photos and videos, and refuses WebP and QuickTime", () => {
    expect(
      mediaViolationsOn(contentOf("", { media: [image, clip] }), telegram, [
        mediaFile(image),
        video(clip),
      ])
    ).toStrictEqual([]);
    expect(
      tags(
        mediaViolationsOn(contentOf("", { media: [other, fourth] }), telegram, [
          mediaFile(other, { contentType: "image/webp" }),
          mediaFile(fourth, { contentType: "video/quicktime" }),
        ])
      )
    ).toStrictEqual(["mediaTypeUnsupported", "mediaTypeUnsupported"]);
  });

  it("shows no alt text, and takes a thread of parts", () => {
    expect(platformRules.telegram.media?.showsAltText).toBeFalsy();
    expect(platformRules.telegram.followUps?.kind).toBe("thread");
  });
});
