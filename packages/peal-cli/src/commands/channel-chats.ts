import { Console, Effect, Option, Redacted } from "effect";
import { Command, Flag } from "effect/cli";
import { ChannelSchema, ChatPlatformSchema } from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { Refused } from "#refused.ts";
import { readSecret } from "#secret-input.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

/**
 * peal channels connect-chat: a Discord channel by its webhook's address,
 * or a Telegram channel or group by the member's bot and the chat.
 */
export const connectChat = Command.make(
  "connect-chat",
  {
    channel: Flag.String("channel").pipe(
      Flag.withMetavar("<id>"),
      Flag.withDescription(
        "The channel to reconnect: the secret must reach its chat again."
      ),
      Flag.optional
    ),
    chat: Flag.String("chat").pipe(
      Flag.withMetavar("<@name or id>"),
      Flag.withDescription(
        "On Telegram, the chat: its public name, such as @name, or its id, which starts with -100 for a channel or a supergroup."
      ),
      Flag.optional
    ),
    json: jsonFlag,
    platform: Flag.Literals("platform", ChatPlatformSchema.literals).pipe(
      Flag.withDescription(
        "Where the chat is: discord (a channel, by its webhook) or telegram (a channel or a group, by your bot)."
      )
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("channels.connectChat")(function* connectChatCommand(input) {
    // Telegram's chat is named before anything is asked or sent.
    yield* input.platform === "telegram" && Option.isNone(input.chat)
      ? Effect.fail(
          new Refused({
            reason:
              "Give --chat: the Telegram chat's public name, such as @name, or its id.",
          })
        )
      : Effect.void;

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    // Never an argument: typed without echo, or piped in.
    const secret = yield* readSecret(
      input.platform === "discord"
        ? "The webhook's address:"
        : "The bot's token:"
    );

    const reconnecting = Option.match(input.channel, {
      onNone: () => ({}),
      onSome: (channelId) => ({ channelId }),
    });

    const channel = yield* client.channels
      .connectChat({
        headers: {},
        payload:
          input.platform === "discord"
            ? {
                ...reconnecting,
                platform: "discord",
                webhookUrl: Redacted.value(secret).trim(),
              }
            : {
                ...reconnecting,
                botToken: Redacted.value(secret).trim(),
                chat: Option.getOrElse(input.chat, () => ""),
                platform: "telegram",
              },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(ChannelSchema, channel);

      return;
    }

    yield* Console.log(
      `Connected ${channel.displayName ?? channel.handle} (${channel.handle}) to ${workspace.name}, as channel ${channel.id}. Its ${
        input.platform === "discord" ? "webhook's address" : "bot's token"
      } is kept encrypted and never shown again; ${
        input.platform === "discord"
          ? "delete the webhook in the channel's settings"
          : "revoke the bot's token with @BotFather"
      } to cut Peal off.`
    );
  })
).pipe(
  Command.withDescription(
    "Connect a chat, to post to it, with a secret: a Discord channel by a webhook's address, from the channel's settings (Integrations, Webhooks); a Telegram channel or group by the token of your own bot, made with @BotFather, and --chat. The secret is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal channels connect-chat --platform discord < webhook.txt). A chat counts as one channel; the same chat again reconnects its channel. Needs channel:connect."
  )
);
