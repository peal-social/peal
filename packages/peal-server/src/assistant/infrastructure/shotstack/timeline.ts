import type { CompositionRequest } from "#assistant/application/ports/own-composer.ts";
import type { ImageAspect } from "#assistant/domain/image-aspect.ts";
import type {
  SlideMotion,
  SlideTransition,
} from "#assistant/domain/slideshow.ts";

/**
 * The Edit Shotstack's `POST /render` takes, as its API's definition
 * (`api.edit.json`, read November 2026) names each field: a timeline of
 * tracks, the first drawn on top, each of clips that never overlap, and
 * the output.
 */
export interface ShotstackEdit {
  readonly output: {
    readonly aspectRatio: "1:1" | "16:9" | "9:16";
    readonly destinations: readonly [
      { readonly exclude: true; readonly provider: "shotstack" },
    ];
    readonly format: "mp4";
    readonly fps: 25;
    readonly resolution: "1080";
  };
  readonly timeline: {
    readonly background: string;
    readonly cache: false;
    readonly tracks: readonly ShotstackTrack[];
  };
}

export interface ShotstackTrack {
  readonly clips: readonly ShotstackClip[];
}

/** A clip, with the fields of `Clip` Peal sends. */
export interface ShotstackClip {
  readonly asset: ShotstackAsset;
  readonly effect?: "slideLeft" | "zoomIn" | "zoomOut";
  readonly fit?: "crop";
  readonly height?: number;
  readonly length: number;
  readonly offset?: { readonly x: number; readonly y: number };
  readonly position?: "bottom";
  readonly start: number;
  readonly transition?: { readonly in: "fade"; readonly out: "fade" };
  readonly width?: number;
}

export type ShotstackAsset =
  | { readonly src: string; readonly type: "image" }
  | {
      readonly effect: "fadeOut";
      readonly src: string;
      readonly type: "audio";
    }
  | {
      readonly align: {
        readonly horizontal: "center";
        readonly vertical: "middle";
      };
      readonly background: {
        readonly borderRadius: number;
        readonly color: string;
        readonly opacity: number;
      };
      readonly font: {
        readonly color: string;
        readonly family: string;
        readonly size: number;
        readonly weight: number;
      };
      readonly padding: number;
      readonly text: string;
      readonly type: "rich-text";
    };

// The shape asked for each aspect, at 1080p: 1920x1080, 1080x1920 and
// 1080x1080.
const aspectRatios: Readonly<
  Record<ImageAspect, ShotstackEdit["output"]["aspectRatio"]>
> = {
  landscape: "16:9",
  portrait: "9:16",
  square: "1:1",
};

// The frame's pixels, which a caption's box is drawn in.
const frames: Readonly<
  Record<ImageAspect, { readonly height: number; readonly width: number }>
> = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 },
  square: { height: 1080, width: 1080 },
};

// A caption's band: as wide as the frame less its margins, high enough for
// two or three lines, its text in a size the phone a portrait video plays
// on reads.
const captionBands: Readonly<
  Record<ImageAspect, { readonly fontSize: number; readonly height: number }>
> = {
  landscape: { fontSize: 52, height: 240 },
  portrait: { fontSize: 60, height: 360 },
  square: { fontSize: 52, height: 280 },
};

const captionMargin = 80;

// Shotstack's motions: a slow zoom in or out, a slow pan to the left.
const effects: Readonly<
  Record<SlideMotion, ShotstackClip["effect"] | undefined>
> = {
  none: undefined,
  slide: "slideLeft",
  zoomIn: "zoomIn",
  zoomOut: "zoomOut",
};

const transitions: Readonly<
  Record<SlideTransition, ShotstackClip["transition"] | undefined>
> = {
  fade: { in: "fade", out: "fade" },
  none: undefined,
};

type MovingClip = { -readonly [K in keyof ShotstackClip]: ShotstackClip[K] };

// The clip, with its motion and its transition when it has them.
const moving = (
  clip: ShotstackClip,
  effect: ShotstackClip["effect"] | undefined,
  transition: ShotstackClip["transition"] | undefined
): ShotstackClip => {
  const moved: MovingClip = { ...clip };

  if (effect !== undefined) {
    moved.effect = effect;
  }

  if (transition !== undefined) {
    moved.transition = transition;
  }

  return moved;
};

// Milliseconds are as fine as a timeline takes.
const rounded = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/**
 * The Edit of a slide video: the slides' images one after the other, each
 * `secondsPerSlide` long, cropped to fill the frame, with its motion and
 * the transition; above them each caption, in Roboto (a font Shotstack
 * has, so none is hosted), white on a dark translucent band at the
 * bottom; below them the voice-over from the start, cut at the last
 * slide's end. MP4 at 1080p and 25 frames a second. Shotstack is told to
 * keep no hosted copy (the `shotstack` destination excluded) and not to
 * cache the files it fetches (`cache: false`), so only its temporary
 * output link holds the video, which Peal downloads.
 */
export const slideTimelineOf = (request: CompositionRequest): ShotstackEdit => {
  const length = rounded(request.secondsPerSlide);
  const total = rounded(request.secondsPerSlide * request.slides.length);
  const transition = transitions[request.transition];
  const frame = frames[request.aspect];
  const band = captionBands[request.aspect];

  const startOf = (index: number) => rounded(index * request.secondsPerSlide);

  const images: ShotstackClip[] = request.slides.map((slide, index) => {
    const effect = effects[slide.motion];

    return moving(
      {
        asset: { src: slide.imageUrl, type: "image" },
        fit: "crop",
        length,
        start: startOf(index),
      },
      effect,
      transition
    );
  });

  const captions: ShotstackClip[] = request.slides.flatMap((slide, index) =>
    slide.caption === null
      ? []
      : [
          moving(
            {
              asset: {
                align: { horizontal: "center", vertical: "middle" },
                background: {
                  borderRadius: 16,
                  color: "#000000",
                  opacity: 0.6,
                },
                font: {
                  color: "#ffffff",
                  family: "Roboto",
                  size: band.fontSize,
                  weight: 600,
                },
                padding: 24,
                text: slide.caption,
                type: "rich-text",
              },
              height: band.height,
              length,
              offset: { x: 0, y: 0.04 },
              position: "bottom",
              start: startOf(index),
              width: frame.width - captionMargin * 2,
            },
            undefined,
            transition
          ),
        ]
  );

  const voiceover: ShotstackClip[] =
    request.voiceoverUrl === null
      ? []
      : [
          {
            asset: {
              effect: "fadeOut",
              src: request.voiceoverUrl,
              type: "audio",
            },
            length: total,
            start: 0,
          },
        ];

  // The first track is drawn on top: the captions over the images.
  const tracks: ShotstackTrack[] = [
    ...(captions.length === 0 ? [] : [{ clips: captions }]),
    { clips: images },
    ...(voiceover.length === 0 ? [] : [{ clips: voiceover }]),
  ];

  return {
    output: {
      aspectRatio: aspectRatios[request.aspect],
      destinations: [{ exclude: true, provider: "shotstack" }],
      format: "mp4",
      fps: 25,
      resolution: "1080",
    },
    timeline: { background: "#000000", cache: false, tracks },
  };
};
