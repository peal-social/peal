import { Schema } from "effect";

/**
 * The platforms whose direct messages the inbox reads and answers, where
 * the server's operator turned them on (`PEAL_INBOX_MESSAGES`): Mastodon,
 * whose direct messages are statuses of `direct` visibility listed by
 * `/api/v1/conversations`, and Bluesky, whose chat service
 * (`chat.bsky.convo.*`) the account's PDS proxies, neither of which needs
 * a review by the platform; and Facebook Pages (Messenger) and Instagram
 * professional accounts, read through Meta's Conversations API, whose
 * messaging permissions Meta grants an app for the accounts of people
 * without a role on it only after its App Review. Messages are private
 * correspondence, so a server reads none until its operator says so.
 */
export const InboxMessagePlatformSchema = Schema.Literals([
  "mastodon",
  "bluesky",
  "facebook",
  "instagram",
]);

export type InboxMessagePlatform = typeof InboxMessagePlatformSchema.Type;

/** The platforms a server reads direct messages on. */
export type InboxMessagePlatforms = ReadonlySet<InboxMessagePlatform>;

/**
 * What a Page's direct messages take (Meta's Conversations API,
 * developers.facebook.com/documentation/business-messaging/messenger-platform/conversations,
 * read 2026-11-16): "the `pages_manage_metadata`, `pages_read_engagement`,
 * and `pages_messaging` permissions", the second of which posting already
 * asks; `pages_manage_metadata` also subscribes the Page to its events
 * (the Graph reference of `/{page-id}/subscribed_apps`, read the same day).
 */
export const facebookMessageScopes = [
  "pages_messaging",
  "pages_manage_metadata",
] as const;

/**
 * What an Instagram account's direct messages take through its Page (the
 * same page): "`instagram_basic`, `instagram_manage_messages`, and
 * `pages_manage_metadata`", the first of which posting asks; and
 * `pages_messaging`, which the Page's subscription to its events asks for,
 * and a private reply to an Instagram comment through a Page takes.
 */
export const instagramPageMessageScopes = [
  "instagram_manage_messages",
  "pages_manage_metadata",
  "pages_messaging",
] as const;

/**
 * What an Instagram account's direct messages take through Instagram
 * Login (developers.facebook.com/documentation/instagram-platform/
 * instagram-api-with-instagram-login/conversations-api, read 2026-11-16):
 * `instagram_business_basic`, which posting asks, and this one.
 */
export const instagramLoginMessageScope = "instagram_business_manage_messages";
