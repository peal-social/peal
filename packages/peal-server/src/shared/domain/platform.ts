import { Schema } from "effect";

/**
 * What a channel connects to, whose channels take posts: a social network,
 * a chat or a website. Channels connect accounts on them and publishing
 * checks posts against their rules, so the list lives in the shared kernel.
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
  "discord",
  "telegram",
  "slack",
  "wordpress",
  "devto",
  "hashnode",
  "wordpressCom",
]);

export type Platform = typeof PlatformSchema.Type;

export const platforms: readonly Platform[] = PlatformSchema.literals;

/**
 * The chats a channel posts to, connected with a secret the member pastes
 * rather than a sign-in: a Discord channel by its webhook's address, a
 * Telegram channel or group by the member's own bot and the chat.
 */
export const ChatPlatformSchema = Schema.Literals(["discord", "telegram"]);

export type ChatPlatform = typeof ChatPlatformSchema.Type;

/** Whether the platform is a chat, connected with a secret. */
export const isChatPlatform: (platform: Platform) => platform is ChatPlatform =
  Schema.is(ChatPlatformSchema);

/**
 * Websites a channel can publish to: a WordPress site of its
 * own (`wordpress`, an application password), or an account on a
 * publishing platform by the member's key: `devto` (an API key),
 * `hashnode` (a personal access token, and one of its publications), or a
 * site on WordPress.com (`wordpressCom`), signed in to there by OAuth.
 */
export const SitePlatformSchema = Schema.Literals([
  "wordpress",
  "devto",
  "hashnode",
  "wordpressCom",
]);

export type SitePlatform = typeof SitePlatformSchema.Type;

/** The websites a member connects with a key of theirs. */
export const KeySitePlatformSchema = Schema.Literals(["devto", "hashnode"]);

export type KeySitePlatform = typeof KeySitePlatformSchema.Type;

/** The websites a member signs in to, by OAuth. */
export const OAuthSitePlatformSchema = Schema.Literals(["wordpressCom"]);

export type OAuthSitePlatform = typeof OAuthSitePlatformSchema.Type;

/** Whether the site connects with a key of the member's. */
export const isKeySitePlatform: (
  platform: SitePlatform
) => platform is KeySitePlatform = Schema.is(KeySitePlatformSchema);

/**
 * Whatever a channel connects to: the same list as `PlatformSchema`, kept
 * under its own name, which the contract's `Channel.platform` refers to.
 */
export const ChannelPlatformSchema = Schema.Literals(PlatformSchema.literals);

export type ChannelPlatform = typeof ChannelPlatformSchema.Type;

/** A platform that is no website: a social network or a chat. */
export type SocialPlatform = Exclude<Platform, SitePlatform>;

/** Whether a channel's platform is a website. */
export const isSitePlatform: (platform: Platform) => platform is SitePlatform =
  Schema.is(SitePlatformSchema);

/**
 * Whether a channel's platform is no website's: a social network or a
 * chat, which analytics, the inbox, connect links, the channel directory
 * and channel moves serve.
 */
export const isSocialPlatform = (
  platform: Platform
): platform is SocialPlatform => !isSitePlatform(platform);

/**
 * The platforms that are no website's, in Peal's order: where analytics,
 * the inbox and the automations' rules are listed.
 */
export const socialPlatforms: readonly SocialPlatform[] =
  platforms.filter(isSocialPlatform);
