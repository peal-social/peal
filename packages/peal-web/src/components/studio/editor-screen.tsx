"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClapperboardIcon,
  DownloadIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  maxSlideCaptionLength,
  maxSlides,
  maxSlideshowSeconds,
} from "peal-contract";
import type {
  AssistantStatus,
  ImageAspect,
  Media,
  SlideTransition,
} from "peal-contract";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { Skeleton } from "peal-ui/components/skeleton";
import { Textarea } from "peal-ui/components/textarea";
import { toast } from "peal-ui/components/toast";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import {
  assistantStatus,
  createSlideshow,
  slideshowsKey,
} from "#assistant/api.ts";
import {
  fitsVoiceover,
  isSlideImage,
  isSlideshowSettingsRefusal,
  isVoiceover,
  moved,
  removed,
  slideMotions,
  slideSeconds,
  slideshowAspects,
  slideshowFailureKey,
  slideshowProblemOf,
  slideshowRequestOf,
  slideTransitions,
  withPicked,
} from "#assistant/slideshows.ts";
import type { SlideDraft, SlideshowFailure } from "#assistant/slideshows.ts";
import { slideshowsNeedPayment } from "#billing/upgrade.ts";
import { useUpgradePrompt } from "#components/billing/upgrade-prompt.tsx";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { SlideshowJobs } from "#components/media/generate-slideshow.tsx";
import { useMediaName } from "#components/media/media-preview.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { MediaPicker } from "#components/posts/media-picker.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { failureOf } from "#posts/outcome.ts";
import {
  clampedTime,
  clipAt,
  clipsOf,
  durationOf,
  steppedClip,
} from "#studio/timeline.ts";

import { StageView, TimelineView, TransportView } from "./editor-parts.tsx";

interface EditorProps {
  /** The member may change the assistant's settings (assistant:configure). */
  readonly mayConfigure: boolean;
  readonly workspaceId: string;
}

const unexpected = (): SlideshowFailure => ({ _tag: "Unexpected" });

// The length select's value that fits the clips to the voice-over.
const fit = "fit";

// A link inside a sentence, in ink.
const inkLink = (href: string, chunks: ReactNode) => (
  <Link className="text-foreground underline underline-offset-4" href={href}>
    {chunks}
  </Link>
);

// A labelled select of the inspector, its options named by `nameOf`.
const ChoiceField = <Value extends string>({
  disabled,
  label,
  nameOf,
  onChange,
  options,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly nameOf: (value: Value) => string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly Value[];
  readonly value: Value;
}) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(chosen: string | null) => {
          const found = options.find((each) => each === chosen);

          if (found !== undefined) {
            onChange(found);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{nameOf(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((each) => (
            <SelectItem key={each} value={each}>
              {nameOf(each)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// One section of the inspector, under a small heading.
const InspectorSection = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <section className="flex flex-col gap-3 border-b p-4 last:border-b-0">
    <h2 className="text-sm font-medium">{title}</h2>
    {children}
  </section>
);

// The chosen clip: its caption, its motion, its place, or its removal.
const ClipInspector = ({
  disabled,
  index,
  onChange,
  onMove,
  onRemove,
  slide,
  total,
}: {
  readonly disabled: boolean;
  readonly index: number;
  readonly onChange: (slide: SlideDraft) => void;
  readonly onMove: (by: -1 | 1) => void;
  readonly onRemove: () => void;
  readonly slide: SlideDraft;
  readonly total: number;
}) => {
  const t = useTranslations("Studio.inspector");
  const slideshows = useTranslations("Assistant.slideshows");
  const nameOf = useMediaName();
  const captionId = useId();
  const position = index + 1;

  return (
    <InspectorSection title={t("clip", { position, total })}>
      <p className="text-muted-foreground truncate text-xs">
        {nameOf(slide.media)}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={captionId}>{t("caption")}</Label>
        <Textarea
          id={captionId}
          dir="auto"
          rows={2}
          maxLength={maxSlideCaptionLength}
          placeholder={t("captionPlaceholder")}
          disabled={disabled}
          value={slide.caption}
          onChange={(event) => {
            onChange({ ...slide, caption: event.target.value });
          }}
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("captionCount", {
            count: slide.caption.length,
            max: maxSlideCaptionLength,
          })}
        </p>
      </div>
      <ChoiceField
        disabled={disabled}
        label={t("motion")}
        options={slideMotions}
        value={slide.motion}
        nameOf={(motion) => slideshows("motions", { motion })}
        onChange={(motion) => {
          onChange({ ...slide, motion });
        }}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || index === 0}
          onClick={() => {
            onMove(-1);
          }}
        >
          <ArrowLeftIcon aria-hidden data-icon="inline-start" />
          {t("earlier")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || index === total - 1}
          onClick={() => {
            onMove(1);
          }}
        >
          <ArrowRightIcon aria-hidden data-icon="inline-start" />
          {t("later")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden data-icon="inline-start" />
          {t("remove")}
        </Button>
      </div>
    </InspectorSection>
  );
};

// Plays the timeline: the playhead moves with the clock, the voice-over
// with it, and both stop at the end.
const usePlayback = (duration: number, voiceover: Media | null) => {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    const sound = audio.current;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const next = clock.current + (now - last) / 1000;

      last = now;

      if (next >= duration) {
        clock.current = duration;
        setTime(duration);
        setPlaying(false);

        return;
      }

      clock.current = next;
      setTime(next);
      frame = requestAnimationFrame(tick);
    };

    if (playing) {
      if (sound !== null) {
        sound.currentTime = clock.current;
        sound.play().catch(() => {
          // The browser may refuse sound; the pictures play on.
        });
      }

      frame = requestAnimationFrame(tick);
    } else {
      sound?.pause();
    }

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, duration]);

  const seek = (to: number) => {
    const at = clampedTime(to, duration);

    clock.current = at;
    setTime(at);

    if (audio.current !== null) {
      audio.current.currentTime = at;
    }
  };

  const toggle = () => {
    if (!playing && clock.current >= duration) {
      seek(0);
    }

    setPlaying(!playing);
  };

  const sound =
    voiceover?.url === null || voiceover === null ? null : (
      <audio ref={audio} src={voiceover.url} preload="auto" className="hidden">
        <track kind="captions" />
      </audio>
    );

  return {
    pause: () => {
      setPlaying(false);
    },
    playing,
    seek,
    sound,
    time: clampedTime(time, duration),
    toggle,
  };
};

// The editor itself, once the workspace composes videos.
const Editor = ({
  mayConfigure,
  status,
  workspaceId,
}: EditorProps & { readonly status: AssistantStatus }) => {
  const t = useTranslations("Studio");
  const slideshows = useTranslations("Assistant.slideshows");
  const images = useTranslations("Assistant.images");
  const format = useFormatter();
  const workspaceHref = useWorkspaceHref();
  const nameOf = useMediaName();
  const create = useAtomSet(createSlideshow, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  const [slides, setSlides] = useState<readonly SlideDraft[]>([]);
  const [voiceover, setVoiceover] = useState<Media | null>(null);
  const [aspect, setAspect] = useState<ImageAspect>("portrait");
  const [transition, setTransition] = useState<SlideTransition>("fade");
  const [length, setLength] = useState("4");
  const [selected, setSelected] = useState<string | null>(null);
  const [failure, setFailure] = useState<SlideshowFailure | null>(null);
  const [sending, startTransition] = useTransition();

  const choice = {
    aspect,
    secondsPerSlide: length === fit ? null : Number(length),
    slides,
    transition,
    voiceover,
  };

  const clips = clipsOf(choice);
  const duration = durationOf(clips);
  const problem = slideshowProblemOf(choice);
  const playback = usePlayback(duration, voiceover);
  const selectedIndex = slides.findIndex(({ media }) => media.id === selected);
  const selectedSlide = slides[selectedIndex];

  const select = (id: string | null) => {
    setSelected(id);

    const clip = clips.find((each) => each.id === id);

    if (clip !== undefined) {
      playback.pause();
      playback.seek(clip.start);
    }
  };

  const step = (by: -1 | 1) => {
    const clip = steppedClip(clips, playback.time, by);

    if (clip !== null) {
      setSelected(clip.id);
      playback.seek(clip.start);
    }
  };

  const changeSlides = (next: readonly SlideDraft[]) => {
    setSlides(next);
    setFailure(null);
  };

  const exportVideo = () => {
    setFailure(null);
    playback.pause();

    startTransition(async () => {
      const exit = await create({
        params: { workspaceId },
        payload: slideshowRequestOf(choice),
        reactivityKeys: [slideshowsKey(workspaceId)],
      });

      refreshStatus();
      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        toast.success(t("exportedToast"));

        return;
      }

      setFailure(Option.getOrElse(failureOf(exit), unexpected));
    });
  };

  const failureText = (shown: SlideshowFailure) =>
    slideshows(`errors.${slideshowFailureKey(shown)}`, {
      dailyLimit:
        shown._tag === "CompositionAllowanceReached" ? shown.dailyLimit : 0,
      resetsAt:
        shown._tag === "CompositionAllowanceReached"
          ? format.dateTime(DateTime.toDate(shown.resetsAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "",
    });

  const addImages = (
    <MediaPicker
      accepts={isSlideImage}
      attached={slides.map(({ media }) => media.id)}
      disabled={sending || slides.length >= maxSlides}
      room={maxSlides - slides.length}
      texts={{
        attach: slideshows("addImages"),
        description: slideshows("pickImagesDescription"),
        open: t("addImages"),
        title: slideshows("pickImagesTitle"),
      }}
      workspaceId={workspaceId}
      onPick={(picked) => {
        const next = withPicked(slides, picked);

        changeSlides(next);

        if (selected === null) {
          setSelected(next[0]?.media.id ?? null);
        }
      }}
    />
  );

  const lengthName = (value: string) =>
    value === fit
      ? slideshows("fit")
      : slideshows("seconds", { seconds: Number(value) });

  return (
    <div className="flex flex-col gap-4">
      <PageActions>
        <Button
          size="sm"
          variant="ghost"
          disabled={problem !== null || sending}
          onClick={exportVideo}
        >
          <DownloadIcon aria-hidden />
          {sending ? t("exporting") : t("export")}
        </Button>
      </PageActions>
      {playback.sound}
      {status.slideshows.sandbox ? (
        <Alert>
          <AlertTitle>{slideshows("sandbox")}</AlertTitle>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <StageView
            aspect={aspect}
            clips={clips}
            playing={playback.playing}
            slides={slides}
            time={playback.time}
            transition={transition}
            empty={
              <span className="flex flex-col items-center gap-1">
                <span className="font-medium">{t("stageEmpty")}</span>
                <span className="opacity-70">
                  {t("stageEmptyHint", { max: maxSlides })}
                </span>
              </span>
            }
          />
          <TransportView
            disabled={clips.length === 0}
            duration={duration}
            playing={playback.playing}
            time={playback.time}
            onPlay={() => {
              playback.toggle();
            }}
            onSeek={(to) => {
              playback.seek(to);
              setSelected(clipAt(clips, to)?.id ?? null);
            }}
            onStep={(by) => {
              step(by);
            }}
          />
        </div>
        <aside
          aria-label={t("inspector.label")}
          className="flex flex-col rounded-lg border"
        >
          {selectedSlide === undefined ? null : (
            <ClipInspector
              disabled={sending}
              index={selectedIndex}
              slide={selectedSlide}
              total={slides.length}
              onChange={(changed) => {
                changeSlides(
                  slides.map((each, at) =>
                    at === selectedIndex ? changed : each
                  )
                );
              }}
              onMove={(by) => {
                changeSlides(moved(slides, selectedIndex, by));
              }}
              onRemove={() => {
                const next = removed(slides, selectedIndex);

                changeSlides(next);
                setSelected(
                  next[Math.min(selectedIndex, next.length - 1)]?.media.id ??
                    null
                );
              }}
            />
          )}
          <InspectorSection title={t("inspector.video")}>
            <ChoiceField
              disabled={sending}
              label={slideshows("aspect")}
              options={slideshowAspects}
              value={aspect}
              nameOf={(each) => images("aspects", { aspect: each })}
              onChange={setAspect}
            />
            <ChoiceField
              disabled={sending}
              label={slideshows("length")}
              options={[
                ...(voiceover === null ? [] : [fit]),
                ...slideSeconds.map(String),
              ]}
              value={length}
              nameOf={lengthName}
              onChange={setLength}
            />
            <ChoiceField
              disabled={sending}
              label={slideshows("transition")}
              options={slideTransitions}
              value={transition}
              nameOf={(each) => slideshows("transitions", { transition: each })}
              onChange={setTransition}
            />
          </InspectorSection>
          <InspectorSection title={t("inspector.export")}>
            <p className="text-muted-foreground text-sm">
              {t("summary", {
                clips: slides.length,
                max: maxSlideshowSeconds,
                total: Math.round(duration * 10) / 10,
              })}{" "}
              {slideshows("remaining", {
                remaining: status.slideshows.remaining,
              })}
            </p>
            <div aria-live="polite" className="flex flex-col gap-2">
              {problem === null || slides.length === 0 ? null : (
                <p className="text-destructive text-sm">
                  {slideshows(`problems.${problem}`, {
                    max: maxSlideshowSeconds,
                  })}
                </p>
              )}
              {failure === null ? null : (
                <Alert variant="destructive">
                  <AlertTitle>{failureText(failure)}</AlertTitle>
                  {mayConfigure && isSlideshowSettingsRefusal(failure) ? (
                    <Link
                      className="text-sm underline"
                      href={workspaceHref(workspaceId, "/settings/assistant")}
                    >
                      {slideshows("providerSettings")}
                    </Link>
                  ) : null}
                </Alert>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {t.rich("exportHint", {
                media: (chunks) =>
                  inkLink(workspaceHref(workspaceId, "/media"), chunks),
              })}
            </p>
          </InspectorSection>
        </aside>
      </div>
      <section
        aria-labelledby="studio-timeline"
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="studio-timeline" className="mr-auto text-sm font-medium">
            {t("timeline.title")}
          </h2>
          {addImages}
          <MediaPicker
            accepts={isVoiceover}
            attached={voiceover === null ? [] : [voiceover.id]}
            disabled={sending}
            room={1}
            texts={{
              attach: slideshows("useVoiceover"),
              description: slideshows("pickVoiceoverDescription"),
              open:
                voiceover === null ? t("addVoiceover") : t("replaceVoiceover"),
              title: slideshows("pickVoiceoverTitle"),
            }}
            workspaceId={workspaceId}
            onPick={(picked) => {
              const chosen = picked[0] ?? null;

              playback.pause();
              setVoiceover(chosen);
              setFailure(null);

              if (chosen !== null && fitsVoiceover(slides, chosen)) {
                setLength(fit);
              }
            }}
          />
          {voiceover === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sending}
              aria-label={t("removeVoiceover", { name: nameOf(voiceover) })}
              onClick={() => {
                playback.pause();
                setVoiceover(null);
                setLength("4");
              }}
            >
              {slideshows("clearVoiceover")}
            </Button>
          )}
        </div>
        {slides.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
            {t("timeline.empty")}
          </p>
        ) : (
          <TimelineView
            clips={clips}
            duration={duration}
            selected={selected}
            slides={slides}
            time={playback.time}
            voiceover={voiceover}
            onSelect={select}
          />
        )}
      </section>
      <SlideshowJobs workspaceId={workspaceId} />
    </div>
  );
};

// Without a payment method on a server that bills, the editor says so and
// opens the upgrade dialog.
const NeedsPayment = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("Studio.needsPayment");
  const prompt = useUpgradePrompt();

  return (
    <EmptyState>
      <EmptyStateIcon icon={<ClapperboardIcon />} />
      <EmptyStateTitle>{t("title")}</EmptyStateTitle>
      <EmptyStateDescription>{t("description")}</EmptyStateDescription>
      <EmptyStateActions>
        <Button
          onClick={() => {
            prompt(slideshowsNeedPayment, workspaceId);
          }}
        >
          {t("action")}
        </Button>
      </EmptyStateActions>
    </EmptyState>
  );
};

// Before the workspace chose a service to compose with.
const NotConnected = ({ mayConfigure, workspaceId }: EditorProps) => {
  const t = useTranslations("Studio.notConnected");
  const workspaceHref = useWorkspaceHref();

  return (
    <EmptyState>
      <EmptyStateIcon icon={<ClapperboardIcon />} />
      <EmptyStateTitle>{t("title")}</EmptyStateTitle>
      <EmptyStateDescription>
        {mayConfigure ? t("description") : t("askAnOwner")}
      </EmptyStateDescription>
      {mayConfigure ? (
        <EmptyStateActions>
          <Link
            href={workspaceHref(workspaceId, "/settings/assistant")}
            className={buttonVariants()}
          >
            {t("action")}
          </Link>
        </EmptyStateActions>
      ) : null}
    </EmptyState>
  );
};

// The editor's state for the workspace's status: loading, not connected,
// waiting for a payment method, or the editor itself.
const LoadedEditor = (props: EditorProps) => {
  const t = useTranslations("Studio");
  const result = useAtomValue(assistantStatus(props.workspaceId));
  const status = AsyncResult.value(result);

  if (Option.isNone(status)) {
    return AsyncResult.isFailure(result) ? (
      <Alert variant="destructive">
        <AlertTitle>{t("loadFailed")}</AlertTitle>
      </Alert>
    ) : (
      <Skeleton className="h-96 w-full" />
    );
  }

  const { slideshows } = status.value;

  if (!slideshows.available) {
    return <NotConnected {...props} />;
  }

  return slideshows.paymentMethodRequired ? (
    <NeedsPayment workspaceId={props.workspaceId} />
  ) : (
    <Editor {...props} status={status.value} />
  );
};

/**
 * The Studio's editor (DESIGN.md, "The editor"): images of the library
 * laid out on a timeline, each with its caption and motion, over an
 * optional voice-over, previewed on a stage in the video's shape, and
 * exported as a slide video the workspace's own Shotstack account
 * renders into the media library. Render it for members with
 * assistant:use and media:upload. The status it starts from needs the
 * visitor's cookies, so it is read once the page has hydrated.
 */
export const EditorScreen = (props: EditorProps) =>
  useHydrated() ? (
    <LoadedEditor {...props} />
  ) : (
    <Skeleton className="h-96 w-full" />
  );
