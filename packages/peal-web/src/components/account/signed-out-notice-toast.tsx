"use client";

import { Option } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "peal-ui/components/toast";
import { useEffect } from "react";

import { takeSignedOutNotice, tabStorage } from "#auth/signed-out-notice.ts";

/**
 * Says, once the page has loaded, what the sign-out that loaded it kept
 * for it (`#auth/signed-out-notice.ts`): that the account is deleted.
 * Renders nothing.
 */
export const SignedOutNoticeToast = () => {
  const t = useTranslations("AccountSettings.delete");

  useEffect(() => {
    const notice = tabStorage().pipe(Option.flatMap(takeSignedOutNotice));

    if (Option.isSome(notice)) {
      toast.success(t("deleted"));
    }
  }, [t]);

  return null;
};
