import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  CompositionAllowanceReached,
  CompositionBusy,
  CompositionNeedsPayment,
  CompositionUnavailable,
  PlanLimitReached,
  SlideshowRequestRejected,
} from "peal-contract";
import type { Media, Slideshow } from "peal-contract";

import {
  fitsVoiceover,
  isSlideImage,
  isSlideshowSettingsRefusal,
  isVoiceover,
  moved,
  removed,
  secondsPerSlideOf,
  slideOf,
  slideshowFailureKey,
  slideshowProblemOf,
  slideshowRequestOf,
  slideshowsEndedSince,
  slideshowsOnTheWay,
  totalSecondsOf,
  withPicked,
} from "#assistant/slideshows.ts";
import type { SlideDraft } from "#assistant/slideshows.ts";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const media = (
  id: string,
  overrides: Partial<Pick<Media, "contentType" | "durationMs" | "kind">> = {}
): Media => ({
  aiGenerated: false,
  altText: null,
  byteSize: 1000,
  codec: null,
  contentType: "image/jpeg",
  createdAt: at,
  dimensions: null,
  durationMs: null,
  fileName: null,
  id,
  kind: "image",
  pageCount: null,
  status: { _tag: "ready" },
  updatedAt: at,
  url: null,
  ...overrides,
});

const slides = (count: number): readonly SlideDraft[] =>
  Array.from({ length: count }, (_, index) => slideOf(media(`image-${index}`)));

const voiceover = media("voice", {
  contentType: "audio/mpeg",
  durationMs: 24_000,
  kind: "audio",
});

const job = (id: string, status: Slideshow["status"]): Slideshow => ({
  aspect: "portrait",
  createdAt: at,
  durationSeconds: 12,
  finishedAt: null,
  id,
  imageMediaIds: ["image-0", "image-1"],
  mediaId: null,
  reason: status === "failed" ? "refused" : null,
  sandbox: false,
  startedAt: null,
  status,
  voiceoverMediaId: null,
});

describe("what the slide video dialog takes", () => {
  it("takes JPEG and PNG images, and audio of a known length", () => {
    expect(isSlideImage(media("a"))).toBeTruthy();
    expect(isSlideImage(media("b", { contentType: "image/png" }))).toBeTruthy();
    expect(isSlideImage(media("c", { contentType: "image/webp" }))).toBeFalsy();
    expect(
      isSlideImage(media("d", { contentType: "video/mp4", kind: "video" }))
    ).toBeFalsy();
  });

  it("takes audio of a known length as the voice-over", () => {
    expect(isVoiceover(voiceover)).toBeTruthy();
    expect(
      isVoiceover(media("e", { contentType: "audio/mpeg", kind: "audio" }))
    ).toBeFalsy();
  });

  it("adds picked images at the end, once each, ten at most", () => {
    const two = withPicked([], [media("a"), media("b")]);

    expect(two.map((slide) => slide.media.id)).toStrictEqual(["a", "b"]);
    expect(
      withPicked(two, [media("b"), media("c")]).map((slide) => slide.media.id)
    ).toStrictEqual(["a", "b", "c"]);
    expect(withPicked(slides(9), [media("x"), media("y")])).toHaveLength(10);
  });

  it("moves a slide up or down, and removes one", () => {
    const three = slides(3);

    expect(moved(three, 0, 1).map((slide) => slide.media.id)).toStrictEqual([
      "image-1",
      "image-0",
      "image-2",
    ]);
    expect(moved(three, 0, -1)).toBe(three);
    expect(moved(three, 2, 1)).toBe(three);
    expect(removed(three, 1).map((slide) => slide.media.id)).toStrictEqual([
      "image-0",
      "image-2",
    ]);
  });

  it("shows each slide for the length chosen, the voice-over's share, or 4 seconds", () => {
    expect(
      secondsPerSlideOf({ secondsPerSlide: 6, slides: slides(3), voiceover })
    ).toBe(6);
    expect(
      secondsPerSlideOf({ secondsPerSlide: null, slides: slides(3), voiceover })
    ).toBe(8);
    expect(
      secondsPerSlideOf({
        secondsPerSlide: null,
        slides: slides(3),
        voiceover: null,
      })
    ).toBe(4);
    expect(
      totalSecondsOf({
        secondsPerSlide: 10,
        slides: slides(3),
        voiceover: null,
      })
    ).toBe(30);
  });

  it("says why it cannot be asked yet", () => {
    expect(
      slideshowProblemOf({ secondsPerSlide: 4, slides: slides(1), voiceover })
    ).toBe("tooFewSlides");
    expect(
      slideshowProblemOf({
        secondsPerSlide: 10,
        slides: slides(10),
        voiceover: null,
      })
    ).toBe("tooLong");
    expect(
      slideshowProblemOf({
        secondsPerSlide: null,
        slides: slides(2),
        voiceover,
      })
    ).toBe("fitTooLong");
    expect(
      slideshowProblemOf({
        secondsPerSlide: null,
        slides: slides(10),
        voiceover: media("short", {
          contentType: "audio/mpeg",
          durationMs: 10_000,
          kind: "audio",
        }),
      })
    ).toBe("fitTooShort");
    expect(
      slideshowProblemOf({
        secondsPerSlide: null,
        slides: slides(4),
        voiceover,
      })
    ).toBeNull();
  });

  it("fits the slides to a voice-over only when each would last a length it takes", () => {
    const short = media("short", {
      contentType: "audio/wav",
      durationMs: 3000,
      kind: "audio",
    });

    // 24 s over 4 slides: 6 s each.
    expect(fitsVoiceover(slides(4), voiceover)).toBeTruthy();
    // 24 s over 2 slides: 12 s each, past the most.
    expect(fitsVoiceover(slides(2), voiceover)).toBeFalsy();
    // 3 s over 2 slides: 1.5 s each, under the least.
    expect(fitsVoiceover(slides(2), short)).toBeFalsy();
    // No slide yet: fitted, the line saying so once they come.
    expect(fitsVoiceover([], short)).toBeTruthy();
  });

  it("sends captions, motions, the length and the voice-over only when given", () => {
    const [first, second] = slides(2);

    expect(
      slideshowRequestOf({
        aspect: "portrait",
        secondsPerSlide: 5,
        slides: [
          first ?? slideOf(media("a")),
          {
            ...(second ?? slideOf(media("b"))),
            caption: "  A synthetic caption ",
            motion: "zoomIn",
          },
        ],
        transition: "fade",
        voiceover: null,
      })
    ).toStrictEqual({
      aspect: "portrait",
      secondsPerSlide: 5,
      slides: [
        { mediaId: "image-0" },
        {
          caption: "A synthetic caption",
          mediaId: "image-1",
          motion: "zoomIn",
        },
      ],
      transition: "fade",
    });
    expect(
      slideshowRequestOf({
        aspect: "square",
        secondsPerSlide: null,
        slides: slides(2),
        transition: "none",
        voiceover,
      })
    ).toStrictEqual({
      aspect: "square",
      slides: [{ mediaId: "image-0" }, { mediaId: "image-1" }],
      transition: "none",
      voiceoverMediaId: "voice",
    });
  });
});

describe("the slide videos on their way", () => {
  it("keeps the queued and running ones, and finds those that ended since", () => {
    const jobs = [job("a", "queued"), job("b", "running"), job("c", "failed")];

    expect(slideshowsOnTheWay(jobs).map(({ id }) => id)).toStrictEqual([
      "a",
      "b",
    ]);
    expect(
      slideshowsEndedSince(new Set(["a", "c"]), [
        job("a", "succeeded"),
        job("c", "failed"),
        job("d", "failed"),
      ]).map(({ id }) => id)
    ).toStrictEqual(["a", "c"]);
  });

  it("says why no slide video was asked for", () => {
    expect(
      slideshowFailureKey(new CompositionUnavailable({ reason: "notSet" }))
    ).toBe("unavailable");
    expect(
      slideshowFailureKey(
        new CompositionUnavailable({ reason: "keyUnreadable" })
      )
    ).toBe("keyUnreadable");
  });

  it("says a payment method, a turn or the day's count is missing", () => {
    const resetsAt = at;

    expect(
      slideshowFailureKey(
        new CompositionNeedsPayment({ billingUrl: "https://example.com" })
      )
    ).toBe("payment");
    expect(slideshowFailureKey(new CompositionBusy({ slideshowId: "a" }))).toBe(
      "busy"
    );
    expect(
      slideshowFailureKey(
        new CompositionAllowanceReached({ dailyLimit: 20, resetsAt })
      )
    ).toBe("allowance");
  });

  it("says what of the request or the storage was refused", () => {
    expect(
      slideshowFailureKey(
        new SlideshowRequestRejected({ reason: "imageNotSupported" })
      )
    ).toBe("imageNotSupported");
    expect(
      slideshowFailureKey(
        new PlanLimitReached({
          allowed: 1,
          billingUrl: "https://example.com",
          limit: "mediaStorage",
          plan: "free",
          planWithRoom: "payAsYouGo",
          used: 1,
        })
      )
    ).toBe("storage");
    expect(slideshowFailureKey({ _tag: "Unexpected" })).toBe("generic");
  });

  it("links the settings only for the service's own refusals", () => {
    expect(
      isSlideshowSettingsRefusal(
        new CompositionUnavailable({ reason: "notSet" })
      )
    ).toBeTruthy();
    expect(
      isSlideshowSettingsRefusal(new CompositionBusy({ slideshowId: "a" }))
    ).toBeFalsy();
  });
});
