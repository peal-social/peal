"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { AudioLinesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { AssistantStatus } from "peal-contract";
import type { AiSpeechOffer } from "peal-contract/ai-providers";
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
import { Textarea } from "peal-ui/components/textarea";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { assistantStatus, createVoiceover } from "#assistant/api.ts";
import {
  audioFailureKey,
  isAudioSettingsRefusal,
  speechOfferOf,
  voiceFieldOf,
  voiceoverRequestOf,
} from "#assistant/audio.ts";
import type { AudioFailure } from "#assistant/audio.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { mediaKey } from "#media/atoms.ts";
import { failureOf } from "#posts/outcome.ts";

const unexpected = (): AudioFailure => ({ _tag: "Unexpected" });

// The voice select's value for the provider's own default.
const defaultVoice = "default-voice";

interface GenerateVoiceoverProps {
  /**
   * The member may change the assistant's settings (assistant:configure):
   * a refusal of the provider's settings links them there.
   */
  readonly mayConfigure?: boolean;
  readonly workspaceId: string;
}

// The voice, as the provider takes it: a list, a field, or nothing.
const VoiceChoice = ({
  disabled,
  id,
  offer,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly offer: AiSpeechOffer;
  readonly onChange: (voice: string) => void;
  readonly value: string;
}) => {
  const t = useTranslations("Assistant.audio");
  const field = voiceFieldOf(offer);

  if (field._tag === "none") {
    return null;
  }

  if (field._tag === "type") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{t("voiceId")}</Label>
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <p className="text-muted-foreground text-xs">{t("voiceIdHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("voice")}</Label>
      <Select
        value={value === "" ? defaultVoice : value}
        disabled={disabled}
        onValueChange={(chosen: string | null) => {
          if (chosen !== null) {
            onChange(chosen === defaultVoice ? "" : chosen);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{value === "" ? t("voiceDefault") : value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={defaultVoice}>{t("voiceDefault")}</SelectItem>
          {field.voices.map((voice) => (
            <SelectItem key={voice} value={voice}>
              {voice}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// The dialog's fields: what is said, and the voice the provider takes.
const VoiceoverDialog = ({
  mayConfigure = false,
  offer,
  status,
  workspaceId,
}: GenerateVoiceoverProps & {
  readonly offer: AiSpeechOffer;
  readonly status: AssistantStatus;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Assistant.audio");
  const format = useFormatter();
  const textId = useId();
  const hintId = useId();
  const voiceId = useId();
  const make = useAtomSet(createVoiceover, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  const { voiceovers } = status;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [failure, setFailure] = useState<AudioFailure | null>(null);
  const [sending, startTransition] = useTransition();
  const blank = text.trim() === "";

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
      const exit = await make({
        params: { workspaceId },
        payload: voiceoverRequestOf(text, voice),
        reactivityKeys: [mediaKey(workspaceId)],
      });

      refreshStatus();
      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        setOpen(false);
        setText("");
        toast.success(t("madeToast"));

        return;
      }

      setFailure(Option.getOrElse(failureOf(exit), unexpected));
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <AudioLinesIcon aria-hidden data-icon="inline-start" />
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
            <Label htmlFor={textId}>{t("text")}</Label>
            <Textarea
              id={textId}
              aria-describedby={hintId}
              disabled={sending}
              maxLength={voiceovers.maxTextLength}
              required
              rows={6}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
            <p id={hintId} className="text-muted-foreground text-xs">
              {t("textHint", { maxLength: voiceovers.maxTextLength })}
            </p>
          </div>
          <VoiceChoice
            disabled={sending}
            id={voiceId}
            offer={offer}
            value={voice}
            onChange={setVoice}
          />
          <p className="text-muted-foreground text-sm">
            {t("remaining", { remaining: voiceovers.remaining })}
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
                  {t(`errors.${audioFailureKey(failure)}`, {
                    dailyLimit:
                      failure._tag === "AudioAllowanceReached"
                        ? failure.dailyLimit
                        : 0,
                    maxBytes: status.transcriptions.maxBytes,
                    maxLength: voiceovers.maxTextLength,
                    resetsAt:
                      failure._tag === "AudioAllowanceReached"
                        ? format.dateTime(DateTime.toDate(failure.resetsAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "",
                  })}
                </AlertTitle>
                {mayConfigure && isAudioSettingsRefusal(failure) ? (
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
 * "Create a voice-over": the provider the workspace chose for voice-overs
 * speaks a text into the media library. Shown only while the status
 * answers `voiceovers.available`; render it only for members with both
 * assistant:use and media:upload.
 */
export const GenerateVoiceover = (props: GenerateVoiceoverProps) => {
  const status = AsyncResult.value(
    useAtomValue(assistantStatus(props.workspaceId))
  );

  if (Option.isNone(status) || !status.value.voiceovers.available) {
    return null;
  }

  const offer = speechOfferOf(status.value.voiceovers);

  return offer === null ? null : (
    <VoiceoverDialog {...props} offer={offer} status={status.value} />
  );
};
