"use client";

import {
  Listbox,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
} from "@ui-sdk/react/listbox";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import {
  AudioLinesIcon,
  CaptionsIcon,
  FilmIcon,
  ImageIcon,
  PentagonIcon,
  SquareDashedIcon,
  Trash2Icon,
  TypeIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "peal-ui/components/button";
import { cn } from "peal-ui/lib/utils";
import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import type { ClipKind, ClipView } from "#studio/edit-document.ts";
import {
  movedStart,
  rulerOf,
  snapTargetsOf,
  trackAfterDrag,
  trimmed,
  zoomSteps,
} from "#studio/timeline-geometry.ts";
import type { Edge } from "#studio/timeline-geometry.ts";

// The editor's timeline, drawn from the engine's document: a ruler that
// seeks, the tracks (the first on top, as the video layers them), each
// clip where it sits, moved and trimmed with the pointer or the keyboard,
// and the playhead across them.

const kindIcons: Readonly<Record<ClipKind, LucideIcon>> = {
  audio: AudioLinesIcon,
  caption: CaptionsIcon,
  image: ImageIcon,
  other: SquareDashedIcon,
  figure: PentagonIcon,
  text: TypeIcon,
  video: FilmIcon,
};

const kindClasses: Readonly<Record<ClipKind, string>> = {
  audio: "bg-sun/30",
  caption: "bg-lavender/40",
  image: "bg-brand-tint",
  other: "bg-muted",
  figure: "bg-brand-tint/50",
  text: "bg-lavender/40",
  video: "bg-lavender/20",
};

// A track's row, in pixels: the vertical drag reads whole rows.
const rowPixels = 48;

// Which way an arrow key moves a chosen clip.
const arrowSteps: ReadonlyMap<string, -1 | 1> = new Map([
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
]);

const iconButton = buttonVariants({ size: "icon-sm", variant: "ghost" });

/** What the timeline asks the editor to do. */
export interface TimelineActions {
  readonly onDelete: (clipId: string) => void;
  readonly onDeleteTrack: (trackIndex: number) => void;
  readonly onMove: (clipId: string, trackIndex: number, start: number) => void;
  readonly onSeek: (time: number) => void;
  readonly onSelect: (clipId: string | null) => void;
  readonly onTrim: (clipId: string, start: number, length: number) => void;
  readonly onZoom: (zoom: number) => void;
}

interface Drag {
  readonly clip: ClipView;
  readonly edge: Edge | null;
  readonly x: number;
  readonly y: number;
}

interface Ghost {
  readonly id: string;
  readonly length: number;
  readonly start: number;
  readonly trackIndex: number;
}

/** The timeline: its tracks, its clips and the playhead. */
export const StudioTimeline = ({
  actions,
  disabled,
  duration,
  failed,
  labelOf,
  selected,
  time,
  tracks,
  zoom,
}: {
  readonly actions: TimelineActions;
  readonly disabled: boolean;
  readonly duration: number;
  readonly failed: ReadonlySet<string>;
  /** What a clip is called: its file's name, or its words. */
  readonly labelOf: (clip: ClipView) => string;
  readonly selected: string | null;
  readonly time: number;
  readonly tracks: readonly (readonly ClipView[])[];
  /** The index in `zoomSteps`. */
  readonly zoom: number;
}) => {
  const t = useTranslations("Studio.timeline");
  const pixelsPerSecond = zoomSteps[zoom] ?? zoomSteps[0];
  const drag = useRef<Drag | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const clips = tracks.flat();
  const ruler = rulerOf(pixelsPerSecond, duration);
  const width = (ruler.marks.at(-1) ?? 0) * pixelsPerSecond;

  const ghostOf = (clip: ClipView, event: PointerEvent): Ghost => {
    const start = drag.current;

    if (start === null) {
      return { ...clip };
    }

    const delta = (event.clientX - start.x) / pixelsPerSecond;
    const targets = snapTargetsOf(clips, clip.id, time);

    if (start.edge !== null) {
      return {
        ...clip,
        ...trimmed(clip, start.edge, delta, targets, pixelsPerSecond),
      };
    }

    return {
      ...clip,
      start: movedStart(clip, delta, targets, pixelsPerSecond),
      trackIndex: trackAfterDrag(
        clip.trackIndex,
        event.clientY - start.y,
        rowPixels,
        tracks.length
      ),
    };
  };

  const pressed = (
    clip: ClipView,
    edge: Edge | null,
    event: PointerEvent<HTMLElement>
  ) => {
    if (disabled || event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { clip, edge, x: event.clientX, y: event.clientY };
    actions.onSelect(clip.id);
  };

  const dragged = (clip: ClipView, event: PointerEvent) => {
    if (drag.current?.clip.id === clip.id) {
      setGhost(ghostOf(clip, event));
    }
  };

  const released = (clip: ClipView, event: PointerEvent) => {
    if (drag.current?.clip.id !== clip.id) {
      return;
    }

    const moved = ghostOf(clip, event);
    const { edge } = drag.current;

    drag.current = null;
    setGhost(null);

    if (edge !== null) {
      if (moved.start !== clip.start || moved.length !== clip.length) {
        actions.onTrim(clip.id, moved.start, moved.length);
      }

      return;
    }

    if (moved.start !== clip.start || moved.trackIndex !== clip.trackIndex) {
      actions.onMove(clip.id, moved.trackIndex, moved.start);
    }
  };

  // The ruler seeks where it is pressed, and follows the pointer.
  const seekAt = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();

    actions.onSeek(Math.max(0, (event.clientX - box.left) / pixelsPerSecond));
  };

  const keyed = (event: KeyboardEvent) => {
    if (selected === null || disabled) {
      return;
    }

    const clip = clips.find(({ id }) => id === selected);

    if (clip === undefined) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      actions.onDelete(clip.id);

      return;
    }

    const by = arrowSteps.get(event.key) ?? 0;

    if (by === 0 || !event.altKey) {
      return;
    }

    event.preventDefault();

    const step = event.shiftKey ? 1 : 0.1;

    if (event.metaKey || event.ctrlKey) {
      actions.onTrim(
        clip.id,
        clip.start,
        Math.max(0.1, clip.length + by * step)
      );
    } else {
      actions.onMove(
        clip.id,
        clip.trackIndex,
        Math.max(0, clip.start + by * step)
      );
    }
  };

  const shown = (clip: ClipView): ClipView =>
    ghost?.id === clip.id ? { ...clip, ...ghost } : clip;

  return (
    <section
      aria-labelledby="studio-timeline"
      className="flex flex-col rounded-lg border"
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <h2 id="studio-timeline" className="mr-auto text-sm font-medium">
          {t("title")}
        </h2>
        <Toolbar aria-label={t("tools")} className="flex items-center gap-0.5">
          <ToolbarButton
            aria-label={t("zoomOut")}
            className={iconButton}
            disabled={zoom === 0}
            onClick={() => {
              actions.onZoom(zoom - 1);
            }}
          >
            <ZoomOutIcon aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            aria-label={t("zoomIn")}
            className={iconButton}
            disabled={zoom === zoomSteps.length - 1}
            onClick={() => {
              actions.onZoom(zoom + 1);
            }}
          >
            <ZoomInIcon aria-hidden />
          </ToolbarButton>
        </Toolbar>
      </div>
      <div className="flex min-w-0">
        <div className="flex w-28 shrink-0 flex-col border-r">
          <div aria-hidden className="h-7 border-b" />
          {tracks.map((_, trackIndex) => (
            <div
              // Tracks have no id of their own; their place names them.
              // oxlint-disable-next-line react/no-array-index-key
              key={trackIndex}
              className="flex h-12 items-center gap-1 border-b pr-1 pl-3 last:border-b-0"
            >
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium">
                {t("track", { position: trackIndex + 1 })}
              </span>
              <button
                type="button"
                aria-label={t("deleteTrack", { position: trackIndex + 1 })}
                className={iconButton}
                disabled={disabled || tracks.length === 1}
                onClick={() => {
                  actions.onDeleteTrack(trackIndex);
                }}
              >
                <Trash2Icon aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div
            className="relative w-(--content) min-w-full"
            style={{ "--content": `${String(width)}px` }}
          >
            <div
              aria-hidden
              className="relative h-7 cursor-pointer touch-none border-b select-none"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekAt(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  seekAt(event);
                }
              }}
            >
              {ruler.marks.map((mark) => {
                const labelled = mark % ruler.labelEvery === 0;

                return (
                  <span
                    key={mark}
                    className={cn(
                      "bg-border absolute bottom-0 left-(--at) w-px",
                      labelled ? "h-3" : "h-1.5"
                    )}
                    style={{ "--at": `${String(mark * pixelsPerSecond)}px` }}
                  >
                    {labelled ? (
                      <span className="text-muted-foreground absolute bottom-3 left-1 font-mono text-xs tabular-nums">
                        {mark >= 60
                          ? `${String(Math.floor(mark / 60))}:${String(mark % 60).padStart(2, "0")}`
                          : `${String(mark)}s`}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
            <Listbox
              aria-label={t("clips")}
              value={selected}
              onValueChange={(value: string | null) => {
                actions.onSelect(value);
              }}
              onKeyDown={keyed}
              className="flex flex-col outline-none"
            >
              {tracks.map((track, trackIndex) => (
                <ListboxGroup
                  // oxlint-disable-next-line react/no-array-index-key
                  key={trackIndex}
                  className="relative h-12 border-b last:border-b-0"
                >
                  <ListboxGroupLabel className="sr-only">
                    {t("track", { position: trackIndex + 1 })}
                  </ListboxGroupLabel>
                  {track.map((clip) => {
                    const at = shown(clip);
                    const Icon = kindIcons[clip.kind];

                    return (
                      <ListboxItem
                        key={clip.id}
                        value={clip.id}
                        aria-label={t("clip", {
                          label: labelOf(clip),
                          length: clip.length,
                          start: clip.start,
                        })}
                        className={cn(
                          "group/clip data-[highlighted]:ring-ring/50 data-[selected]:ring-primary absolute top-1.5 left-(--x) flex h-9 w-(--w) min-w-2 cursor-grab touch-none items-center gap-1.5 overflow-hidden rounded-sm px-2 text-xs outline-none select-none active:cursor-grabbing data-[highlighted]:ring-3 data-[selected]:ring-2",
                          kindClasses[clip.kind],
                          failed.has(clip.id) &&
                            "border-destructive border border-dashed",
                          at.trackIndex !== clip.trackIndex &&
                            "translate-y-(--lift)"
                        )}
                        style={{
                          "--lift": `${String((at.trackIndex - clip.trackIndex) * rowPixels)}px`,
                          "--w": `${String(at.length * pixelsPerSecond)}px`,
                          "--x": `${String(at.start * pixelsPerSecond)}px`,
                        }}
                        onPointerDown={(event: PointerEvent<HTMLElement>) => {
                          pressed(clip, null, event);
                        }}
                        onPointerMove={(event: PointerEvent<HTMLElement>) => {
                          dragged(clip, event);
                        }}
                        onPointerUp={(event: PointerEvent<HTMLElement>) => {
                          released(clip, event);
                        }}
                      >
                        <span
                          aria-hidden
                          className="bg-foreground/30 absolute inset-y-1 left-0 w-1 cursor-ew-resize rounded-full opacity-0 group-hover/clip:opacity-100 group-data-[selected]/clip:opacity-100"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            pressed(clip, "start", event);
                          }}
                          onPointerMove={(event) => {
                            dragged(clip, event);
                          }}
                          onPointerUp={(event) => {
                            released(clip, event);
                          }}
                        />
                        <Icon aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate" dir="auto">
                          {labelOf(clip)}
                        </span>
                        <span
                          aria-hidden
                          className="bg-foreground/30 absolute inset-y-1 right-0 w-1 cursor-ew-resize rounded-full opacity-0 group-hover/clip:opacity-100 group-data-[selected]/clip:opacity-100"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            pressed(clip, "end", event);
                          }}
                          onPointerMove={(event) => {
                            dragged(clip, event);
                          }}
                          onPointerUp={(event) => {
                            released(clip, event);
                          }}
                        />
                      </ListboxItem>
                    );
                  })}
                </ListboxGroup>
              ))}
            </Listbox>
            <span
              aria-hidden
              className="bg-primary pointer-events-none absolute top-0 bottom-0 left-(--playhead) w-0.5 -translate-x-1/2"
              style={{ "--playhead": `${String(time * pixelsPerSecond)}px` }}
            />
          </div>
        </div>
      </div>
      <p className="text-muted-foreground border-t px-3 py-1.5 text-xs">
        {t("keys")}
      </p>
    </section>
  );
};
