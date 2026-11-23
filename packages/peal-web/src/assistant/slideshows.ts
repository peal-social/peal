import { Match } from "effect";
import {
  defaultSecondsPerSlide,
  maxSecondsPerSlide,
  maxSlides,
  maxSlideshowSeconds,
  minSecondsPerSlide,
  minSlides,
} from "peal-contract";
import type {
  CompositionAllowanceReached,
  CompositionBusy,
  CompositionNeedsPayment,
  CompositionUnavailable,
  Forbidden,
  ImageAspect,
  Media,
  PlanLimitReached,
  SlideMotion,
  Slideshow,
  SlideshowRequest,
  SlideshowRequestRejected,
  SlideTransition,
  TooManyRequests,
  Unauthenticated,
  WorkspaceNotFound,
} from "peal-contract";

// What the slide video dialog holds, the request it sends, and how a
// refusal reads.

/** The aspects a slide video is offered in, in the order the dialog lists them. */
export const slideshowAspects: readonly ImageAspect[] = [
  "portrait",
  "landscape",
  "square",
];

/** The motions a slide may have, in the order the dialog lists them. */
export const slideMotions: readonly SlideMotion[] = [
  "none",
  "zoomIn",
  "zoomOut",
  "slide",
];

/** The transitions between slides, in the order the dialog lists them. */
export const slideTransitions: readonly SlideTransition[] = ["fade", "none"];

/** The lengths a slide may show for, in whole seconds, shortest first. */
export const slideSeconds: readonly number[] = Array.from(
  { length: maxSecondsPerSlide - minSecondsPerSlide + 1 },
  (_, index) => minSecondsPerSlide + index
);

/** Whether a file of the library may be a slide: a ready JPEG or PNG. */
export const isSlideImage = (
  media: Pick<Media, "contentType" | "kind">
): boolean =>
  media.kind === "image" &&
  (media.contentType === "image/jpeg" || media.contentType === "image/png");

/** Whether a file of the library may be the voice-over: ready audio of a known length. */
export const isVoiceover = (
  media: Pick<Media, "durationMs" | "kind">
): boolean => media.kind === "audio" && media.durationMs !== null;

/** One slide as the dialog keeps it. */
export interface SlideDraft {
  readonly caption: string;
  readonly media: Media;
  readonly motion: SlideMotion;
}

/** A new slide for an image picked: no caption, no motion. */
export const slideOf = (media: Media): SlideDraft => ({
  caption: "",
  media,
  motion: "none",
});

/**
 * The slides with images picked added at the end, those already there
 * left as they are, `maxSlides` at most.
 */
export const withPicked = (
  slides: readonly SlideDraft[],
  picked: readonly Media[]
): readonly SlideDraft[] =>
  [
    ...slides,
    ...picked.flatMap((media) =>
      slides.some((slide) => slide.media.id === media.id)
        ? []
        : [slideOf(media)]
    ),
  ].slice(0, maxSlides);

/** The slides with the one at `index` moved by `by` (-1 up, 1 down). */
export const moved = (
  slides: readonly SlideDraft[],
  index: number,
  by: -1 | 1
): readonly SlideDraft[] => {
  const target = index + by;
  const slide = slides[index];
  const other = slides[target];

  if (slide === undefined || other === undefined) {
    return slides;
  }

  return slides.map((each, at) => {
    if (at === index) {
      return other;
    }

    return at === target ? slide : each;
  });
};

/** The slides without the one at `index`. */
export const removed = (
  slides: readonly SlideDraft[],
  index: number
): readonly SlideDraft[] => slides.filter((_, at) => at !== index);

/** What the dialog chose: `secondsPerSlide` null to fit the voice-over. */
export interface SlideshowChoice {
  readonly aspect: ImageAspect;
  readonly secondsPerSlide: number | null;
  readonly slides: readonly SlideDraft[];
  readonly transition: SlideTransition;
  readonly voiceover: Media | null;
}

/**
 * How long each slide shows, in seconds: the length chosen, else the
 * voice-over's shared between the slides, else the default.
 */
export const secondsPerSlideOf = ({
  secondsPerSlide,
  slides,
  voiceover,
}: Pick<
  SlideshowChoice,
  "secondsPerSlide" | "slides" | "voiceover"
>): number => {
  if (secondsPerSlide !== null) {
    return secondsPerSlide;
  }

  const heard = voiceover?.durationMs ?? null;

  if (heard !== null && slides.length > 0) {
    return heard / 1000 / slides.length;
  }

  return defaultSecondsPerSlide;
};

/** How long the slide video lasts, in seconds. */
export const totalSecondsOf = (
  choice: Pick<SlideshowChoice, "secondsPerSlide" | "slides" | "voiceover">
): number => secondsPerSlideOf(choice) * choice.slides.length;

/**
 * Why the slide video cannot be asked for yet, or null when it can: too
 * few slides, too long in all, or slides fitted to the voice-over that
 * would be too short or too long each.
 */
export type SlideshowProblem =
  | "fitTooLong"
  | "fitTooShort"
  | "tooFewSlides"
  | "tooLong";

export const slideshowProblemOf = (
  choice: Pick<SlideshowChoice, "secondsPerSlide" | "slides" | "voiceover">
): SlideshowProblem | null => {
  if (choice.slides.length < minSlides) {
    return "tooFewSlides";
  }

  const each = secondsPerSlideOf(choice);
  const fitted = choice.secondsPerSlide === null && choice.voiceover !== null;

  if (fitted && each < minSecondsPerSlide) {
    return "fitTooShort";
  }

  if (fitted && each > maxSecondsPerSlide) {
    return "fitTooLong";
  }

  return totalSecondsOf(choice) > maxSlideshowSeconds ? "tooLong" : null;
};

/**
 * Whether picking this voice-over should fit the slides to it: only when
 * each slide would then last an allowed length, or before any slide is
 * chosen. Otherwise the length chosen stays, rather than a choice the
 * dialog would refuse at once.
 */
export const fitsVoiceover = (
  slides: readonly SlideDraft[],
  voiceover: Media
): boolean => {
  if (slides.length === 0) {
    return true;
  }

  const problem = slideshowProblemOf({
    secondsPerSlide: null,
    slides,
    voiceover,
  });

  return problem !== "fitTooShort" && problem !== "fitTooLong";
};

/**
 * The request the dialog sends: a caption only where one is written, a
 * motion only where one is chosen, the length only when chosen (none
 * fits the voice-over, or takes the server's default), the voice-over
 * only when picked.
 */
export const slideshowRequestOf = ({
  aspect,
  secondsPerSlide,
  slides,
  transition,
  voiceover,
}: SlideshowChoice): SlideshowRequest => {
  const request: SlideshowRequest = {
    aspect,
    slides: slides.map(({ caption, media, motion }) => {
      const written = caption.trim();
      const withMotion = motion === "none" ? {} : { motion };

      return written === ""
        ? { mediaId: media.id, ...withMotion }
        : { caption: written, mediaId: media.id, ...withMotion };
    }),
    transition,
  };

  const length = secondsPerSlide === null ? {} : { secondsPerSlide };
  const voice = voiceover === null ? {} : { voiceoverMediaId: voiceover.id };

  return { ...request, ...length, ...voice };
};

/** Whether a job is still on its way: queued or being composed. */
export const isOnItsWay = (job: Pick<Slideshow, "status">): boolean =>
  job.status === "queued" || job.status === "running";

/** The jobs still on their way, newest first as the list answers them. */
export const slideshowsOnTheWay = (
  jobs: readonly Slideshow[]
): readonly Slideshow[] => jobs.filter(isOnItsWay);

/**
 * The jobs that were on their way (`before`, their ids) and have ended in
 * the latest list: what the library tells the member about, once each.
 */
export const slideshowsEndedSince = (
  before: ReadonlySet<string>,
  jobs: readonly Slideshow[]
): readonly Slideshow[] =>
  jobs.filter((job) => before.has(job.id) && !isOnItsWay(job));

/** Why a slide video was not asked for, as the API declares it. */
export type SlideshowFailure =
  | CompositionAllowanceReached
  | CompositionBusy
  | CompositionNeedsPayment
  | CompositionUnavailable
  | Forbidden
  | PlanLimitReached
  | SlideshowRequestRejected
  | TooManyRequests
  | Unauthenticated
  | WorkspaceNotFound
  // The request failed in a way the API does not declare.
  | { readonly _tag: "Unexpected" };

/** The message of `Assistant.slideshows.errors` that says why. */
export type SlideshowFailureKey =
  | SlideshowRequestRejected["reason"]
  | "allowance"
  | "busy"
  | "forbidden"
  | "generic"
  | "keyUnreadable"
  | "payment"
  | "storage"
  | "unavailable";

/** Which message tells the member why no slide video was asked for. */
export const slideshowFailureKey = (
  failure: SlideshowFailure
): SlideshowFailureKey =>
  Match.valueTags(failure, {
    CompositionAllowanceReached: (): SlideshowFailureKey => "allowance",
    CompositionBusy: (): SlideshowFailureKey => "busy",
    CompositionNeedsPayment: (): SlideshowFailureKey => "payment",
    CompositionUnavailable: ({ reason }): SlideshowFailureKey =>
      reason === "notSet" ? "unavailable" : "keyUnreadable",
    Forbidden: (): SlideshowFailureKey => "forbidden",
    PlanLimitReached: (): SlideshowFailureKey => "storage",
    SlideshowRequestRejected: ({ reason }): SlideshowFailureKey => reason,
    TooManyRequests: (): SlideshowFailureKey => "generic",
    Unauthenticated: (): SlideshowFailureKey => "generic",
    Unexpected: (): SlideshowFailureKey => "generic",
    WorkspaceNotFound: (): SlideshowFailureKey => "generic",
  });

/** Whether the refusal is the service's settings, to fix in the assistant settings. */
export const isSlideshowSettingsRefusal = (
  failure: SlideshowFailure
): boolean => failure._tag === "CompositionUnavailable";
