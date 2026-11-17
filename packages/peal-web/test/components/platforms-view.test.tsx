import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Platform } from "peal-contract";
import { linkedin } from "peal-ui/lib/brand-marks";
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
  // LinkedIn, Slack and Google Business Profile are not in simple-icons:
  // their marks come from their owners' files in peal-ui.
  it("draws the brands simple-icons does not hold from their own files", async () => {
    const html = await render([
      rowOf("linkedin"),
      rowOf("slack"),
      rowOf("googleBusiness"),
    ]);

    // LinkedIn's one-colour mark in its blue; Slack's and Google's files.
    expect(html).toContain(
      `fill="#${linkedin.hex}"><path d="${linkedin.path}"`
    );
    expect(html.match(/<image href=/gu)).toHaveLength(2);
    expect(html).toContain("google-business-profile.svg");
    expect(html).not.toContain(">in</span>");
  });
});
