import { describe, expect, it } from "@effect/vitest";
import { PostContentInvalid } from "peal-contract";

import {
  chosenOptionsCount,
  copiedOptions,
  copiesOptions,
  missingRequired,
  refusedChannelsOf,
  violationsOf,
} from "#posts/option-rows.ts";
import { initialValues } from "#posts/target-options.ts";

describe(copiesOptions, () => {
  it("gives a platform's options to its other channels", () => {
    expect(copiesOptions("instagram")).toBeTruthy();
    expect(copiesOptions("youtube")).toBeTruthy();
  });

  it("never TikTok's, which each creator's account limits", () => {
    expect(copiesOptions("tiktok")).toBeFalsy();
  });
});

describe(copiedOptions, () => {
  it("copies every field but those the account holds of its own", () => {
    expect(
      copiedOptions(
        "pinterest",
        { boardId: "board-a", link: "https://example.com/a", title: "A pin" },
        { boardId: "board-b", title: "Its own" }
      )
    ).toStrictEqual({
      boardId: "board-b",
      link: "https://example.com/a",
      title: "A pin",
    });
  });

  it("keeps a library file the other channel has", () => {
    expect(
      copiedOptions(
        "youtube",
        {
          ...initialValues("youtube"),
          thumbnailMediaId: "media-a",
          title: "T",
        },
        { ...initialValues("youtube"), thumbnailMediaId: "media-b" }
      )
    ).toMatchObject({ thumbnailMediaId: "media-b", title: "T" });
  });

  it("starts from a new channel's values when the other has none", () => {
    expect(
      copiedOptions("youtube", { madeForKids: false, title: "T" }, undefined)
    ).toMatchObject({ madeForKids: false, title: "T" });
  });
});

describe(chosenOptionsCount, () => {
  it("counts the fields holding something a new post does not start with", () => {
    expect(chosenOptionsCount("youtube", undefined)).toBe(0);
    expect(chosenOptionsCount("youtube", initialValues("youtube"))).toBe(0);
    expect(
      chosenOptionsCount("youtube", {
        ...initialValues("youtube"),
        madeForKids: false,
        title: "Field notes",
      })
    ).toBe(2);
  });

  it("leaves out a field emptied again", () => {
    expect(chosenOptionsCount("mastodon", { contentWarning: "" })).toBe(0);
  });
});

describe(missingRequired, () => {
  it("names the fields YouTube needs that are still empty", () => {
    expect(missingRequired("youtube", undefined, undefined)).toStrictEqual([
      "youtube.title",
      "youtube.madeForKids",
    ]);
    expect(
      missingRequired(
        "youtube",
        { ...initialValues("youtube"), madeForKids: false, title: "T" },
        undefined
      )
    ).toStrictEqual([]);
  });

  it("names Pinterest's board until one is chosen", () => {
    expect(missingRequired("pinterest", {}, undefined)).toStrictEqual([
      "pinterest.board",
    ]);
    expect(
      missingRequired("pinterest", { boardId: "board-a" }, undefined)
    ).toStrictEqual([]);
  });

  it("names nothing on a platform that needs nothing", () => {
    expect(missingRequired("mastodon", undefined, undefined)).toStrictEqual([]);
  });
});

describe(refusedChannelsOf, () => {
  const refusal = new PostContentInvalid({
    message: "Synthetic refusal",
    violations: [
      {
        _tag: "optionMissing",
        channelId: "youtube-1",
        field: "title",
        platform: "youtube",
      },
      {
        _tag: "optionMissing",
        channelId: "youtube-1",
        field: "madeForKids",
        platform: "youtube",
      },
      {
        _tag: "optionInvalid",
        channelId: "pinterest-1",
        field: "link",
        platform: "pinterest",
      },
      { _tag: "noChannels" },
    ],
  });

  it("names each channel whose options were refused, once", () => {
    expect(refusedChannelsOf(refusal)).toStrictEqual([
      "youtube-1",
      "pinterest-1",
    ]);
    expect(violationsOf(refusal)).toHaveLength(4);
  });

  it("names none without a refusal of the content", () => {
    expect(refusedChannelsOf(null)).toStrictEqual([]);
    expect(refusedChannelsOf({ _tag: "Unexpected" })).toStrictEqual([]);
    expect(violationsOf(null)).toStrictEqual([]);
  });
});
