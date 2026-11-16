import {
  ChannelPlatformSchema,
  ChatPlatformSchema,
  SitePlatformSchema,
} from "peal-contract";
import type { ChannelPlatform } from "peal-contract";
import type { SiteMark } from "peal-ui/components/site-header";
import {
  siBluesky,
  siDevdotto,
  siDiscord,
  siFacebook,
  siGithub,
  siGoogle,
  siHashnode,
  siInstagram,
  siMastodon,
  siPinterest,
  siTelegram,
  siThreads,
  siTiktok,
  siWordpress,
  siX,
  siYoutube,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

// The platforms the header's Platforms menu lists: every one a channel can
// connect to, from the contract's own list, so a platform Peal adds shows
// up by itself (its entry below is then required to compile).

const markOf = (icon: SimpleIcon): SiteMark => ({
  kind: "path",
  path: icon.path,
});

// LinkedIn asked to be left out of simple-icons: a lettered tile stands in,
// as in the web app (DESIGN.md, Icons).
const linkedin: SiteMark = { kind: "letters", letters: "in" };

export const githubMark = markOf(siGithub);

export const discordMark = markOf(siDiscord);

export const telegramMark = markOf(siTelegram);

interface PlatformPage {
  /** Its page below the docs' root. */
  readonly docs: string;
  readonly mark: SiteMark;
  /** Its own name, the same in every language. */
  readonly name: string;
}

const pages: Readonly<Record<ChannelPlatform, PlatformPage>> = {
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
    mark: markOf(siGoogle),
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
  linkedin: { docs: "platforms/linkedin", mark: linkedin, name: "LinkedIn" },
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
  // A WordPress site of the member's own has no platform page: the
  // websites guide says how to connect one.
  wordpress: {
    docs: "guides/channels/websites",
    mark: markOf(siWordpress),
    name: "WordPress",
  },
  wordpressCom: {
    docs: "platforms/wordpress-com",
    mark: markOf(siWordpress),
    name: "WordPress.com",
  },
  x: { docs: "platforms/x", mark: markOf(siX), name: "X" },
  youtube: {
    docs: "platforms/youtube",
    mark: markOf(siYoutube),
    name: "YouTube",
  },
};

export type PlatformGroup = "articles" | "chat" | "social";

const groupOf = (platform: ChannelPlatform): PlatformGroup => {
  if (ChatPlatformSchema.literals.some((chat) => chat === platform)) {
    return "chat";
  }

  return SitePlatformSchema.literals.some((site) => site === platform)
    ? "articles"
    : "social";
};

export interface SitePlatform extends PlatformPage {
  readonly group: PlatformGroup;
  readonly platform: ChannelPlatform;
}

/** Every platform Peal connects to, in the contract's order. */
export const sitePlatforms: readonly SitePlatform[] =
  ChannelPlatformSchema.literals.map((platform) => ({
    ...pages[platform],
    group: groupOf(platform),
    platform,
  }));
