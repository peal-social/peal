import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import type { ChannelSet, SocialChannel } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChannelChoices,
  ChannelsProperty,
} from "#components/posts/channel-picker.tsx";
import { loadMessages } from "#i18n/messages.ts";

const ignore = () => {
  // The picker is only rendered here.
};

const active: SocialChannel["status"] = { _tag: "active" };

const channel = (
  id: string,
  platform: SocialChannel["platform"],
  handle: string,
  status: SocialChannel["status"] = active
): SocialChannel => ({
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle,
  id,
  label: null,
  platform,
  status,
  tokenExpiresAt: null,
});

const workspace = [
  channel("m1", "mastodon", "@maple@social.example"),
  channel("i1", "instagram", "maple.studio"),
  channel("m2", "mastodon", "@news@social.example"),
  channel("i2", "instagram", "birch.bakery", { _tag: "refreshNeeded" }),
];

const launch: ChannelSet = {
  channelIds: ["m1", "gone"],
  createdAt: DateTime.makeUnsafe("2026-11-20T10:00:00Z"),
  id: "s1",
  name: "Launch channels",
  options: [],
  unavailableChannelIds: [],
};

const render = async (locale: Locale, node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>
  );

const choices = async ({
  locale = "en",
  saveSetBlocked = false,
  selected = [],
  sets = [],
  onSaveSet,
}: {
  readonly locale?: Locale;
  readonly onSaveSet?: () => void;
  readonly saveSetBlocked?: boolean;
  readonly selected?: readonly string[];
  readonly sets?: readonly ChannelSet[];
}) =>
  await render(
    locale,
    <ChannelChoices
      channels={workspace}
      saveSetBlocked={saveSetBlocked}
      selected={selected}
      sets={sets}
      onApplySet={ignore}
      onChange={ignore}
      onSaveSet={onSaveSet}
    />
  );

describe(ChannelsProperty, () => {
  it("leads a member who may connect to New channel when there is none", async () => {
    const html = await render(
      "en",
      <ChannelsProperty
        channels={[]}
        connectHref="/synthetic-workspace/channels/new"
        disabled={false}
        selected={[]}
        sets={[]}
        onApplySet={ignore}
        onChange={ignore}
      />
    );

    expect(html).toContain("No channel is connected to this workspace yet.");
    expect(html).toContain('href="/synthetic-workspace/channels/new"');
    expect(html).toContain("Connect a channel");
  });

  it("asks for channels while none is chosen, then says how many", async () => {
    const none = await render(
      "en",
      <ChannelsProperty
        channels={workspace}
        connectHref={null}
        disabled={false}
        selected={[]}
        sets={[]}
        onApplySet={ignore}
        onChange={ignore}
      />
    );

    expect(none).toContain("Add channels");
    expect(none).not.toContain("Connect a channel");

    const two = await render(
      "fr",
      <ChannelsProperty
        channels={workspace}
        connectHref={null}
        disabled={false}
        selected={["m1", "i1"]}
        sets={[]}
        onApplySet={ignore}
        onChange={ignore}
      />
    );

    expect(two).toContain("2 canaux");
  });
});

describe(ChannelChoices, () => {
  it("lists the channels under their platform, each platform's line half ticked while some are", async () => {
    const html = await choices({ selected: ["m2"] });

    expect(html.indexOf("Mastodon")).toBeLessThan(html.indexOf("Instagram"));
    expect(html.indexOf("@news@social.example")).toBeLessThan(
      html.indexOf("maple.studio")
    );
    expect(html).toContain("1/2");
    expect(html).toContain("0/2");
    // "All channels" and Mastodon's line are half ticked.
    expect(html.match(/<svg[^>]*lucide-minus/gu)).toHaveLength(2);
  });

  it("offers every channel at once, and says why one does not post", async () => {
    const html = await choices({});

    expect(html).toContain("All channels");
    // The channel to reconnect is not one "All channels" ticks.
    expect(html).toContain("0/3");
    expect(html).toContain("Reconnect needed");
  });

  it("says which lines are ticked, a platform's and All channels' mixed while some are", async () => {
    const html = await choices({ selected: ["m2"] });

    expect(html.match(/aria-checked="mixed"/gu)).toHaveLength(2);
    expect(html.match(/aria-checked="true"/gu)).toHaveLength(1);
  });

  it("waits to save a set while a chosen channel's options need fixing", async () => {
    const html = await choices({
      onSaveSet: ignore,
      saveSetBlocked: true,
      selected: ["m1"],
    });

    expect(html).toContain("Fix the channels’ options first");
    expect(html).toMatch(
      /option-save-set"[^>]*data-disabled|data-disabled[^>]*option-save-set"/u
    );
  });

  it("offers the sets, and saving the selection for who may", async () => {
    const html = await choices({ onSaveSet: ignore, sets: [launch] });

    expect(html).toContain("Use a channel set");
    expect(html).toContain("Launch channels");
    expect(html).toContain("Save selection as a set");
    await expect(choices({ sets: [launch] })).resolves.not.toContain(
      "Save selection as a set"
    );
  });

  it("speaks French", async () => {
    const html = await choices({ locale: "fr" });

    expect(html).toContain("Tous les canaux");
    expect(html).toContain("Choisir des canaux…");
  });
});
