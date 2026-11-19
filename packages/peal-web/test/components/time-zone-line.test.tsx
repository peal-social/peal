import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TimeZoneLine } from "#components/lists/time-zone-line.tsx";
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

describe(TimeZoneLine, () => {
  it("says the calendar's times are in the reader's zone, named in words", async () => {
    const html = await render(
      "en",
      <TimeZoneLine of="times" timeZone="America/New_York" />
    );

    expect(html).toContain("Times are in your time zone, America/New York.");
    expect(html).toContain("text-xs");
    expect(html).toContain("text-muted-foreground");
  });

  it("says the analytics' days run in the reader's zone", async () => {
    const html = await render(
      "en",
      <TimeZoneLine of="days" timeZone="Europe/Paris" />
    );

    expect(html).toContain("Days run in your time zone, Europe/Paris.");
  });

  it("says both in French", async () => {
    const times = await render(
      "fr",
      <TimeZoneLine of="times" timeZone="Europe/Paris" />
    );

    const days = await render(
      "fr",
      <TimeZoneLine of="days" timeZone="Europe/Paris" />
    );

    expect(times).toContain(
      "Les heures suivent votre fuseau horaire, Europe/Paris."
    );
    expect(days).toContain(
      "Les jours suivent votre fuseau horaire, Europe/Paris."
    );
  });
});
