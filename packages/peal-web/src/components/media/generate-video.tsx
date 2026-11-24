"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { ClapperboardIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type {
  AssistantStatus,
  ImageAspect,
  Media,
  VideoGeneration,
} from "peal-contract";
import type { AiVideoOffer } from "peal-contract/ai-providers";
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
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { Textarea } from "peal-ui/components/textarea";
import { toast } from "peal-ui/components/toast";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  assistantStatus,
  generateVideo,
  videoGenerations,
  videosKey,
} from "#assistant/api.ts";
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
import type { VideoFailure } from "#assistant/videos.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { MediaPicker } from "#components/posts/media-picker.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { libraryChanged } from "#media/atoms.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";
import { failureOf } from "#posts/outcome.ts";

import { useMediaName } from "./media-preview.tsx";
import { VideoJobsView } from "./video-jobs-view.tsx";

const unexpected = (): VideoFailure => ({ _tag: "Unexpected" });

// The same empty list while the jobs are read, so effects keep still.
const noJobs: readonly VideoGeneration[] = [];

// The length select's value when the provider picks the length.
const auto = "auto";

/** How often the library reads its videos on their way, while it is shown. */
export const videoPollMillis = 5000;

interface GenerateVideoProps {
  /**
   * The member may change the assistant's settings (assistant:configure):
   * a refusal of the provider's settings links them there.
   */
  readonly mayConfigure?: boolean;
  readonly workspaceId: string;
}

// The image dialog's words for an aspect, which videos share.
const useAspectLabel = () => {
  const t = useTranslations("Assistant.images");

  return (aspect: ImageAspect) => t("aspects", { aspect });
};

// The dialog's fields: what the video shows, its shape, its length where
// the provider takes one, and its first frame where it takes one.
const VideoDialog = ({
  mayConfigure = false,
  offer,
  status,
  workspaceId,
}: GenerateVideoProps & {
  readonly offer: AiVideoOffer;
  readonly status: AssistantStatus;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Assistant.videos");
  const format = useFormatter();
  const nameOf = useMediaName();
  const aspectLabel = useAspectLabel();
  const promptId = useId();
  const hintId = useId();
  const aspectId = useId();
  const durationId = useId();
  const frameId = useId();
  const generate = useAtomSet(generateVideo, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  const aspects = videoAspectsOf(offer);
  const durations = videoDurationsOf(offer);
  const { videos } = status;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const [aspect, setAspect] = useState<ImageAspect>(aspects[0] ?? "landscape");

  const [duration, setDuration] = useState<string>(auto);
  const [frame, setFrame] = useState<Media | null>(null);
  const [failure, setFailure] = useState<VideoFailure | null>(null);
  const [sending, startTransition] = useTransition();
  const blank = prompt.trim() === "";

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
      const exit = await generate({
        headers: forWorkspace(workspaceId),
        payload: videoRequestOf({
          aspect,
          durationSeconds: duration === auto ? null : Number(duration),
          imageMediaId: frame?.id ?? null,
          prompt,
        }),
        reactivityKeys: [videosKey(workspaceId)],
      });

      refreshStatus();
      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        setOpen(false);
        setPrompt("");
        setFrame(null);
        toast.success(t("queuedToast"));

        return;
      }

      setFailure(Option.getOrElse(failureOf(exit), unexpected));
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ClapperboardIcon aria-hidden data-icon="inline-start" />
        {t("open")}
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!blank && !sending) {
              run();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={promptId}>{t("prompt")}</Label>
            <Textarea
              id={promptId}
              aria-describedby={hintId}
              disabled={sending}
              maxLength={videos.maxPromptLength}
              required
              rows={4}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
              }}
            />
            <p id={hintId} className="text-muted-foreground text-xs">
              {t("promptHint", { maxLength: videos.maxPromptLength })}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={aspectId}>{t("aspect")}</Label>
              <Select
                value={aspect}
                disabled={sending}
                onValueChange={(chosen: string | null) => {
                  const found = aspects.find((each) => each === chosen);

                  if (found !== undefined) {
                    setAspect(found);
                  }
                }}
              >
                <SelectTrigger id={aspectId} className="w-44">
                  <SelectValue>{aspectLabel(aspect)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {aspects.map((each) => (
                    <SelectItem key={each} value={each}>
                      {aspectLabel(each)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {durations.length === 0 ? null : (
              <div className="flex flex-col gap-2">
                <Label htmlFor={durationId}>{t("duration")}</Label>
                <Select
                  value={duration}
                  disabled={sending}
                  onValueChange={(chosen: string | null) => {
                    if (chosen !== null) {
                      setDuration(chosen);
                    }
                  }}
                >
                  <SelectTrigger id={durationId} className="w-full">
                    <SelectValue>
                      {duration === auto
                        ? t("durationAuto")
                        : t("seconds", { seconds: Number(duration) })}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={auto}>{t("durationAuto")}</SelectItem>
                    {durations.map((each) => (
                      <SelectItem key={each} value={String(each)}>
                        {t("seconds", { seconds: each })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {offer.imageInput ? (
            <div className="flex flex-col gap-2">
              <span id={frameId} className="text-sm font-medium">
                {t("firstFrame")}
              </span>
              <p className="text-muted-foreground text-xs">
                {frame === null
                  ? t("firstFrameHint")
                  : t("frameChosen", { name: nameOf(frame) })}
              </p>
              <div className="flex flex-wrap gap-2">
                <MediaPicker
                  accepts={(media) => media.kind === "image"}
                  attached={frame === null ? [] : [frame.id]}
                  disabled={sending}
                  room={1}
                  texts={{
                    attach: t("useFrame"),
                    description: t("pickFrameDescription"),
                    open: t("pickFrame"),
                    title: t("pickFrameTitle"),
                  }}
                  workspaceId={workspaceId}
                  onPick={(picked) => {
                    setFrame(picked[0] ?? null);
                  }}
                />
                {frame === null ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={sending}
                    onClick={() => {
                      setFrame(null);
                    }}
                  >
                    {t("clearFrame")}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm">
            {t("remaining", { remaining: videos.remaining })}
          </p>
          <div aria-live="polite" className="flex flex-col gap-2">
            {sending ? (
              <p className="text-sm" aria-busy="true">
                {t("sending")}
              </p>
            ) : null}
            {failure === null ? null : (
              <Alert variant="destructive">
                <AlertTitle>
                  {t(`errors.${videoFailureKey(failure)}`, {
                    dailyLimit:
                      failure._tag === "VideoAllowanceReached"
                        ? failure.dailyLimit
                        : 0,
                    maxLength: videos.maxPromptLength,
                    resetsAt:
                      failure._tag === "VideoAllowanceReached"
                        ? format.dateTime(DateTime.toDate(failure.resetsAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "",
                  })}
                </AlertTitle>
                {mayConfigure && isVideoSettingsRefusal(failure) ? (
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
            <Button type="submit" disabled={blank || sending}>
              {t("generate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * "Generate a video": the provider the workspace chose for videos makes
 * one from a description into the media library, in a job that takes
 * minutes. Shown only while the status answers `videos.available`;
 * render it only for members with both assistant:use and media:upload.
 */
export const GenerateVideo = (props: GenerateVideoProps) => {
  const status = AsyncResult.value(
    useAtomValue(assistantStatus(props.workspaceId))
  );

  if (Option.isNone(status) || !status.value.videos.available) {
    return null;
  }

  const offer = videoOfferOf(status.value.videos);

  return offer === null ? null : (
    <VideoDialog {...props} offer={offer} status={status.value} />
  );
};

// Reads the list again every few seconds while the page is shown.
const PollWhileOnTheWay = ({ refresh }: { readonly refresh: () => void }) => {
  useRefreshWhileVisible(refresh, videoPollMillis);

  return null;
};

/**
 * The workspace's videos on their way, as placeholders in the library,
 * read again while any is and the page is shown; once one ends, a video
 * that came reads the library again, and one that failed says why.
 */
export const VideoJobs = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Assistant.videos");
  const list = videoGenerations(workspaceId);
  const result = useAtomValue(list);
  const refresh = useAtomRefresh(list);
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const reloadLibrary = useAtomSet(libraryChanged);

  const jobs = AsyncResult.isSuccess(result)
    ? result.value.generations
    : noJobs;

  const active = onTheWay(jobs);
  const before = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const ended = endedSince(before.current, jobs);

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

    before.current = new Set(onTheWay(jobs).map(({ id }) => id));
  }, [jobs, t, reloadLibrary, refreshStatus, workspaceId]);

  return (
    <>
      {active.length === 0 ? null : <PollWhileOnTheWay refresh={refresh} />}
      <VideoJobsView jobs={active} />
    </>
  );
};
