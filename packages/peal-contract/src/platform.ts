import { Schema } from "effect";

/**
 * What a channel connects to: a social network, a chat or a website. The
 * server's list (src/shared/domain/platform.ts) is the source; a test keeps
 * the two equal.
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
  "wordpress",
  "devto",
  "hashnode",
  "wordpressCom",
]).annotate({
  description:
    "What a channel connects to: a social network, a chat or a website.",
  identifier: "Platform",
});

export type Platform = typeof PlatformSchema.Type;

/**
 * The chats a channel posts to, connected with a secret the member pastes
 * (`connectChat`) rather than a sign-in: `discord`, a Discord channel by
 * its webhook's address; `telegram`, a Telegram channel or group by the
 * member's own bot and the chat. The server's list is the source; a test
 * keeps the two equal.
 */
export const ChatPlatformSchema = Schema.Literals([
  "discord",
  "telegram",
]).annotate({
  description: "A chat a channel posts to, connected with a secret.",
  identifier: "ChatPlatform",
});

export type ChatPlatform = typeof ChatPlatformSchema.Type;

/**
 * The websites a channel can publish to: `wordpress`, a WordPress
 * site of its own, reached with an application password; `devto`, an
 * account on DEV (dev.to), reached with the member's API key; `hashnode`,
 * a publication on Hashnode, reached with the member's personal access
 * token (Hashnode's API needs its Pro plan on the publication);
 * `wordpressCom`, a site on WordPress.com, signed in to there. The
 * server's list (src/shared/domain/platform.ts) is the source; a test
 * keeps the two equal.
 */
export const SitePlatformSchema = Schema.Literals([
  "wordpress",
  "devto",
  "hashnode",
  "wordpressCom",
]).annotate({
  description: "A kind of website a channel publishes to.",
  identifier: "SitePlatform",
});

export type SitePlatform = typeof SitePlatformSchema.Type;

/**
 * The websites a member connects with a key of theirs, made on the site
 * for Peal (`connectSiteWithKey`): `devto`, `hashnode`. The server's list is the
 * source; a test keeps the two equal.
 */
export const KeySitePlatformSchema = Schema.Literals([
  "devto",
  "hashnode",
]).annotate({
  description: "A kind of website a channel connects to with a key.",
  identifier: "KeySitePlatform",
});

export type KeySitePlatform = typeof KeySitePlatformSchema.Type;

/**
 * The websites a member signs in to, for Peal to publish there
 * (`startSiteSignIn`): `wordpressCom`, when the server has its app. The
 * server's list is the source; a test keeps the two equal.
 */
// One kind so far: a single literal, which the document writes as a plain
// enum (a list of one would be an anyOf of one). Further kinds join it as
// `Schema.Literals`.
export const OAuthSitePlatformSchema = Schema.Literal("wordpressCom").annotate({
  description: "A kind of website a channel connects to by signing in.",
  identifier: "OAuthSitePlatform",
});

export type OAuthSitePlatform = typeof OAuthSitePlatformSchema.Type;

/**
 * What a channel connects to: the same values as `Platform`, kept under its
 * own name, which `Channel.platform` refers to.
 */
export const ChannelPlatformSchema = Schema.Literals(
  PlatformSchema.literals
).annotate({
  description:
    "What a channel connects to: a social network, a chat or a website.",
  identifier: "ChannelPlatform",
});

export type ChannelPlatform = typeof ChannelPlatformSchema.Type;

/** A platform that is no website: a social network or a chat. */
export type SocialPlatform = Exclude<Platform, SitePlatform>;

const isSitePlatformValue = Schema.is(SitePlatformSchema);

/** Whether a platform is a website's. */
export const isSitePlatform = (platform: Platform): platform is SitePlatform =>
  isSitePlatformValue(platform);

/** Whether a platform is no website's: a social network or a chat. */
export const isSocialPlatform = (
  platform: Platform
): platform is SocialPlatform => !isSitePlatformValue(platform);

/**
 * How an Instagram channel reaches its account, one of Meta's three ways
 * in: `instagramLogin` (the member signs in to the professional account on
 * Instagram; no Facebook Page needed), `facebookLogin` (the member signs
 * in to Facebook and picks among the professional accounts linked to the
 * Pages they manage) or `unifiedLogin` (Meta's Unified login: the member
 * signs in with Instagram or Facebook and shares accounts of a business
 * portfolio; no Facebook Page needed). The server's copy
 * (src/shared/domain/instagram-connection.ts) is the source; a test keeps
 * the two equal.
 */
export const InstagramConnectionSchema = Schema.Literals([
  "instagramLogin",
  "facebookLogin",
  "unifiedLogin",
]).annotate({
  description:
    "How an Instagram channel reaches its account: Instagram Login, a Facebook Page, or Meta's Unified login.",
  identifier: "InstagramConnection",
});

export type InstagramConnection = typeof InstagramConnectionSchema.Type;

/**
 * What a LinkedIn channel posts as: `linkedinProfile` (a member's own
 * profile) or `linkedinPage` (a company page the member administers, which
 * needs a server whose operator LinkedIn granted the Community Management
 * API). The server's copy (src/shared/domain/linkedin-connection.ts) is the
 * source; a test keeps the two equal.
 */
export const LinkedInConnectionSchema = Schema.Literals([
  "linkedinProfile",
  "linkedinPage",
]).annotate({
  description: "What a LinkedIn channel posts as: a profile or a page.",
  identifier: "LinkedInConnection",
});

export type LinkedInConnection = typeof LinkedInConnectionSchema.Type;

/**
 * The way in a channel came through, on the platforms that have several:
 * Instagram's and LinkedIn's.
 */
export const ChannelConnectionSchema = Schema.Literals([
  ...InstagramConnectionSchema.literals,
  ...LinkedInConnectionSchema.literals,
]).annotate({
  description:
    "The way in a channel came through, on platforms that have several.",
  identifier: "ChannelConnection",
});

export type ChannelConnection = typeof ChannelConnectionSchema.Type;
