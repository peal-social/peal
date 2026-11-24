"use client";

import { useAtomRefresh, useAtomSet } from "@effect/atom-react";
import { DateTime, Duration, Effect, Exit, Option } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type { AssistantStatus, ImageAspect, Media } from "peal-contract";
import { useRef } from "react";

import {
  assistantStatus,
  createVoiceover,
  generateImage,
  generateVideo,
  readVideo,
  videosKey,
} from "#assistant/api.ts";
import { audioFailureKey, voiceoverRequestOf } from "#assistant/audio.ts";
import type { AudioFailure } from "#assistant/audio.ts";
import { imageFailureKey } from "#assistant/image-failure.ts";
import type { ImageFailure } from "#assistant/image-failure.ts";
import {
  isOnTheWay,
  videoAspectsOf,
  videoFailureKey,
  videoOfferOf,
  videoRequestOf,
} from "#assistant/videos.ts";
import type { VideoFailure } from "#assistant/videos.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { mediaKey } from "#media/atoms.ts";
import { failureOf } from "#posts/outcome.ts";
import { oneAfterAnother } from "#review/decision-queue.ts";

import type { Generation } from "./studio-engine.ts";

// How long between two reads of a video on its way, and how many reads in
// a row may fail before the editor stops waiting.
const readEvery = Duration.seconds(5);
const failedReads = 5;

const unexpected = (): AudioFailure & ImageFailure & VideoFailure => ({
  _tag: "Unexpected",
});

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
  const videos = useTranslations("Assistant.videos");
  const format = useFormatter();
  const sendImage = useAtomSet(generateImage, { mode: "promiseExit" });
  const sendVoice = useAtomSet(createVoiceover, { mode: "promiseExit" });
  const sendVideo = useAtomSet(generateVideo, { mode: "promiseExit" });
  const read = useAtomSet(readVideo, { mode: "promiseExit" });
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

  // A video made in a job of the server's, which goes on, into the
  // library, when nobody waits for it any more.
  const made = async (
    generationId: string,
    signal: AbortSignal,
    failures = 0
  ): Promise<Media> => {
    await Effect.runPromiseExit(Effect.sleep(readEvery), { signal });

    if (signal.aborted || failures === failedReads) {
      throw new Error(studio("notGenerated"));
    }

    const exit = await inTurn.current(
      async () => await read({ generationId, workspaceId })
    );

    if (Exit.isFailure(exit)) {
      return await made(generationId, signal, failures + 1);
    }

    const { job, media } = exit.value;

    if (media !== null) {
      return media;
    }

    if (isOnTheWay(job)) {
      return await made(generationId, signal);
    }

    throw new Error(
      videos("failedToast", {
        reason: videos(`reasons.${job.reason ?? "refused"}`),
      })
    );
  };

  const film = async (
    { prompt, signal }: Generation,
    aspect: ImageAspect
  ): Promise<Media> => {
    const offer = videoOfferOf(status.videos);
    const aspects = offer === null ? [] : videoAspectsOf(offer);

    const exit = await inTurn.current(
      async () =>
        await sendVideo({
          params: { workspaceId },
          payload: videoRequestOf({
            // The provider's own, where it has none of the video's shape.
            aspect: aspects.includes(aspect) ? aspect : (aspects[0] ?? aspect),
            durationSeconds: null,
            imageMediaId: null,
            prompt,
          }),
          reactivityKeys: [videosKey(workspaceId)],
        })
    );

    refreshStatus();
    offerUpgrade(exit);

    if (Exit.isSuccess(exit)) {
      return await made(exit.value.id, signal);
    }

    const failure = Option.getOrElse(failureOf(exit), unexpected);

    throw new Error(
      videos(`errors.${videoFailureKey(failure)}`, {
        dailyLimit:
          failure._tag === "VideoAllowanceReached" ? failure.dailyLimit : 0,
        maxLength: status.videos.maxPromptLength,
        resetsAt:
          failure._tag === "VideoAllowanceReached"
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
    generation: Generation,
    aspect: ImageAspect
  ): Promise<Media> => {
    const { prompt, type } = generation;

    if (type === "image") {
      return await image(prompt, aspect);
    }

    if (type === "audio") {
      return await voice(prompt);
    }

    if (type === "video") {
      return await film(generation, aspect);
    }

    throw new Error(studio("notGenerated"));
  };

  return { make };
};
