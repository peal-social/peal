"use client";

import { useAtomRefresh, useAtomSet } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type { AssistantStatus, ImageAspect, Media } from "peal-contract";
import { useRef } from "react";

import {
  assistantStatus,
  createVoiceover,
  generateImage,
} from "#assistant/api.ts";
import { audioFailureKey, voiceoverRequestOf } from "#assistant/audio.ts";
import type { AudioFailure } from "#assistant/audio.ts";
import { imageFailureKey } from "#assistant/image-failure.ts";
import type { ImageFailure } from "#assistant/image-failure.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { mediaKey } from "#media/atoms.ts";
import { failureOf } from "#posts/outcome.ts";
import { oneAfterAnother } from "#review/decision-queue.ts";

import type { Generation } from "./studio-engine.ts";

const unexpected = (): AudioFailure & ImageFailure => ({ _tag: "Unexpected" });

/**
 * Makes what a clip's prompt asks for, into the library, with the
 * providers the workspace chose. A refusal rejects in the reader's words,
 * which the SDK shows beside its Generate button; a plan's opens the
 * upgrade dialog too.
 */
export const useStudioGenerator = (
  workspaceId: string,
  status: AssistantStatus
) => {
  const studio = useTranslations("Studio");
  const images = useTranslations("Assistant.images");
  const audio = useTranslations("Assistant.audio");
  const format = useFormatter();
  const sendImage = useAtomSet(generateImage, { mode: "promiseExit" });
  const sendVoice = useAtomSet(createVoiceover, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  // Two clips may ask at once, and a mutation's second call would cut the
  // first off, once paid for.
  const inTurn = useRef(oneAfterAnother());

  const image = async (prompt: string, aspect: ImageAspect): Promise<Media> => {
    const exit = await inTurn.current(
      async () =>
        await sendImage({
          params: { workspaceId },
          payload: { aspect, prompt },
          reactivityKeys: [mediaKey(workspaceId)],
        })
    );

    refreshStatus();
    offerUpgrade(exit);

    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    const failure = Option.getOrElse(failureOf(exit), unexpected);

    throw new Error(
      images(`errors.${imageFailureKey(failure)}`, {
        dailyLimit:
          failure._tag === "OwnImageLimitReached" ? failure.dailyLimit : 0,
        maxLength: status.images.maxPromptLength,
      })
    );
  };

  const voice = async (words: string): Promise<Media> => {
    const exit = await inTurn.current(
      async () =>
        await sendVoice({
          params: { workspaceId },
          payload: voiceoverRequestOf(words, ""),
          reactivityKeys: [mediaKey(workspaceId)],
        })
    );

    refreshStatus();
    offerUpgrade(exit);

    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    const failure = Option.getOrElse(failureOf(exit), unexpected);

    throw new Error(
      audio(`errors.${audioFailureKey(failure)}`, {
        dailyLimit:
          failure._tag === "AudioAllowanceReached" ? failure.dailyLimit : 0,
        maxBytes: status.transcriptions.maxBytes,
        maxLength: status.voiceovers.maxTextLength,
        resetsAt:
          failure._tag === "AudioAllowanceReached"
            ? format.dateTime(DateTime.toDate(failure.resetsAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "",
      })
    );
  };

  /** The library file a clip's prompt asks for, images in this shape. */
  const make = async (
    { prompt, type }: Generation,
    aspect: ImageAspect
  ): Promise<Media> => {
    if (type === "image") {
      return await image(prompt, aspect);
    }

    if (type === "audio") {
      return await voice(prompt);
    }

    throw new Error(studio("notGenerated"));
  };

  return { make };
};
