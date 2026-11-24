"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { CaptionsIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type { AssistantStatus, Media, Transcript } from "peal-contract";
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
import { Textarea } from "peal-ui/components/textarea";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { assistantStatus, transcribeMedia } from "#assistant/api.ts";
import { audioFailureKey, canTranscribe } from "#assistant/audio.ts";
import type { AudioFailure } from "#assistant/audio.ts";
import { describeUpload } from "#media/atoms.ts";
import { failureOf } from "#posts/outcome.ts";

import { useMediaName } from "./media-preview.tsx";

const unexpected = (): AudioFailure => ({ _tag: "Unexpected" });

/** The longest description the API keeps. */
export const maxDescriptionLength = 2000;

interface TranscribeMediaProps {
  readonly media: Media;
  /** The member may change the file's description (media:upload). */
  readonly mayDescribe: boolean;
  readonly workspaceId: string;
}

// The dialog: Transcribe sends the file once, then the transcript shows
// with Copy and, for who may, Use as description.
const TranscribeDialog = ({
  mayDescribe,
  media,
  status,
  workspaceId,
}: TranscribeMediaProps & { readonly status: AssistantStatus }) => {
  const t = useTranslations("Assistant.audio");
  const format = useFormatter();
  const nameOf = useMediaName();
  const textId = useId();
  const transcribe = useAtomSet(transcribeMedia, { mode: "promiseExit" });

  const describe = useAtomSet(describeUpload(media.id), {
    mode: "promiseExit",
  });

  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [failure, setFailure] = useState<AudioFailure | null>(null);
  const [busy, startTransition] = useTransition();
  const { transcriptions } = status;

  const fits =
    transcript !== null &&
    transcript.text.trim() !== "" &&
    transcript.text.length <= maxDescriptionLength;

  const handleOpenChange = (next: boolean) => {
    if (busy) {
      return;
    }

    setOpen(next);
    setFailure(null);
  };

  const run = () => {
    setFailure(null);

    startTransition(async () => {
      const exit = await transcribe({
        headers: forWorkspace(workspaceId),
        params: { mediaId: media.id },
        payload: {},
      });

      refreshStatus();

      if (Exit.isSuccess(exit)) {
        setTranscript(exit.value);

        return;
      }

      setFailure(Option.getOrElse(failureOf(exit), unexpected));
    });
  };

  const saveDescription = (text: string) => {
    startTransition(async () => {
      const exit = await describe({
        altText: text,
        mediaId: media.id,
        workspaceId,
      });

      if (Exit.isSuccess(exit)) {
        toast.success(t("describedToast"));
        setOpen(false);

        return;
      }

      toast.error(t("describeFailed"));
    });
  };

  const copy = (text: string) => {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("copiedToast"));
      } catch {
        toast.error(t("copyFailed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("transcribeLabel", { name: nameOf(media) })}
          />
        }
      >
        <CaptionsIcon aria-hidden />
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("transcribeTitle")}</DialogTitle>
          <DialogDescription>
            {t("transcribeDescription", { name: nameOf(media) })}
          </DialogDescription>
        </DialogHeader>
        {transcript === null ? (
          <p className="text-muted-foreground text-sm">
            {t("transcribeRemaining", {
              remaining: transcriptions.remaining,
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor={textId}>{t("transcript")}</Label>
            <Textarea
              id={textId}
              readOnly
              rows={8}
              dir="auto"
              value={transcript.text}
            />
            {mayDescribe && !fits ? (
              <p className="text-muted-foreground text-xs">
                {t("tooLongForDescription", {
                  maxLength: maxDescriptionLength,
                })}
              </p>
            ) : null}
          </div>
        )}
        <div aria-live="polite" className="flex flex-col gap-2">
          {busy && transcript === null ? (
            <p className="text-sm" aria-busy="true">
              {t("transcribing")}
            </p>
          ) : null}
          {failure === null ? null : (
            <Alert variant="destructive">
              <AlertTitle>
                {t(`errors.${audioFailureKey(failure)}`, {
                  dailyLimit:
                    failure._tag === "AudioAllowanceReached"
                      ? failure.dailyLimit
                      : 0,
                  maxBytes: transcriptions.maxBytes,
                  maxLength: status.voiceovers.maxTextLength,
                  resetsAt:
                    failure._tag === "AudioAllowanceReached"
                      ? format.dateTime(DateTime.toDate(failure.resetsAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "",
                })}
              </AlertTitle>
            </Alert>
          )}
        </div>
        <DialogFooter>
          {transcript === null ? (
            <Button type="button" disabled={busy} onClick={run}>
              {t("transcribe")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  copy(transcript.text);
                }}
              >
                {t("copy")}
              </Button>
              {mayDescribe ? (
                <Button
                  type="button"
                  disabled={busy || !fits}
                  onClick={() => {
                    saveDescription(transcript.text);
                  }}
                >
                  {t("useAsDescription")}
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * "Transcribe", on an audio or video file of the library: the provider
 * the workspace chose for transcripts writes what is said in it. Shown
 * only while the status answers `transcriptions.available` and the file
 * can be sent (`canTranscribe`); render it only for members with
 * assistant:use.
 */
export const TranscribeMedia = (props: TranscribeMediaProps) => {
  const status = AsyncResult.value(
    useAtomValue(assistantStatus(props.workspaceId))
  );

  if (
    Option.isNone(status) ||
    !canTranscribe(props.media, status.value.transcriptions)
  ) {
    return null;
  }

  return <TranscribeDialog {...props} status={status.value} />;
};
