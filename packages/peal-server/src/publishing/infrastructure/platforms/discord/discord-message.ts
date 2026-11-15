import { Effect, Option } from "effect";

import type { DiscordOptions } from "#publishing/domain/discord-options.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";

// What a message of Peal's says on Discord beside its text, and how Peal
// names it (Execute Webhook, docs.discord.com/developers/resources/webhook,
// and the message resource, read 2026-11-16).

/** The guild and the channel a channel's webhook posts in. */
export interface DiscordAccount {
  readonly channelId: string;
  readonly guildId: string;
}

const accountPattern = /^(?<guild>\d{1,20})\/(?<channel>\d{1,20})$/u;

/** The guild and channel of a channel's account id, `<guild>/<channel>`. */
export const accountOf = (
  accountId: string
): Effect.Effect<DiscordAccount, BadRequest> => {
  const groups = accountPattern.exec(accountId)?.groups;
  const guildId = groups?.["guild"];
  const channelId = groups?.["channel"];

  return guildId === undefined || channelId === undefined
    ? Effect.fail(new BadRequest({ code: "invalidAccount" }))
    : Effect.succeed({ channelId, guildId });
};

/** A message of Peal's: the channel it is in (a thread's), and its id. */
export interface DiscordPostId {
  readonly channelId: string;
  readonly messageId: string;
}

const postIdPattern = /^(?<channel>\d{1,20})\/(?<message>\d{1,20})$/u;

/** The message a post id names, `<channel>/<message>`, if it is one. */
export const discordPostIdOf = (
  id: PlatformPostId | string
): Option.Option<DiscordPostId> => {
  const groups = postIdPattern.exec(id)?.groups;
  const channelId = groups?.["channel"];
  const messageId = groups?.["message"];

  return channelId === undefined || messageId === undefined
    ? Option.none()
    : Option.some({ channelId, messageId });
};

/** Who a message may notify, as `allowed_mentions` says it. */
export interface AllowedMentions {
  readonly parse: readonly ("everyone" | "roles" | "users")[];
}

/**
 * `allowed_mentions`, always sent: left out, a webhook's message notifies
 * the people it mentions ("In interactions and webhooks, only user
 * mentions are parsed"). Peal notifies nobody unless the options turn
 * mentions on, which notifies people, roles and `@everyone` alike.
 */
export const allowedMentionsOf = (
  options: Option.Option<DiscordOptions>
): AllowedMentions =>
  Option.exists(options, ({ mentions }) => mentions === true)
    ? { parse: ["users", "roles", "everyone"] }
    : { parse: [] };

// "SUPPRESS_EMBEDS: 1 << 2", "SUPPRESS_NOTIFICATIONS: 1 << 12" (the
// message resource's flags).
const suppressEmbeds = 4;

const suppressNotifications = 4096;

/**
 * The message's `flags`, from the options; 0 for none. The two are bits of
 * their own, so their sum is both set.
 */
export const messageFlagsOf = (options: Option.Option<DiscordOptions>) =>
  Option.match(options, {
    onNone: () => 0,
    onSome: ({ silent, suppressEmbeds: noEmbeds }) =>
      (silent === true ? suppressNotifications : 0) +
      (noEmbeds === true ? suppressEmbeds : 0),
  });
