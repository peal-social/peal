"use client";

import { RegistryProvider } from "@effect/atom-react";
import { useTranslations } from "next-intl";
import { Toaster } from "peal-ui/components/toast";
import type { ReactNode } from "react";

import { SignedOutNoticeToast } from "#components/account/signed-out-notice-toast.tsx";
import { OtherTabsSession } from "#components/auth/other-tabs-session.tsx";
import { UndoProvider } from "#components/undo.tsx";

// Client context for every page: an atom registry per visitor (also during
// server rendering, so requests never share state), toasts (with the one
// a sign-out left for the page it loaded), the change that Undo or ⌘Z
// takes back, and the other tabs' sign-ins and sign-outs, after which the
// page loads the app anew. Tooltips group without a provider.
export const Providers = ({ children }: { readonly children: ReactNode }) => {
  const t = useTranslations("Toasts");

  return (
    <RegistryProvider>
      <UndoProvider>{children}</UndoProvider>
      <Toaster label={t("region")} pendingAnnouncement={t("pending")} />
      <SignedOutNoticeToast />
      <OtherTabsSession />
    </RegistryProvider>
  );
};
