"use client";

import { RegistryProvider } from "@effect/atom-react";
import { useTranslations } from "next-intl";
import { Toaster } from "peal-ui/components/toast";
import type { ReactNode } from "react";

import { registryOptions } from "#api/registry.ts";
import { UndoProvider } from "#components/undo.tsx";

// Client context for every page: an atom registry per visitor (also during
// server rendering, so requests never share state), which keeps a query a
// moment after its last reader (`registryOptions`), toasts, and the change
// that Undo or ⌘Z takes back. Tooltips group without a provider.
export const Providers = ({ children }: { readonly children: ReactNode }) => {
  const t = useTranslations("Toasts");

  return (
    <RegistryProvider defaultIdleTTL={registryOptions.defaultIdleTTL}>
      <UndoProvider>{children}</UndoProvider>
      <Toaster label={t("region")} pendingAnnouncement={t("pending")} />
    </RegistryProvider>
  );
};
