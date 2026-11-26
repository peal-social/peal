import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { SocialChannel, ChannelSet } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChannelSetFieldsView,
  ChannelSetItemView,
} from "#components/channel-sets/channel-set-views.tsx";
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

// The texts among `expected` that the markup lacks.
const missingFrom = (html: string, expected: readonly string[]) =>
  expected.filter((text) => !html.includes(text));

const noop = () => {
  // Nothing changes while rendering to markup.
};

const channel = (
  id: string,
  platform: SocialChannel["platform"]
): SocialChannel => ({
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: `@peal_${id}`,
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

const channels = [channel("a", "mastodon"), channel("b", "bluesky")];

const set = (fields: Partial<ChannelSet>): ChannelSet => ({
  channelIds: ["a", "b"],
  createdAt: DateTime.makeUnsafe("2026-11-01T09:00:00Z"),
  id: "s1",
  name: "Launch channels",
  options: [],
  unavailableChannelIds: [],
  ...fields,
});

describe(ChannelSetItemView, () => {
  it("shows a set's channels, with platform and handle", async () => {
    const html = await render(
      "en",
      <ul>
        <ChannelSetItemView
          channels={channels}
          set={set({})}
          actions={<button type="button">Edit</button>}
        />
      </ul>
    );

    expect(
      missingFrom(html, [
        "Launch channels",
        "@peal_a",
        "Mastodon",
        "@peal_b",
        "Bluesky",
        'aria-label="Channels of Launch channels"',
      ])
    ).toStrictEqual([]);

    expect(html).not.toContain("no longer connected");
  });

  it("warns of the channels that are no longer connected", async () => {
    const html = await render(
      "en",
      <ul>
        <ChannelSetItemView
          channels={channels}
          set={set({
            channelIds: ["a", "gone", "other"],
            unavailableChannelIds: ["gone", "other"],
          })}
        />
      </ul>
    );

    expect(html).toContain(
      "2 channels of this set are no longer connected: posts started from the set go without them."
    );
    expect(html).not.toContain("@peal_b");
  });

  it("says so when none of its channels is left", async () => {
    const html = await render(
      "fr",
      <ul>
        <ChannelSetItemView
          channels={channels}
          set={set({ channelIds: ["gone"], unavailableChannelIds: ["gone"] })}
        />
      </ul>
    );

    expect(
      missingFrom(html, [
        "Plus aucun de ses canaux n’est connecté.",
        "1 canal de ce groupe n’est plus connecté",
      ])
    ).toStrictEqual([]);
  });
});

describe(ChannelSetFieldsView, () => {
  it("offers the workspace's channels, ticking the set's", async () => {
    const html = await render(
      "en",
      <ChannelSetFieldsView
        channels={channels}
        draft={{ channelIds: ["b"], name: "Launch channels" }}
        dropped={0}
        error={null}
        disabled={false}
        idPrefix="new"
        onChange={noop}
      />
    );

    expect(html).toMatch(
      /<button[^>]*id="new-set-channel-b"[^>]*aria-checked="true"/u
    );
    expect(html).not.toMatch(
      /<button[^>]*id="new-set-channel-a"[^>]*aria-checked="true"/u
    );
    expect(
      missingFrom(html, [
        'value="Launch channels"',
        "One channel at least, 50 at most.",
      ])
    ).toStrictEqual([]);
    expect(html).not.toContain("Saving takes out");
  });

  it("says that saving takes out the disconnected channels", async () => {
    const html = await render(
      "en",
      <ChannelSetFieldsView
        channels={channels}
        draft={{ channelIds: ["a"], name: "Launch channels" }}
        dropped={2}
        error={{ key: "unknownChannels" }}
        disabled={false}
        idPrefix="s1"
        onChange={noop}
      />
    );

    expect(
      missingFrom(html, [
        "Saving takes out the 2 channels that are no longer connected.",
        "Some of these channels are no longer connected. Choose the channels again.",
      ])
    ).toStrictEqual([]);
  });
});
