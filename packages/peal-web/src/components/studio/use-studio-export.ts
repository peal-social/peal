"use client";

import { useAtomRefresh, useAtomSet } from "@effect/atom-react";
import { DateTime, Exit, Option, Schema } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "peal-ui/components/toast";
import { useState, useTransition } from "react";

import { assistantStatus, renderEdit, slideshowsKey } from "#assistant/api.ts";
import { slideshowFailureKey } from "#assistant/slideshows.ts";
import type { SlideshowFailure } from "#assistant/slideshows.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { failureOf } from "#posts/outcome.ts";
import type { StudioEdit } from "#studio/edit-document.ts";

const unexpected = (): SlideshowFailure => ({ _tag: "Unexpected" });

// The document as the JSON the API takes: written out, then read back as
// a JSON object, which drops the fields the SDK leaves undefined.
const asJsonObject = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.JsonObject)
);

/** Sending the editor's document to render, and what came of it. */
export interface StudioExport {
  /** Sends the document; nothing when there is none. */
  readonly exportVideo: (edit: StudioEdit | null) => void;
  readonly failure: SlideshowFailure | null;
  /** Why it was refused, in the reader's words. */
  readonly failureText: (failure: SlideshowFailure) => string;
  readonly sending: boolean;
}

/**
 * Renders the editor's document through the slide videos' job, with the
 * workspace's own Shotstack account: a refusal is kept to show, a plan's
 * opens the upgrade dialog, a job on its way is toasted.
 */
export const useStudioExport = (workspaceId: string): StudioExport => {
  const t = useTranslations("Studio");
  const slideshows = useTranslations("Assistant.slideshows");
  const format = useFormatter();
  const send = useAtomSet(renderEdit, { mode: "promiseExit" });
  const refreshStatus = useAtomRefresh(assistantStatus(workspaceId));
  const offerUpgrade = useOfferUpgrade();
  const [failure, setFailure] = useState<SlideshowFailure | null>(null);
  const [sending, startSending] = useTransition();

  const exportVideo = (document: StudioEdit | null) => {
    const edit =
      document === null
        ? Option.none()
        : asJsonObject(JSON.stringify(document));

    if (Option.isNone(edit)) {
      return;
    }

    setFailure(null);

    startSending(async () => {
      const exit = await send({
        params: { workspaceId },
        payload: { edit: edit.value },
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

  return { exportVideo, failure, failureText, sending };
};
