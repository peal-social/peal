import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import type { SocialChannel } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { ChannelCustomizations } from "#components/posts/channel-customizations.tsx";
import type { ChannelEntry } from "#components/posts/channel-customizations.tsx";
import { loadMessages } from "#i18n/messages.ts";
import { fitOn } from "#posts/character-count.ts";
import { mediaFitOn } from "#posts/media-fit.ts";

const channel = (
  id: string,
  platform: SocialChannel["platform"],
  displayName: string
): SocialChannel => ({
  avatarUrl: null,
  connection: null,
  displayName,
  handle: `peal_${id}`,
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

const entry = (
  of: SocialChannel,
  text: string,
  own: Partial<ChannelEntry> = {}
): ChannelEntry => ({
  attention: false,
  channel: of,
  fit: fitOn(of.platform, text, 0),
  media: mediaFitOn(of.platform, []),
  missing: [],
  optionsChosen: 0,
  ownMedia: false,
  ownText: false,
  ...own,
});

const none: readonly string[] = [];

const render = async (
  entries: readonly ChannelEntry[],
  locale: Locale = "en",
  unwritten = false,
  opens = none
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
    >
      <ChannelCustomizations
        bodyOf={() => <p>A synthetic body</p>}
        entries={entries}
        opens={opens}
        unwritten={unwritten}
      />
    </NextIntlClientProvider>
  );

const mastodon = channel("m1", "mastodon", "Maple Studio");
const youtube = channel("y1", "youtube", "Maple Videos");
const news = channel("m2", "mastodon", "Maple News");

describe(ChannelCustomizations, () => {
  it("lists the channels a line each, by platform, closed, with how the post fits each", async () => {
    const html = await render([
      entry(mastodon, "Autumn menu"),
      entry(youtube, "Autumn menu"),
      entry(news, "Autumn menu"),
    ]);

    // Both Mastodon channels come first, then YouTube's.
    expect(html.indexOf("Maple News")).toBeLessThan(
      html.indexOf("Maple Videos")
    );
    expect(html).toContain("11/500");
    expect(html).toContain("11/5,000 bytes");
    expect(html).toContain('aria-expanded="false"');
    // A row never opened holds nothing yet.
    expect(html).not.toContain("A synthetic body");
  });

  it("sums up what a channel has of its own, and names what its platform still needs", async () => {
    const html = await render([
      entry(mastodon, "Menu", {
        optionsChosen: 2,
        ownMedia: true,
        ownText: true,
      }),
      // With its video, YouTube asks only for its fields.
      entry(youtube, "Menu", {
        fit: fitOn("youtube", "Menu", 1),
        missing: ["youtube.title", "youtube.madeForKids"],
      }),
    ]);

    expect(html).toContain("Own text · Own images and videos · 2 options set");
    expect(html).toContain("Needs Title and Made for kids");
    // One reason the platform refuses (YouTube without its video) is
    // written in full in the row's panel too, as the line may cut it short.
    await expect(render([entry(youtube, "Menu")])).resolves.toMatch(
      /<li>[^<]+<\/li>/u
    );
    // A channel that takes the post as it is says nothing more.
    await expect(render([entry(news, "Menu")])).resolves.not.toContain(
      "Same as the post"
    );
  });

  it("leaves out that there is nothing to publish while nothing is written", async () => {
    const empty = [entry(mastodon, "")];

    await expect(render(empty, "en", true)).resolves.not.toContain(
      "Nothing to publish"
    );
    await expect(render(empty)).resolves.toContain("Nothing to publish");
  });

  it("opens the row of a channel whose options need fixing", async () => {
    const html = await render(
      [entry(mastodon, "Menu"), entry(news, "Menu")],
      "en",
      false,
      [news.id]
    );

    expect(html.match(/aria-expanded="true"/gu)).toHaveLength(1);
    expect(html.match(/A synthetic body/gu)).toHaveLength(1);
  });

  it("starts a TikTok channel's row open, so its creator and consent lines show", async () => {
    const html = await render([
      entry(channel("t1", "tiktok", "Maple Clips"), "Menu"),
      entry(mastodon, "Menu"),
    ]);

    expect(html.match(/aria-expanded="true"/gu)).toHaveLength(1);
    expect(html).toContain("A synthetic body");
  });

  it("marks a channel where something keeps the post back", async () => {
    await expect(
      render([entry(mastodon, "Menu", { attention: true })])
    ).resolves.toContain("To fix");
  });

  it("speaks French", async () => {
    const html = await render(
      [
        entry(youtube, "Menu", {
          fit: fitOn("youtube", "Menu", 1),
          missing: ["youtube.title"],
        }),
      ],
      "fr"
    );

    expect(html).toContain("Manque : Titre");
  });
});
