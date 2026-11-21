import {
  ChatPlatformSchema,
  countedPlatforms,
  inboxPlatforms,
  SitePlatformSchema,
} from "peal-contract";
import type { ChannelPlatform } from "peal-contract";

/**
 * What kind of place a channel posts to: a social network, a chat, or a
 * website, which takes articles.
 */
export const channelCategories = ["social", "chat", "website"] as const;

export type ChannelCategory = (typeof channelCategories)[number];

/**
 * What Peal does with a channel of a platform, beyond its name: posts or
 * articles go out on it; its posts' counts are read (`analytics`); its
 * comments, reviews or direct messages reach the inbox; its posts can be
 * boosted with ads.
 */
export const channelFeatures = [
  "posts",
  "articles",
  "analytics",
  "comments",
  "reviews",
  "messages",
  "ads",
] as const;

export type ChannelFeature = (typeof channelFeatures)[number];

// Slack is a chat too, connected by signing in rather than with a secret.
const chats: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>([
  ...ChatPlatformSchema.literals,
  "slack",
]);

const sites: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>(
  SitePlatformSchema.literals
);

/** Whether a platform is a social network, a chat or a website. */
export const categoryOf = (platform: ChannelPlatform): ChannelCategory => {
  if (chats.has(platform)) {
    return "chat";
  }

  return sites.has(platform) ? "website" : "social";
};

/** The platforms whose direct messages Peal may read. */
export const messagePlatforms: ReadonlySet<ChannelPlatform> =
  new Set<ChannelPlatform>(["mastodon", "bluesky", "facebook", "instagram"]);

// The platforms whose locations' reviews the inbox reads.
const reviewPlatforms: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>([
  "googleBusiness",
]);

// The platforms whose published posts a boost puts in front of more
// people, through Meta's ads.
const boostPlatforms: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>([
  "facebook",
  "instagram",
]);

const commentPlatforms: ReadonlySet<ChannelPlatform> = new Set<ChannelPlatform>(
  inboxPlatforms
);

/**
 * The platforms Peal reads counts on when the server's capabilities are
 * not known: every platform it has a reader for.
 */
export const defaultCounted: ReadonlySet<ChannelPlatform> =
  new Set<ChannelPlatform>(countedPlatforms);

/**
 * What Peal does on a platform, in `channelFeatures`' order. `counted`:
 * the platforms this server reads each post's counts on, from its
 * capabilities (X only where its operator turned X reads on).
 */
export const featuresOf = (
  platform: ChannelPlatform,
  counted: ReadonlySet<ChannelPlatform> = defaultCounted
): readonly ChannelFeature[] => {
  const has: Readonly<Record<ChannelFeature, boolean>> = {
    ads: boostPlatforms.has(platform),
    analytics: counted.has(platform),
    articles: sites.has(platform),
    comments: commentPlatforms.has(platform),
    messages: messagePlatforms.has(platform),
    posts: !sites.has(platform),
    reviews: reviewPlatforms.has(platform),
  };

  return channelFeatures.filter((feature) => has[feature]);
};
