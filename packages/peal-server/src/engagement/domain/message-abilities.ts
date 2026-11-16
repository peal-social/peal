import { Option, Schema } from "effect";

import {
  allowsRpc,
  blueskyChatService,
} from "#shared/domain/bluesky-scopes.ts";
import type { BlueskyChatMethod } from "#shared/domain/bluesky-scopes.ts";
import type { ChannelConnection } from "#shared/domain/channel-connection.ts";
import {
  facebookMessageScopes,
  InboxMessagePlatformSchema,
  instagramLoginMessageScope,
  instagramPageMessageScopes,
} from "#shared/domain/inbox-message-platform.ts";
import type {
  InboxMessagePlatform,
  InboxMessagePlatforms,
} from "#shared/domain/inbox-message-platform.ts";
import type { Platform } from "#shared/domain/platform.ts";

import type { AbilityStanding } from "./engagement-abilities.ts";

/**
 * What a channel's account can do with its direct messages:
 *
 * - `read`: Peal collects its conversations.
 * - `send`: answer a conversation, privately, as the account.
 */
export const MessageAbilitySchema = Schema.Literals(["read", "send"]);

export type MessageAbility = typeof MessageAbilitySchema.Type;

export type MessageAbilities = Readonly<
  Record<MessageAbility, AbilityStanding>
>;

const none: MessageAbilities = { read: "unsupported", send: "unsupported" };

const isMessagePlatform = (
  platform: Platform
): platform is InboxMessagePlatform =>
  InboxMessagePlatformSchema.literals.some((named) => named === platform);

/**
 * Whether this server reads direct messages on `platform`: only where the
 * operator named it (`PEAL_INBOX_MESSAGES`).
 */
export const readsMessagesOn = (
  platform: Platform,
  messages: InboxMessagePlatforms
): platform is InboxMessagePlatform =>
  isMessagePlatform(platform) && messages.has(platform);

const standing = (granted: boolean): AbilityStanding =>
  granted ? "available" : "reconnect";

const chat =
  (...methods: readonly BlueskyChatMethod[]) =>
  (scopes: readonly string[]) =>
    methods.every((method) => allowsRpc(scopes, method, blueskyChatService));

/**
 * What a channel can do with its messages, from its platform, the scopes
 * its account granted and the platforms the server reads messages on:
 *
 * - Mastodon (docs.joinmastodon.org/methods/conversations and
 *   /methods/statuses, read 2026-11-14): `GET /api/v1/conversations` and a
 *   status's context take `read:statuses`; a message is a status of
 *   `direct` visibility, `write:statuses`. Both are what Peal's sign-in
 *   has asked for since its first release, so a channel without them is
 *   one whose server granted less, and reconnecting asks them again.
 * - Bluesky: the chat methods each take their `rpc` scope at the chat
 *   service (`blueskyChatScopes`), which a sign-in asks for only when a
 *   member turns the channel's messages on (a reconnect with
 *   `messages`): until then a channel has none of them, and is
 *   `reconnect`. Reading takes
 *   `listConvos` and `getMessages`; answering also `sendMessage`, and
 *   `acceptConvo` for a conversation someone else began.
 * - Facebook Pages and Instagram: the Conversations API and the Send API
 *   take the same permissions, by the channel's way in
 *   (`facebookMessageScopes`, `instagramPageMessageScopes` through a Page,
 *   `instagramLoginMessageScope` through Instagram Login), asked only when
 *   a member turns the channel's messages on, as Bluesky's are. A channel
 *   without every one of them is `reconnect`.
 *
 * Off, or on any other platform, nothing is possible. `connection` is the
 * channel's way in, which decides Instagram's permissions: none is
 * through a Page, as a channel stored without one came.
 */
export const messageAbilitiesOf = (
  platform: Platform,
  scopes: readonly string[],
  messages: InboxMessagePlatforms,
  connection: Option.Option<ChannelConnection> = Option.none()
): MessageAbilities => {
  if (!readsMessagesOn(platform, messages)) {
    return none;
  }

  if (platform === "facebook" || platform === "instagram") {
    const needed: readonly string[] = metaMessageScopesOf(platform, connection);
    const granted = standing(needed.every((scope) => scopes.includes(scope)));

    return { read: granted, send: granted };
  }

  if (platform === "mastodon") {
    return {
      read: standing(
        scopes.some((scope) => scope === "read" || scope === "read:statuses")
      ),
      send: standing(
        scopes.some((scope) => scope === "write" || scope === "write:statuses")
      ),
    };
  }

  const reading = chat(
    "chat.bsky.convo.listConvos",
    "chat.bsky.convo.getMessages"
  );

  return {
    read: standing(reading(scopes)),
    send: standing(
      reading(scopes) &&
        chat(
          "chat.bsky.convo.sendMessage",
          "chat.bsky.convo.acceptConvo"
        )(scopes)
    ),
  };
};

/**
 * The permissions a Meta channel's messages take, by its way in: what its
 * sign-in asks once a member turns them on.
 */
export const metaMessageScopesOf = (
  platform: "facebook" | "instagram",
  connection: Option.Option<ChannelConnection>
): readonly string[] => {
  if (platform === "facebook") {
    return facebookMessageScopes;
  }

  return Option.contains(connection, "instagramLogin")
    ? [instagramLoginMessageScope]
    : instagramPageMessageScopes;
};

// The permissions of Meta's that name messages, in whichever way in.
const metaMessagingScopes: ReadonlySet<string> = new Set([
  "pages_messaging",
  "instagram_manage_messages",
  instagramLoginMessageScope,
]);

/**
 * Whether the scopes still name what reading the platform's messages
 * takes in some form, though `messageAbilitiesOf` does not read them as
 * granted: the form changed (a token refresh may answer them otherwise),
 * rather than the account granting none. Such a channel is paused, never
 * has its messages turned off. A Bluesky account that names nothing of
 * the chat, or a Mastodon one with no reading scope, granted none; a
 * Facebook or Instagram account that names no messaging permission of
 * Meta's granted none.
 */
export const namesMessageScopes = (
  platform: Platform,
  scopes: readonly string[]
): boolean => {
  if (platform === "bluesky") {
    return scopes.some((scope) => scope.includes("chat.bsky"));
  }

  if (platform === "facebook" || platform === "instagram") {
    return scopes.some((scope) => metaMessagingScopes.has(scope));
  }

  return scopes.some((scope) => scope === "read" || scope.startsWith("read:"));
};
