"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GalleryHorizontalEndIcon,
  XIcon,
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
  Slideshow,
  SlideTransition,
} from "peal-contract";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "peal-ui/components/dialog";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { toast } from "peal-ui/components/toast";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  assistantStatus,
  createSlideshow,
  slideshows,
  slideshowsKey,
} from "#assistant/api.ts";
import {
  fitsVoiceover,
  isSlideImage,
  isSlideshowSettingsRefusal,
  isVoiceover,
  moved,
  removed,
  secondsPerSlideOf,
  slideMotions,
  slideSeconds,
  slideshowAspects,
  slideshowFailureKey,
  slideshowProblemOf,
  slideshowRequestOf,
  slideshowsEndedSince,
  slideshowsOnTheWay,
  slideTransitions,
  totalSecondsOf,
  withPicked,
} from "#assistant/slideshows.ts";
import type { SlideDraft, SlideshowFailure } from "#assistant/slideshows.ts";
import { slideshowsNeedPayment } from "#billing/upgrade.ts";
import { useUpgradePrompt } from "#components/billing/upgrade-prompt.tsx";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { MediaPicker } from "#components/posts/media-picker.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { libraryChanged } from "#media/atoms.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";
import { failureOf } from "#posts/outcome.ts";

import { useMediaName } from "./media-preview.tsx";
import { SlideshowJobsView } from "./video-jobs-view.tsx";

const unexpected = (): SlideshowFailure => ({ _tag: "Unexpected" });

// The same empty list while the jobs are read, so effects keep still.
const noJobs: readonly Slideshow[] = [];

// The length select's value that fits the slides to the voice-over.
const fit = "fit";

/** How often the library reads its slide videos on their way, while shown. */
export const slideshowPollMillis = 5000;

interface GenerateSlideshowProps {
  /**
   * The member may change the assistant's settings (assistant:configure):
   * a refusal of the service's settings links them there.
   */
  readonly mayConfigure?: boolean;
  readonly workspaceId: string;
}

// One chosen image, as a row (DESIGN.md: chosen images as rows): its
// name, moved up or down, removed, its caption and its motion.
const SlideRow = ({
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
  const t = useTranslations("Assistant.slideshows");
  const nameOf = useMediaName();
  const ids = useId();
  const name = nameOf(slide.media);
  const position = index + 1;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {t("slide", { name, position })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("moveUp", { position })}
          disabled={disabled || index === 0}
          onClick={() => {
            onMove(-1);
          }}
        >
          <ArrowUpIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("moveDown", { position })}
          disabled={disabled || index === total - 1}
          onClick={() => {
            onMove(1);
          }}
        >
          <ArrowDownIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("remove", { position })}
          disabled={disabled}
          onClick={onRemove}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={`${ids}-caption`} className="sr-only">
            {t("captionFor", { position })}
          </Label>
          <Input
            id={`${ids}-caption`}
            dir="auto"
            placeholder={t("caption")}
            maxLength={maxSlideCaptionLength}
            disabled={disabled}
            value={slide.caption}
            onChange={(event) => {
              onChange({ ...slide, caption: event.target.value });
            }}
          />
        </div>
        <Select
          value={slide.motion}
          disabled={disabled}
          onValueChange={(chosen: string | null) => {
            const found = slideMotions.find((each) => each === chosen);

            if (found !== undefined) {
              onChange({ ...slide, motion: found });
            }
          }}
        >
          <SelectTrigger
            aria-label={t("motionFor", { position })}
            className="w-full sm:w-36"
          >
            <SelectValue>{t("motions", { motion: slide.motion })}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {slideMotions.map((each) => (
              <SelectItem key={each} value={each}>
                {t("motions", { motion: each })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  );
};

// The aspect, the transition and the length, side by side where they fit.
const Settings = ({
  aspect,
  disabled,
  length,
  onAspect,
  onLength,
  onTransition,
  transition,
  withVoiceover,
}: {
  readonly aspect: ImageAspect;
  readonly disabled: boolean;
  readonly length: string;
  readonly onAspect: (aspect: ImageAspect) => void;
  readonly onLength: (length: string) => void;
  readonly onTransition: (transition: SlideTransition) => void;
  readonly transition: SlideTransition;
  readonly withVoiceover: boolean;
}) => {
  const t = useTranslations("Assistant.slideshows");
  const images = useTranslations("Assistant.images");
  const aspectId = useId();
  const transitionId = useId();
  const lengthId = useId();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={aspectId}>{t("aspect")}</Label>
        <Select
          value={aspect}
          disabled={disabled}
          onValueChange={(chosen: string | null) => {
            const found = slideshowAspects.find((each) => each === chosen);

            if (found !== undefined) {
              onAspect(found);
            }
          }}
        >
          <SelectTrigger id={aspectId} className="w-40">
            <SelectValue>{images("aspects", { aspect })}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {slideshowAspects.map((each) => (
              <SelectItem key={each} value={each}>
                {images("aspects", { aspect: each })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={lengthId}>{t("length")}</Label>
        <Select
          value={length}
          disabled={disabled}
          onValueChange={(chosen: string | null) => {
            if (chosen !== null) {
              onLength(chosen);
            }
          }}
        >
          <SelectTrigger id={lengthId} className="w-48">
            <SelectValue>
              {length === fit
                ? t("fit")
                : t("seconds", { seconds: Number(length) })}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {withVoiceover ? (
              <SelectItem value={fit}>{t("fit")}</SelectItem>
            ) : null}
            {slideSeconds.map((each) => (
              <SelectItem key={each} value={String(each)}>
                {t("seconds", { seconds: each })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={transitionId}>{t("transition")}</Label>
        <Select
          value={transition}
          disabled={disabled}
          onValueChange={(chosen: string | null) => {
            const found = slideTransitions.find((each) => each === chosen);

            if (found !== undefined) {
              onTransition(found);
            }
          }}
        >
          <SelectTrigger id={transitionId} className="w-36">
            <SelectValue>{t("transitions", { transition })}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {slideTransitions.map((each) => (
              <SelectItem key={each} value={each}>
                {t("transitions", { transition: each })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

// The dialog: the images in order with their captions and motions, an
// optional voice-over, the shape, the length and the transition.
const SlideshowDialog = ({
  mayConfigure = false,
  status,
  workspaceId,
}: GenerateSlideshowProps & { readonly status: AssistantStatus }) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Assistant.slideshows");
  const format = useFormatter();
  const nameOf = useMediaName();
  const create = useAtomSet(createSlideshow, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  const { slideshows: allowance } = status;
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<readonly SlideDraft[]>([]);
  const [voiceover, setVoiceover] = useState<Media | null>(null);
  const [aspect, setAspect] = useState<ImageAspect>("portrait");
  const [transition, setTransition] = useState<SlideTransition>("fade");
  const [length, setLength] = useState<string>("4");
  const [failure, setFailure] = useState<SlideshowFailure | null>(null);
  const [sending, startTransition] = useTransition();

  const choice = {
    aspect,
    secondsPerSlide: length === fit ? null : Number(length),
    slides,
    transition,
    voiceover,
  };

  const problem = slideshowProblemOf(choice);
  const total = totalSecondsOf(choice);

  const handleOpenChange = (next: boolean) => {
    if (sending) {
      return;
    }

    setOpen(next);
    setFailure(null);
  };

  const run = () => {
    setFailure(null);

    startTransition(async () => {
      const exit = await create({
        params: { workspaceId },
        payload: slideshowRequestOf(choice),
        reactivityKeys: [slideshowsKey(workspaceId)],
      });

      refreshStatus();
      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        setOpen(false);
        setSlides([]);
        setVoiceover(null);
        toast.success(t("queuedToast"));

        return;
      }

      setFailure(Option.getOrElse(failureOf(exit), unexpected));
    });
  };

  const failureText = (shown: SlideshowFailure) =>
    t(`errors.${slideshowFailureKey(shown)}`, {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <GalleryHorizontalEndIcon aria-hidden data-icon="inline-start" />
        {t("open")}
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (problem === null && !sending) {
              run();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {allowance.sandbox ? (
            <Alert>
              <AlertTitle>{t("sandbox")}</AlertTitle>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("slides")}</span>
            <p className="text-muted-foreground text-xs">
              {t("slidesHint", { max: maxSlides })}
            </p>
            {slides.length === 0 ? null : (
              <ol className="divide-y border-y">
                {slides.map((slide, index) => (
                  <SlideRow
                    key={slide.media.id}
                    disabled={sending}
                    index={index}
                    slide={slide}
                    total={slides.length}
                    onChange={(changed) => {
                      setSlides(
                        slides.map((each, at) =>
                          at === index ? changed : each
                        )
                      );
                    }}
                    onMove={(by) => {
                      setSlides(moved(slides, index, by));
                    }}
                    onRemove={() => {
                      setSlides(removed(slides, index));
                    }}
                  />
                ))}
              </ol>
            )}
            {slides.length >= maxSlides ? null : (
              <div>
                <MediaPicker
                  accepts={isSlideImage}
                  attached={slides.map(({ media }) => media.id)}
                  disabled={sending}
                  room={maxSlides - slides.length}
                  texts={{
                    attach: t("addImages"),
                    description: t("pickImagesDescription"),
                    open: t("pickImages"),
                    title: t("pickImagesTitle"),
                  }}
                  workspaceId={workspaceId}
                  onPick={(picked) => {
                    setSlides(withPicked(slides, picked));
                  }}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("voiceover")}</span>
            <p className="text-muted-foreground text-xs">
              {voiceover === null
                ? t("voiceoverHint")
                : t("voiceoverChosen", { name: nameOf(voiceover) })}
            </p>
            <div className="flex flex-wrap gap-2">
              <MediaPicker
                accepts={isVoiceover}
                attached={voiceover === null ? [] : [voiceover.id]}
                disabled={sending}
                room={1}
                texts={{
                  attach: t("useVoiceover"),
                  description: t("pickVoiceoverDescription"),
                  open: t("pickVoiceover"),
                  title: t("pickVoiceoverTitle"),
                }}
                workspaceId={workspaceId}
                onPick={(picked) => {
                  const chosen = picked[0] ?? null;

                  setVoiceover(chosen);

                  if (chosen !== null && fitsVoiceover(slides, chosen)) {
                    setLength(fit);
                  }
                }}
              />
              {voiceover === null ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={sending}
                  onClick={() => {
                    setVoiceover(null);
                    setLength("4");
                  }}
                >
                  {t("clearVoiceover")}
                </Button>
              )}
            </div>
          </div>
          <Settings
            aspect={aspect}
            disabled={sending}
            length={length}
            transition={transition}
            withVoiceover={voiceover !== null}
            onAspect={setAspect}
            onLength={setLength}
            onTransition={setTransition}
          />
          <p className="text-muted-foreground text-sm">
            {t("total", {
              each: Math.round(secondsPerSlideOf(choice) * 10) / 10,
              max: maxSlideshowSeconds,
              total: Math.round(total * 10) / 10,
            })}{" "}
            {t("remaining", { remaining: allowance.remaining })}
          </p>
          <div aria-live="polite" className="flex flex-col gap-2">
            {problem === null || slides.length === 0 ? null : (
              <p className="text-destructive text-sm">
                {t(`problems.${problem}`, { max: maxSlideshowSeconds })}
              </p>
            )}
            {sending ? (
              <p className="text-sm" aria-busy="true">
                {t("sending")}
              </p>
            ) : null}
            {failure === null ? null : (
              <Alert variant="destructive">
                <AlertTitle>{failureText(failure)}</AlertTitle>
                {mayConfigure && isSlideshowSettingsRefusal(failure) ? (
                  <Link
                    className="text-sm underline"
                    href={workspaceHref(workspaceId, "/settings/assistant")}
                  >
                    {t("providerSettings")}
                  </Link>
                ) : null}
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={problem !== null || sending}>
              {t("compose")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Without a payment method, the button opens the upgrade dialog instead.
const NeedsPayment = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("Assistant.slideshows");
  const prompt = useUpgradePrompt();

  return (
    <Button
      variant="outline"
      onClick={() => {
        prompt(slideshowsNeedPayment, workspaceId);
      }}
    >
      <GalleryHorizontalEndIcon aria-hidden data-icon="inline-start" />
      {t("open")}
    </Button>
  );
};

/**
 * "Make a slide video": the workspace's Shotstack account composes images
 * of the library, with captions and a voice-over, into a video of the
 * library, in a job. Shown only while the status answers
 * `slideshows.available`; render it only for members with both
 * assistant:use and media:upload. Without a payment method on a server
 * that bills, it opens the upgrade dialog.
 */
export const GenerateSlideshow = (props: GenerateSlideshowProps) => {
  const status = AsyncResult.value(
    useAtomValue(assistantStatus(props.workspaceId))
  );

  if (Option.isNone(status) || !status.value.slideshows.available) {
    return null;
  }

  return status.value.slideshows.paymentMethodRequired ? (
    <NeedsPayment workspaceId={props.workspaceId} />
  ) : (
    <SlideshowDialog {...props} status={status.value} />
  );
};

// Reads the list again every few seconds while the page is shown.
const PollWhileOnTheWay = ({ refresh }: { readonly refresh: () => void }) => {
  useRefreshWhileVisible(refresh, slideshowPollMillis);

  return null;
};

/**
 * The workspace's slide videos on their way, as placeholders in the
 * library, read again while any is and the page is shown; once one ends,
 * a video that came reads the library again, and one that failed says
 * why.
 */
export const SlideshowJobs = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Assistant.slideshows");
  const list = slideshows(workspaceId);
  const result = useAtomValue(list);
  const refresh = useAtomRefresh(list);
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const reloadLibrary = useAtomSet(libraryChanged);

  const jobs = AsyncResult.isSuccess(result) ? result.value.slideshows : noJobs;

  const active = slideshowsOnTheWay(jobs);
  const before = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const ended = slideshowsEndedSince(before.current, jobs);

    for (const job of ended) {
      if (job.status === "succeeded") {
        toast.success(t("doneToast"));
      } else {
        toast.error(
          t("failedToast", {
            reason: t(`reasons.${job.reason ?? "refused"}`),
          })
        );
      }
    }

    if (ended.some((job) => job.status === "succeeded")) {
      reloadLibrary(workspaceId);
    }

    if (ended.length > 0) {
      refreshStatus();
    }

    before.current = new Set(slideshowsOnTheWay(jobs).map(({ id }) => id));
  }, [jobs, t, reloadLibrary, refreshStatus, workspaceId]);

  return (
    <>
      {active.length === 0 ? null : <PollWhileOnTheWay refresh={refresh} />}
      <SlideshowJobsView jobs={active} />
    </>
  );
};
