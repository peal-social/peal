"use client";

import { useAtomRefresh, useAtomSet } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { useTranslations } from "next-intl";
import type { AssistantStatus, ImageAspect, Media } from "peal-contract";
import { useRef } from "react";

import { assistantStatus, generateImage } from "#assistant/api.ts";
import { imageFailureKey } from "#assistant/image-failure.ts";
import type { ImageFailure } from "#assistant/image-failure.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { mediaKey } from "#media/atoms.ts";
import { failureOf } from "#posts/outcome.ts";
import { oneAfterAnother } from "#review/decision-queue.ts";

const unexpected = (): ImageFailure => ({ _tag: "Unexpected" });

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
  const images = useTranslations("Assistant.images");
  const sendImage = useAtomSet(generateImage, { mode: "promiseExit" });
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

  return { image };
};
