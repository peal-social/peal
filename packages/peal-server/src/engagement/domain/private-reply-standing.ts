import { Option } from "effect";

import type { ChannelConnection } from "#shared/domain/channel-connection.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import {
  facebookCommentScopes,
  instagramLoginCommentScope,
  instagramPageCommentScope,
} from "#shared/domain/inbox-platform.ts";
import type { InboxPlatforms } from "#shared/domain/inbox-platform.ts";
import type { Platform } from "#shared/domain/platform.ts";

import type { AbilityStanding } from "./engagement-abilities.ts";
import { readsCommentsOn } from "./engagement-abilities.ts";
import {
  lacksMessages,
  metaMessageScopesOf,
  readsMessagesOn,
} from "./message-abilities.ts";

/**
 * The permissions a private reply takes, by the channel's way in: the
 * comment's, read and answered, and the messages' (Meta's pages, read
 * 2026-11-16: `pages_messaging` for a Page,
 * developers.facebook.com/documentation/business-messaging/
 * messenger-platform/discovery/private-replies; `instagram_manage_comments`
 * and `pages_messaging` through a Page, …/instagram-messaging/features/
 * private-replies; `instagram_business_manage_comments` through
 * Instagram Login, …/instagram-platform/private-replies, which Peal asks
 * with the messages' own permission, as the answer comes as a message).
 */
const privateReplyScopesOf = (
  platform: "facebook" | "instagram",
  connection: Option.Option<ChannelConnection>
): readonly string[] => {
  const messages = metaMessageScopesOf(platform, connection);

  if (platform === "facebook") {
    return [facebookCommentScopes.read, ...messages];
  }

  return Option.contains(connection, "instagramLogin")
    ? [instagramLoginCommentScope, ...messages]
    : [instagramPageCommentScope, ...messages];
};

/**
 * Whether a channel can send the author of a comment one private reply:
 *
 * - `available`: its platform is Facebook Pages or Instagram, the server
 *   reads both its comments (`inbox`, `PEAL_INBOX_PLATFORMS`) and its
 *   messages (`messages`, `PEAL_INBOX_MESSAGES`), the workspace turned the
 *   channel's messages on (`switchedOn`), and its account granted every
 *   permission it takes.
 * - `reconnect`: all that, but a permission is missing: connecting the
 *   channel again for its messages asks it.
 * - `unsupported`: anything else, Instagram through Unified login
 *   included, whose messages Peal does not read yet. The person's answer
 *   comes as a direct message, so a private reply needs the messages
 *   read, never more.
 */
export const privateReplyStanding = (
  platform: Platform,
  connection: Option.Option<ChannelConnection>,
  scopes: readonly string[],
  inbox: InboxPlatforms,
  messages: InboxMessagePlatforms,
  switchedOn: boolean
): AbilityStanding => {
  if (
    (platform !== "facebook" && platform !== "instagram") ||
    !readsCommentsOn(platform, inbox) ||
    !readsMessagesOn(platform, messages) ||
    lacksMessages(platform, connection) ||
    !switchedOn
  ) {
    return "unsupported";
  }

  return privateReplyScopesOf(platform, connection).every((scope) =>
    scopes.includes(scope)
  )
    ? "available"
    : "reconnect";
};
