"use client";

import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import {
  AudioLinesIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ImageAspect, Media, SlideTransition } from "peal-contract";
import { buttonVariants } from "peal-ui/components/button";
import { cn } from "peal-ui/lib/utils";
import type { ReactNode } from "react";

import type { SlideDraft } from "#assistant/slideshows.ts";
import { useMediaName } from "#components/media/media-preview.tsx";
import { MediaThumbnail } from "#components/media/media-thumbnail.tsx";
import { aspectClasses, clipAt, clockOf, frameOf } from "#studio/timeline.ts";
import type { Clip } from "#studio/timeline.ts";

// The editor's parts, each drawn from what it is handed: the stage, the
// transport, the timeline's tracks. The screen holds the state.

/**
 * The stage: the frame in the video's shape, the clip at the playhead
 * with its motion, its fade and its caption, as the export draws them.
 * Paused, the clip shows whole, without its fade, so it can be seen
 * while it is edited.
 */
export const StageView = ({
  aspect,
  clips,
  empty,
  playing,
  slides,
  time,
  transition,
}: {
  readonly aspect: ImageAspect;
  readonly clips: readonly Clip[];
  /** What the stage shows before any image is added. */
  readonly empty: ReactNode;
  readonly playing: boolean;
  readonly slides: readonly SlideDraft[];
  readonly time: number;
  readonly transition: SlideTransition;
}) => {
  const clip = clipAt(clips, time);
  const slide = clip === null ? undefined : slides[clip.index];

  const frame =
    clip === null || slide === undefined
      ? null
      : frameOf(clip, time, slide.motion, playing ? transition : "none");

  // The motion and the fade change every frame, so they ride on variables.
  const moving =
    frame === null
      ? undefined
      : {
          "--stage-opacity": String(frame.opacity),
          "--stage-scale": String(frame.scale),
          "--stage-shift": `${String(frame.shift * 100)}%`,
        };

  return (
    <div className="bg-muted flex min-h-64 items-center justify-center rounded-lg border p-4 sm:p-6">
      <div
        className={cn(
          "bg-foreground relative max-h-[52dvh] w-full overflow-hidden rounded-md shadow-sm",
          aspectClasses[aspect],
          aspect === "portrait" && "max-w-[min(100%,calc(52dvh*9/16))]",
          aspect === "square" && "max-w-[min(100%,52dvh)]"
        )}
        style={moving}
      >
        {slide === undefined || slide.media.url === null ? (
          <div className="text-background absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
            {empty}
          </div>
        ) : (
          <div className="absolute inset-0 opacity-(--stage-opacity)">
            <div className="absolute inset-0 translate-x-(--stage-shift) scale-(--stage-scale)">
              <Image
                src={slide.media.url}
                alt={slide.media.altText ?? ""}
                fill
                unoptimized
                sizes="(min-width: 1024px) 48rem, 100vw"
                className="object-cover"
              />
            </div>
            {slide.caption.trim() === "" ? null : (
              <p
                dir="auto"
                className="bg-foreground/60 text-background absolute inset-x-[7%] bottom-[6%] rounded-md px-3 py-2 text-center text-sm font-semibold text-balance sm:text-base"
              >
                {slide.caption}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const transportButton = buttonVariants({ size: "icon-sm", variant: "ghost" });

/**
 * The transport under the stage: back a clip, play or pause, on a clip,
 * the time, and the playhead to drag along the video.
 */
export const TransportView = ({
  disabled,
  duration,
  onPlay,
  onSeek,
  onStep,
  playing,
  time,
}: {
  readonly disabled: boolean;
  readonly duration: number;
  readonly onPlay: () => void;
  readonly onSeek: (time: number) => void;
  readonly onStep: (by: -1 | 1) => void;
  readonly playing: boolean;
  readonly time: number;
}) => {
  const t = useTranslations("Studio.transport");

  return (
    <div className="flex items-center gap-3">
      <Toolbar aria-label={t("label")} className="flex items-center gap-0.5">
        <ToolbarButton
          aria-label={t("previous")}
          className={transportButton}
          disabled={disabled}
          onClick={() => {
            onStep(-1);
          }}
        >
          <SkipBackIcon aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          aria-label={playing ? t("pause") : t("play")}
          className={transportButton}
          disabled={disabled}
          onClick={onPlay}
        >
          {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        </ToolbarButton>
        <ToolbarButton
          aria-label={t("next")}
          className={transportButton}
          disabled={disabled}
          onClick={() => {
            onStep(1);
          }}
        >
          <SkipForwardIcon aria-hidden />
        </ToolbarButton>
      </Toolbar>
      <Slider
        className="min-w-0 flex-1"
        value={time}
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        largeStep={1}
        disabled={disabled}
        format={(value) => t("at", { time: clockOf(value) })}
        onValueChange={(value: number) => {
          onSeek(value);
        }}
      >
        <SliderControl className="relative flex h-6 w-full cursor-pointer touch-none items-center select-none data-[disabled]:cursor-default">
          <SliderTrack className="bg-border relative h-1 w-full rounded-full">
            <SliderIndicator className="bg-primary rounded-full" />
            <SliderThumb
              aria-label={t("playhead")}
              className="bg-background border-primary has-[:focus-visible]:outline-ring/50 top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 shadow-sm outline-none has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2"
            />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
        {clockOf(time)} / {clockOf(duration)}
      </span>
    </div>
  );
};

// A track's row: its name in a column of its own, then its clips.
const TrackRow = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => (
  <div className="flex items-stretch gap-3">
    <span className="text-muted-foreground flex w-20 shrink-0 items-center text-xs font-medium sm:w-24">
      {label}
    </span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

/**
 * The timeline: the captions over the images, the images as clips to
 * choose (one tab stop, arrow keys between them), the voice-over under
 * them, and the playhead across all three.
 */
export const TimelineView = ({
  clips,
  duration,
  onSelect,
  selected,
  slides,
  time,
  voiceover,
}: {
  readonly clips: readonly Clip[];
  readonly duration: number;
  readonly onSelect: (id: string | null) => void;
  readonly selected: string | null;
  readonly slides: readonly SlideDraft[];
  readonly time: number;
  readonly voiceover: Media | null;
}) => {
  const t = useTranslations("Studio.timeline");
  const nameOf = useMediaName();

  const playhead = {
    "--playhead": `${String(duration === 0 ? 0 : (time / duration) * 100)}%`,
  };

  return (
    <div className="flex flex-col gap-2">
      <TrackRow label={t("captions")}>
        <div aria-hidden className="flex gap-1">
          {slides.map((slide) => (
            <span
              key={slide.media.id}
              dir="auto"
              className={cn(
                "flex h-7 min-w-0 flex-1 items-center rounded-sm px-2 text-xs",
                slide.caption.trim() === ""
                  ? "border border-dashed"
                  : "bg-brand-tint text-foreground"
              )}
            >
              <span className="truncate">{slide.caption}</span>
            </span>
          ))}
        </div>
      </TrackRow>
      <TrackRow label={t("images")}>
        <div className="relative">
          <Listbox
            aria-label={t("images")}
            orientation="horizontal"
            loop={false}
            value={selected}
            onValueChange={(value: string | null) => {
              onSelect(value);
            }}
            className="flex gap-1 rounded-md outline-none"
          >
            {slides.map((slide, index) => (
              <ListboxItem
                key={slide.media.id}
                value={slide.media.id}
                aria-label={t("clip", {
                  name: nameOf(slide.media),
                  position: index + 1,
                })}
                className="bg-muted data-[highlighted]:ring-ring/50 data-[selected]:ring-primary relative h-14 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-sm outline-none data-[highlighted]:ring-3 data-[selected]:ring-2"
              >
                <MediaThumbnail media={slide.media} sizes="8rem" />
                <span className="bg-background/90 absolute top-1 left-1 rounded-sm px-1 font-mono text-xs tabular-nums">
                  {index + 1}
                </span>
              </ListboxItem>
            ))}
          </Listbox>
          {clips.length === 0 ? null : (
            <span
              aria-hidden
              style={playhead}
              className="bg-primary pointer-events-none absolute -top-10 -bottom-10 left-(--playhead) w-0.5 -translate-x-1/2 rounded-full"
            />
          )}
        </div>
      </TrackRow>
      <TrackRow label={t("voiceover")}>
        {voiceover === null ? (
          <span className="text-muted-foreground flex h-7 items-center rounded-sm border border-dashed px-2 text-xs">
            {t("noVoiceover")}
          </span>
        ) : (
          <span className="bg-lavender/30 flex h-7 min-w-0 items-center gap-1.5 rounded-sm px-2 text-xs">
            <AudioLinesIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{nameOf(voiceover)}</span>
          </span>
        )}
      </TrackRow>
    </div>
  );
};
