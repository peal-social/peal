import { Schema } from "effect";

/**
 * The social networks a channel can connect to, whose channels take posts. Channels connect accounts on
 * them and publishing checks posts against their rules, so the list lives in
 * the shared kernel.
 */
export const PlatformSchema = Schema.Literals([
  "x",
  "linkedin",
  "bluesky",
  "mastodon",
  "threads",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "googleBusiness",
]);

export type Platform = typeof PlatformSchema.Type;

export const platforms: readonly Platform[] = PlatformSchema.literals;

/**
 * Websites a channel can publish articles to: a WordPress site of its
 * own (`wordpress`, an application password), or an account on a
 * publishing platform by the member's key: `devto` (an API key),
 * `hashnode` (a personal access token, and one of its publications).
 */
export const SitePlatformSchema = Schema.Literals([
  "wordpress",
  "devto",
  "hashnode",
]);

export type SitePlatform = typeof SitePlatformSchema.Type;

/** The websites a member connects with a key of theirs. */
export const KeySitePlatformSchema = Schema.Literals(["devto", "hashnode"]);

export type KeySitePlatform = typeof KeySitePlatformSchema.Type;

/** Whether the site connects with a key of the member's. */
export const isKeySitePlatform: (
  platform: SitePlatform
) => platform is KeySitePlatform = Schema.is(KeySitePlatformSchema);

/** Whatever a channel connects to: a social network or a website. */
export const ChannelPlatformSchema = Schema.Literals([
  ...PlatformSchema.literals,
  ...SitePlatformSchema.literals,
]);

export type ChannelPlatform = typeof ChannelPlatformSchema.Type;

/** Whether a channel's platform is a social network, which takes posts. */
export const isSocialPlatform: (
  platform: ChannelPlatform
) => platform is Platform = Schema.is(PlatformSchema);

/** Whether a channel's platform is a website, which takes articles. */
export const isSitePlatform = (
  platform: ChannelPlatform
): platform is SitePlatform => !isSocialPlatform(platform);
