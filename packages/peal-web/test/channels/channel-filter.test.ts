import { describe, expect, it } from "@effect/vitest";
import type { Channel } from "peal-contract";

import {
  channelFilterOf,
  channelMatches,
  channelQueryOf,
  noChannelFilter,
  orderedChannels,
} from "#channels/channel-filter.ts";
import { categoryOf, featuresOf } from "#channels/platform-features.ts";

const channel: Channel = {
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

const site: Channel = {
  ...channel,
  handle: "blog.example",
  id: "00000000-0000-7000-8000-000000000002",
  platform: "wordpress",
};

const facebook: Channel = {
  ...channel,
  handle: "Synthetic Page",
  id: "00000000-0000-7000-8000-000000000003",
  platform: "facebook",
  status: { _tag: "refreshNeeded" },
};

const telegram: Channel = {
  ...channel,
  handle: "Synthetic chat",
  id: "00000000-0000-7000-8000-000000000004",
  platform: "telegram",
  status: { _tag: "disabled", refreshNeeded: false },
};

const all = [channel, site, facebook, telegram];

const shown = (query: string) =>
  all.flatMap((each) =>
    channelMatches(each, channelFilterOf(new URLSearchParams(query)))
      ? [each.platform]
      : []
  );

describe(channelFilterOf, () => {
  it("reads the address, and leaves out what it does not know", () => {
    expect(
      channelFilterOf(
        new URLSearchParams(
          "view=off&platform=x,nowhere,mastodon&type=chat&feature=ads,magic"
        )
      )
    ).toStrictEqual({
      categories: ["chat"],
      direction: "asc",
      features: ["ads"],
      order: "added",
      // In the contract's order of platforms.
      platforms: ["x", "mastodon"],
      view: "off",
    });
    expect(
      channelFilterOf(new URLSearchParams("view=everything"))
    ).toStrictEqual(noChannelFilter);
  });

  it("writes it back with its defaults left out", () => {
    expect(channelQueryOf(noChannelFilter)).toBe("");
    expect(
      channelQueryOf({
        ...noChannelFilter,
        features: ["analytics", "comments"],
        view: "attention",
      })
    ).toBe("view=attention&feature=analytics,comments");
  });
});

describe(channelMatches, () => {
  it("shows a view's channels: those to reconnect, those turned off", () => {
    expect(shown("")).toStrictEqual([
      "mastodon",
      "wordpress",
      "facebook",
      "telegram",
    ]);
    expect(shown("view=attention")).toStrictEqual(["facebook"]);
    expect(shown("view=off")).toStrictEqual(["telegram"]);
  });

  it("keeps any of a property's values, and every property chosen", () => {
    expect(shown("platform=mastodon,telegram")).toStrictEqual([
      "mastodon",
      "telegram",
    ]);
    expect(shown("type=website")).toStrictEqual(["wordpress"]);
    expect(shown("feature=ads,articles")).toStrictEqual([
      "wordpress",
      "facebook",
    ]);
    expect(shown("feature=comments&type=social&view=attention")).toStrictEqual([
      "facebook",
    ]);
  });
});

describe(orderedChannels, () => {
  const words = {
    locale: "en",
    nameOf: ({ handle }: Channel) => handle,
    platformNameOf: (platform: string) => platform,
  };

  const order = (query: string) =>
    orderedChannels(
      all,
      channelFilterOf(new URLSearchParams(query)),
      words
    ).map(({ platform }) => platform);

  it("keeps the order they were connected in, unless asked another", () => {
    expect(order("")).toStrictEqual([
      "mastodon",
      "wordpress",
      "facebook",
      "telegram",
    ]);
    expect(order("direction=desc")).toStrictEqual([
      "telegram",
      "facebook",
      "wordpress",
      "mastodon",
    ]);
  });

  it("orders by name, by platform, or those that need a hand first", () => {
    expect(order("order=name")).toStrictEqual([
      "mastodon",
      "wordpress",
      "telegram",
      "facebook",
    ]);
    expect(order("order=platform")).toStrictEqual([
      "facebook",
      "mastodon",
      "telegram",
      "wordpress",
    ]);
    expect(order("order=status")).toStrictEqual([
      "facebook",
      "telegram",
      "mastodon",
      "wordpress",
    ]);
  });

  it("writes an ordering other than the default to the address", () => {
    expect(
      channelQueryOf({ ...noChannelFilter, direction: "desc", order: "name" })
    ).toBe("order=name&direction=desc");
  });
});

describe(featuresOf, () => {
  it("says what Peal does on each kind of platform", () => {
    expect(featuresOf("mastodon")).toStrictEqual([
      "posts",
      "analytics",
      "comments",
      "messages",
    ]);
    expect(featuresOf("wordpressCom")).toStrictEqual(["articles"]);
    expect(featuresOf("googleBusiness")).toContain("reviews");
    expect(featuresOf("instagram")).toContain("ads");
  });

  it("counts analytics only where this server reads them", () => {
    expect(featuresOf("x", new Set(["mastodon"]))).not.toContain("analytics");
    expect(featuresOf("x", new Set(["x"]))).toContain("analytics");
  });

  it("calls Slack a chat, as Discord and Telegram", () => {
    expect(
      (["slack", "discord", "telegram", "x", "devto"] as const).map(categoryOf)
    ).toStrictEqual(["chat", "chat", "chat", "social", "website"]);
  });
});
