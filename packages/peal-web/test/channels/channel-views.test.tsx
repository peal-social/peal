import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Channel } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { noChannelFilter } from "#channels/channel-filter.ts";
import type { ChannelFilter } from "#channels/channel-filter.ts";
import { ChannelListView } from "#components/channels/channel-list-view.tsx";
import { connectablesOf } from "#components/channels/connect-forms.tsx";
import { PlatformCatalogueView } from "#components/channels/platform-catalogue-view.tsx";
import type { CatalogueFilter } from "#components/channels/platform-catalogue-view.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const workspaceId = "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f";

const render = async (locale: "en" | "fr", node: ReactNode) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <RegistryProvider>{node}</RegistryProvider>
    </NextIntlClientProvider>
  );
};

const mastodon: Channel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "@synthetic@social.example",
  id: "00000000-0000-7000-8000-000000000001",
  label: null,
  platform: "mastodon",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const facebook: Channel = {
  ...mastodon,
  handle: "Synthetic Page",
  id: "00000000-0000-7000-8000-000000000002",
  platform: "facebook",
  status: { _tag: "refreshNeeded" },
};

const ignore = (_filter: ChannelFilter | CatalogueFilter) => {
  // The views only say what was chosen.
};

const docsHref = "https://docs.example.test/guides/channels";

const list = async (
  channels: readonly Channel[],
  filter: ChannelFilter = noChannelFilter,
  canConnect = true
) =>
  await render(
    "en",
    <ChannelListView
      canConnect={canConnect}
      canDisconnect
      channels={channels}
      docsHref={docsHref}
      filter={filter}
      newChannel={<button type="button">Synthetic way in</button>}
      workspaceId={workspaceId}
      onFilter={ignore}
    />
  );

const TestLink: LinkComponent = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

describe(ChannelListView, () => {
  it("says what a channel is when there is none yet, with New channel and the docs", async () => {
    const html = await list([]);

    expect(html).toContain("A channel is an account this workspace posts to");
    expect(html).toContain("Synthetic way in");
    expect(html).toContain(`href="${docsHref}#connect"`);
  });

  it("says what each view is for when it holds nothing, linking its section", async () => {
    const [attention, off] = await Promise.all([
      list([mastodon], { ...noChannelFilter, view: "attention" }),
      list([mastodon], { ...noChannelFilter, view: "off" }),
    ]);

    expect(attention).toContain("Every channel works for now.");
    expect(attention).toContain(`href="${docsHref}#reconnect"`);
    expect(off).toContain("No channel is turned off.");
    expect(off).toContain(`href="${docsHref}#turn-off"`);
  });

  it("keeps its views, Filter and Display over the empty state", async () => {
    const html = await list([]);

    expect(html).toContain(">All<");
    expect(html).toContain('aria-label="Filter"');
    expect(html).toContain('aria-label="Display"');
  });

  it("tells a member who may not connect who can, with no button", async () => {
    const html = await list([], noChannelFilter, false);

    expect(html).toContain("Ask an owner or an admin");
    expect(html).not.toContain("Synthetic way in");
  });

  it("lists the channels under their views, with Filter", async () => {
    const html = await list([mastodon, facebook]);

    expect(html).toContain(">All<");
    expect(html).toContain("Needs reconnecting");
    expect(html).toContain('aria-label="Filter"');
  });

  it("names each channel, and wears a state only when it does not post", async () => {
    const html = await list([mastodon, facebook]);

    expect(html).toContain("@synthetic@social.example");
    expect(html).toContain(">Reconnect needed<");
    expect(html).not.toContain(">Connected<");
  });

  it("shows the filters as chips", async () => {
    const narrowed = await list([mastodon, facebook], {
      ...noChannelFilter,
      features: ["ads", "messages"],
      platforms: ["x"],
    });

    expect(narrowed).toContain("Platform");
    expect(narrowed).toContain("is any of");
    expect(narrowed).toContain("Ads, Direct messages");
  });

  it("says how many channels the filters hide, with Clear", async () => {
    const narrowed = await list([mastodon, facebook], {
      ...noChannelFilter,
      platforms: ["x"],
    });

    expect(narrowed).toContain("No matching channels");
    expect(narrowed).toContain(
      "<strong>2 channels</strong> hidden by the filters"
    );
  });
});

describe(PlatformCatalogueView, () => {
  const platforms = connectablesOf({
    chats: ["telegram"],
    instagramConnections: [],
    linkedinConnections: ["linkedinProfile"],
    platforms: ["mastodon", "instagram", "x", "facebook"],
    sites: ["wordpress", "devto", "hashnode"],
  });

  const catalogue = async (
    filter: CatalogueFilter,
    locale: "en" | "fr" = "en"
  ) =>
    await render(
      locale,
      <PlatformCatalogueView
        connected={new Map([["mastodon", 2]])}
        filter={filter}
        hrefOf={(platform) => `/new/${platform}`}
        link={TestLink}
        platforms={platforms}
        onFilter={ignore}
      />
    );

  it("offers what the server connects, websites by key everywhere, no Instagram without a way in", () => {
    expect(platforms).toStrictEqual([
      "mastodon",
      "x",
      "facebook",
      "wordpress",
      "devto",
      "hashnode",
      "telegram",
    ]);
  });

  it("shows each platform as a tile linking its form, with what Peal does there", async () => {
    const html = await catalogue({ category: null, features: [], query: "" });

    expect(html).toContain('href="/new/mastodon"');
    expect(html).toContain("Social network · 2 connected");
    expect(html).toContain(">Direct messages<");
    expect(html).toContain(">Articles<");
  });

  it("narrows by type and by feature", async () => {
    const chats = await catalogue({
      category: "chat",
      features: [],
      query: "",
    });

    expect(chats).toContain('href="/new/telegram"');
    expect(chats).not.toContain('href="/new/mastodon"');

    const ads = await catalogue({
      category: null,
      features: ["ads"],
      query: "",
    });

    expect(ads).toContain('href="/new/facebook"');
    expect(ads).not.toContain('href="/new/x"');
  });

  it("narrows by the text typed, and says when nothing is left", async () => {
    const typed = await catalogue({
      category: null,
      features: [],
      query: "hash",
    });

    expect(typed).toContain('href="/new/hashnode"');
    expect(typed).not.toContain('href="/new/devto"');

    const none = await catalogue(
      { category: null, features: [], query: "nothing" },
      "fr"
    );

    expect(none).toContain("Aucune plateforme ne correspond");
  });
});
