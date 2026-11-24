"use client";

import { useAtomSet } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useUploadErrorMessage } from "#components/media/media-uploader.tsx";
import { upload } from "#media/atoms.ts";
import { UploadFailed } from "#media/upload-failed.ts";
import { failureOf } from "#posts/outcome.ts";

import type { Studio } from "./studio-engine.ts";

/**
 * Saves the frame under the playhead to the library as a JPEG, to use as a
 * cover or a post, and says how it went.
 */
export const useStudioFrame = (workspaceId: string) => {
  const t = useTranslations("Studio");
  const send = useAtomSet(upload("studio-frame"), { mode: "promiseExit" });
  const errorMessage = useUploadErrorMessage();
  const offerUpgrade = useOfferUpgrade();
  const [saving, startSaving] = useTransition();

  const saveFrame = (studio: Studio) => {
    startSaving(async () => {
      let file: File;

      try {
        file = await studio.frame();
      } catch {
        toast.error(t("frameFailed"));

        return;
      }

      const exit = await send({ altText: "", file, workspaceId });

      if (Exit.isSuccess(exit)) {
        toast.success(t("frameSaved"));

        return;
      }

      offerUpgrade(exit);

      toast.error(
        errorMessage(
          Option.getOrElse(
            failureOf(exit),
            () => new UploadFailed({ reason: "unexpected" })
          )
        )
      );
    });
  };

  return { saveFrame, saving };
};
