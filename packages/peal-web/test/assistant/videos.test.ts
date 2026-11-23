import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  AssistantInputRejected,
  VideoAllowanceReached,
  VideoBusy,
  VideoRequestRejected,
  VideoUnavailable,
} from "peal-contract";
import type { VideoGeneration } from "peal-contract";
import { aiVideoProviders } from "peal-contract/ai-providers";

import {
  endedSince,
  isVideoSettingsRefusal,
  onTheWay,
  videoAspectsOf,
  videoDurationsOf,
  videoFailureKey,
  videoOfferOf,
  videoRequestOf,
} from "#assistant/videos.ts";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const job = (
  id: string,
  status: VideoGeneration["status"]
): VideoGeneration => ({
  aspect: "landscape",
  createdAt: at,
  durationSeconds: null,
  finishedAt: null,
  id,
  imageMediaId: null,
  mediaId: null,
  reason: status === "failed" ? "refused" : null,
  startedAt: null,
  status,
});

describe("what the video dialog offers", () => {
  it("reads the chosen provider's offer, none without one", () => {
    expect(videoOfferOf({ provider: "xai" })).toBe(aiVideoProviders.xai);
    expect(videoOfferOf({ provider: null })).toBeNull();
    // A provider that makes no videos offers none.
    expect(videoOfferOf({ provider: "anthropic" })).toBeNull();
  });

  it("offers only the aspects the provider makes", () => {
    expect(videoAspectsOf(aiVideoProviders.google)).toStrictEqual([
      "landscape",
      "portrait",
    ]);
    expect(videoAspectsOf(aiVideoProviders.xai)).toStrictEqual([
      "landscape",
      "portrait",
      "square",
    ]);
  });

  it("offers the lengths the provider takes, none where it picks", () => {
    expect(videoDurationsOf(aiVideoProviders.google)).toStrictEqual([]);

    const lengths = videoDurationsOf(aiVideoProviders.xai);

    expect(lengths[0]).toBe(1);
    expect(lengths.at(-1)).toBe(15);
    expect(lengths).toHaveLength(15);
  });
});

describe("the videos on their way", () => {
  it("keeps the queued and running ones", () => {
    expect(
      onTheWay([
        job("a", "queued"),
        job("b", "running"),
        job("c", "succeeded"),
        job("d", "failed"),
      ]).map(({ id }) => id)
    ).toStrictEqual(["a", "b"]);
  });

  it("finds those that ended since the last read, once", () => {
    const before = new Set(["a", "b"]);

    const now = [
      job("a", "succeeded"),
      job("b", "running"),
      job("c", "failed"),
    ];

    expect(endedSince(before, now).map(({ id }) => id)).toStrictEqual(["a"]);
    expect(endedSince(new Set(), now)).toStrictEqual([]);
  });
});

describe(videoRequestOf, () => {
  it("sends a length and a first frame only when chosen", () => {
    const asked = { aspect: "square", prompt: "A synthetic harbour" } as const;

    expect(
      videoRequestOf({ ...asked, durationSeconds: null, imageMediaId: null })
    ).toStrictEqual(asked);
    expect(
      videoRequestOf({ ...asked, durationSeconds: 5, imageMediaId: null })
    ).toStrictEqual({ ...asked, durationSeconds: 5 });
    expect(
      videoRequestOf({ ...asked, durationSeconds: null, imageMediaId: "m" })
    ).toStrictEqual({ ...asked, imageMediaId: "m" });
    expect(
      videoRequestOf({ ...asked, durationSeconds: 8, imageMediaId: "m" })
    ).toStrictEqual({ ...asked, durationSeconds: 8, imageMediaId: "m" });
  });
});

describe(videoFailureKey, () => {
  it("says why no video was asked for", () => {
    const resetsAt = DateTime.makeUnsafe("2026-11-23T00:00:00Z");

    expect(
      [
        new VideoUnavailable({ reason: "notSet" }),
        new VideoUnavailable({ reason: "keyUnreadable" }),
        new VideoBusy({ generationId: "a" }),
        new VideoAllowanceReached({ dailyLimit: 20, resetsAt }),
        new VideoRequestRejected({ reason: "durationNotOffered" }),
        new VideoRequestRejected({ reason: "imageNotFound" }),
        new AssistantInputRejected({ maxLength: 1000, reason: "empty" }),
        { _tag: "Unexpected" } as const,
      ].map(videoFailureKey)
    ).toStrictEqual([
      "unavailable",
      "keyUnreadable",
      "busy",
      "allowance",
      "durationNotOffered",
      "imageNotFound",
      "empty",
      "generic",
    ]);
  });

  it("links the settings only for the provider's own refusals", () => {
    expect(
      isVideoSettingsRefusal(new VideoUnavailable({ reason: "keyUnreadable" }))
    ).toBeTruthy();
    expect(
      isVideoSettingsRefusal(new VideoBusy({ generationId: "a" }))
    ).toBeFalsy();
  });
});
