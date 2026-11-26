import { Schema } from "effect";

/**
 * The social networks (and chats) a channel can connect to, whose channels take posts. Channels connect accounts on
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
  "discord",
  "telegram",
  "slack",
  "snapchat",
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
 * Websites a channel can publish articles to: a WordPress site of its
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
