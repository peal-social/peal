"use client";

import { useTranslations } from "next-intl";
import { Toaster } from "peal-ui/components/toast";
import type { ReactNode } from "react";

import { AppRegistryProvider } from "#components/registry-provider.tsx";
import { UndoProvider } from "#components/undo.tsx";

// Client context for every page: an atom registry per visitor (also during
// server rendering, so requests never share state), which holds a query a
// render reads until that render commits, toasts, and the change that Undo
// or ⌘Z takes back. Tooltips group without a provider.
export const Providers = ({ children }: { readonly children: ReactNode }) => {
  const t = useTranslations("Toasts");

  return (
    <AppRegistryProvider>
      <UndoProvider>{children}</UndoProvider>
      <Toaster label={t("region")} pendingAnnouncement={t("pending")} />
    </AppRegistryProvider>
  );
};
