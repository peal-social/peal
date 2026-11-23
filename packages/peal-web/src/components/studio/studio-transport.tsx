"use client";

import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "peal-ui/components/button";

import { clockOf } from "#studio/timeline-geometry.ts";

const transportButton = buttonVariants({ size: "icon-sm", variant: "ghost" });

/**
 * The transport under the stage: back to the edge before, play or pause,
 * on to the edge after, the playhead to drag along the video, and the
 * time.
 */
export const StudioTransport = ({
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
        value={Math.min(time, Math.max(duration, 0.1))}
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
