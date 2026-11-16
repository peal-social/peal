import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Platform } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformsView } from "#components/platforms/platforms-view.tsx";
import { loadMessages } from "#i18n/messages.ts";
import type { PlatformRow } from "#platforms/rows.ts";

const rowOf = (platform: Platform): PlatformRow => ({
  analytics: false,
  channels: 0,
  followUps: "thread",
  maxMedia: 10,
  platform,
  textLimit: { maximum: 4000, unit: "escapedUtf16Units" },
  unpublish: true,
});

const render = async (rows: readonly PlatformRow[]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      messages={await loadMessages("en")}
      timeZone="UTC"
    >
      <PlatformsView rows={rows} />
    </NextIntlClientProvider>
  );

describe(PlatformsView, () => {
  // Neither LinkedIn nor Slack is in simple-icons, at their request.
  it("shows each brand left out of the marks as a tile of its own letters", async () => {
    const html = await render([rowOf("linkedin"), rowOf("slack")]);

    expect(html).toContain(">in</span>Linked");
    expect(html).toContain(">S</span>Slack");
  });
});
