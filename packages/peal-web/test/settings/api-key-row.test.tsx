import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { ApiKey } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { KeyRow } from "#components/settings/api-keys.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (locale: "en" | "fr", view: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {view}
    </NextIntlClientProvider>
  );

const apiKey: ApiKey = {
  createdAt: DateTime.makeUnsafe("2026-11-20T09:00:00Z"),
  createdBy: { id: "ana", name: "Ana" },
  expiresAt: null,
  id: "key-1",
  name: "deploy",
  permissions: ["post:read"],
  start: "peal_ab",
};

describe(KeyRow, () => {
  it("names the member who made the key", async () => {
    const html = await render(
      "en",
      <KeyRow apiKey={apiKey} mayRevoke={false} workspaceId="workspace" />
    );

    expect(html).toContain("Made by Ana");
  });

  it("says a key made before makers were recorded has none, in French", async () => {
    const html = await render(
      "fr",
      <KeyRow
        apiKey={{ ...apiKey, createdBy: null }}
        mayRevoke={false}
        workspaceId="workspace"
      />
    );

    expect(html).toContain(
      "Créée avant que les clés n’enregistrent qui les crée"
    );
    expect(html).not.toContain("Ana");
  });
});
