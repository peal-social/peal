import {
  AdNetworkSchema,
  ChannelPlatformSchema,
  ChatPlatformSchema,
  SitePlatformSchema,
} from "peal-contract";
import type { AdNetwork, ChannelPlatform } from "peal-contract";
import type { SiteMark } from "peal-ui/components/site-header";
import {
  siBluesky,
  siDevdotto,
  siDiscord,
  siFacebook,
  siGithub,
  siGoogleads,
  siHashnode,
  siInstagram,
  siMastodon,
  siMeta,
  siPinterest,
  siTelegram,
  siThreads,
  siTiktok,
  siWordpress,
  siX,
  siYoutube,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

// The header's Platforms menu: every platform a channel connects to and
// every ad network, from the contract's own lists, so one Peal adds shows
// up by itself (its entry below is then required to compile).

const markOf = (icon: SimpleIcon): SiteMark => ({
  kind: "path",
  path: icon.path,
});

// Brands missing from simple-icons get a lettered tile, as in the web app
// (DESIGN.md, Icons): LinkedIn and Slack asked to be left out, and Google
// Business Profile has no mark there.
const lettered = (letters: string): SiteMark => ({ kind: "letters", letters });

export const githubMark = markOf(siGithub);

export const discordMark = markOf(siDiscord);

export const telegramMark = markOf(siTelegram);

export const slackMark = lettered("S");

export type PlatformGroup = "ads" | "blog" | "chat" | "social";

/** The menu's groups, in the order it shows them. */
export const platformGroups: readonly PlatformGroup[] = [
  "social",
  "chat",
  "ads",
  "blog",
];

export interface PlatformEntry {
  /** Its page below the docs' root. */
  readonly docs: string;
  readonly group: PlatformGroup;
  readonly mark: SiteMark;
  /** Its own name, the same in every language. */
  readonly name: string;
}

const wordpress: Omit<PlatformEntry, "group"> = {
  docs: "platforms/wordpress",
  mark: markOf(siWordpress),
  name: "WordPress",
};

// Both kinds of WordPress site are one entry, whose page leads to each.
const channelEntries: Readonly<
  Record<ChannelPlatform, Omit<PlatformEntry, "group">>
> = {
  bluesky: {
    docs: "platforms/bluesky",
    mark: markOf(siBluesky),
    name: "Bluesky",
  },
  devto: { docs: "platforms/devto", mark: markOf(siDevdotto), name: "DEV" },
  discord: { docs: "platforms/discord", mark: discordMark, name: "Discord" },
  facebook: {
    docs: "platforms/facebook",
    mark: markOf(siFacebook),
    name: "Facebook",
  },
  googleBusiness: {
    docs: "platforms/google-business",
    mark: lettered("G"),
    name: "Google Business Profile",
  },
  hashnode: {
    docs: "platforms/hashnode",
    mark: markOf(siHashnode),
    name: "Hashnode",
  },
  instagram: {
    docs: "platforms/instagram",
    mark: markOf(siInstagram),
    name: "Instagram",
  },
  linkedin: {
    docs: "platforms/linkedin",
    mark: lettered("in"),
    name: "LinkedIn",
  },
  mastodon: {
    docs: "platforms/mastodon",
    mark: markOf(siMastodon),
    name: "Mastodon",
  },
  pinterest: {
    docs: "platforms/pinterest",
    mark: markOf(siPinterest),
    name: "Pinterest",
  },
  slack: { docs: "platforms/slack", mark: slackMark, name: "Slack" },
  telegram: {
    docs: "platforms/telegram",
    mark: telegramMark,
    name: "Telegram",
  },
  threads: {
    docs: "platforms/threads",
    mark: markOf(siThreads),
    name: "Threads",
  },
  tiktok: { docs: "platforms/tiktok", mark: markOf(siTiktok), name: "TikTok" },
  wordpress,
  wordpressCom: wordpress,
  x: { docs: "platforms/x", mark: markOf(siX), name: "X" },
  youtube: {
    docs: "platforms/youtube",
    mark: markOf(siYoutube),
    name: "YouTube",
  },
};

const adEntries: Readonly<Record<AdNetwork, Omit<PlatformEntry, "group">>> = {
  google: {
    docs: "guides/engage/ads#google",
    mark: markOf(siGoogleads),
    name: "Google Ads",
  },
  meta: { docs: "guides/engage/ads", mark: markOf(siMeta), name: "Meta ads" },
};

// The contract's chats are those connected with a pasted secret; Slack is
// a chat too, connected by signing in.
const signInChats: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>([
  "slack",
]);

const groupOf = (platform: ChannelPlatform): PlatformGroup => {
  if (
    ChatPlatformSchema.literals.some((chat) => chat === platform) ||
    signInChats.has(platform)
  ) {
    return "chat";
  }

  return SitePlatformSchema.literals.some((site) => site === platform)
    ? "blog"
    : "social";
};

const channels = ChannelPlatformSchema.literals.map((platform) => ({
  ...channelEntries[platform],
  group: groupOf(platform),
}));

/**
 * Every entry of the Platforms menu, in the contract's order, once each:
 * the channels' platforms, then the ad networks.
 */
export const siteEntries: readonly PlatformEntry[] = [
  ...channels.filter(
    (entry, index) =>
      channels.findIndex((other) => other.docs === entry.docs) === index
  ),
  ...AdNetworkSchema.literals.map((network) => ({
    ...adEntries[network],
    group: "ads" as const,
  })),
];

/** The menu's entry for a channel's platform. */
export const entryOf = (platform: ChannelPlatform) => channelEntries[platform];

/** The menu's entry for an ad network. */
export const adEntryOf = (network: AdNetwork) => adEntries[network];
