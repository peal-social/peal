import { Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest } from "effect/http";

import { ChatRefused } from "#channels/application/chat-refused.ts";
import type {
  ChatSignIn,
  VerifiedChat,
} from "#channels/application/chat-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  publicHttpClient,
  untraced,
} from "#shared/infrastructure/platforms/public-http.ts";
import {
  isBotToken,
  telegramErrorOf,
  telegramMethodUrl,
  telegramResult,
} from "#shared/infrastructure/platforms/telegram-api.ts";
import type { TelegramHosts } from "#shared/infrastructure/platforms/telegram-api.ts";

// What the Bot API answers (core.telegram.org/bots/api, Bot API 10.4,
// read 2026-11-16): `getMe`, the bot; `getChat`, the chat, its `type`
// one of private, group, supergroup and channel; `getChatMember`, the
// bot's place in it.
const BotSchema = Schema.Struct({ id: Schema.Int });

const ChatSchema = Schema.Struct({
  id: Schema.Int,
  title: Schema.optionalKey(Schema.String),
  type: Schema.Literals(["private", "group", "supergroup", "channel"]),
  username: Schema.optionalKey(Schema.String),
});

// "can_post_messages: True, if the administrator can post messages in the
// channel" (channels only); a restricted member's "can_send_messages:
// True, if the user is allowed to send text messages".
const MemberSchema = Schema.Struct({
  can_post_messages: Schema.optionalKey(Schema.Boolean),
  can_send_messages: Schema.optionalKey(Schema.Boolean),
  status: Schema.String,
});

type Chat = typeof ChatSchema.Type;

type Member = typeof MemberSchema.Type;

// A chat as a member names it: a public name (`@name`, as Telegram's
// usernames are 5 to 32 letters, digits and underscores), or its id.
const chatPattern = /^(?:@[A-Za-z]\w{3,31}|-?\d{1,20})$/u;

// Whether the bot may post there: an administrator with the right to post
// in a channel; in a group, an administrator, a member, or a restricted
// member who may still send messages.
const mayPost = (chat: Chat, member: Member): boolean => {
  if (chat.type === "channel") {
    return (
      member.status === "creator" ||
      (member.status === "administrator" && member.can_post_messages === true)
    );
  }

  return (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member" ||
    (member.status === "restricted" && member.can_send_messages === true)
  );
};

/**
 * How `ChatVerifier` checks a Telegram bot and a chat: a token that has
 * not a bot's shape, or a chat that is neither `@name` nor an id, is
 * refused before any call; then `getMe` (Telegram's 401 is
 * `credentialsRefused`), `getChat` (its 400, or 403, `chatNotFound`; a
 * private chat `chatKindNotSupported`) and `getChatMember` for the bot,
 * which must be allowed to post there (`cannotPost`). The channel is the
 * chat's id, named by its title and its public name when it has one; the
 * token is kept. Decisions read Telegram's `error_code`, never its words.
 * Anything else (a 5xx, a 429, no answer) is Telegram unavailable. The
 * token is in the address's path: the requests make no span, and their
 * errors are typed here.
 */
export const telegramChatVerify = Effect.fnUntraced(
  function* telegramChatVerify(hosts: TelegramHosts) {
    const http = untraced(yield* publicHttpClient);

    // One Bot API call, its result read with `schema`, or Telegram's error
    // code, or unavailable.
    const call = <A, I>(
      token: Redacted.Redacted,
      method: string,
      body: Readonly<Record<string, number | string>>,
      schema: Schema.Codec<A, I>
    ) =>
      Effect.gen(function* called() {
        const response = yield* http
          .execute(
            HttpClientRequest.post(
              telegramMethodUrl(hosts, token, method)
            ).pipe(HttpClientRequest.bodyJsonUnsafe(body))
          )
          .pipe(Effect.mapError(() => new PlatformUnavailable()));

        if (response.status === 200) {
          const { result } = yield* telegramResult(schema)(response).pipe(
            Effect.mapError(() => new PlatformUnavailable())
          );

          return { _tag: "ok", result } as const;
        }

        const refusal = yield* telegramErrorOf(response);

        return Option.isSome(refusal) &&
          refusal.value.code < 500 &&
          refusal.value.code !== 429
          ? ({ _tag: "refused", code: refusal.value.code } as const)
          : yield* new PlatformUnavailable();
      });

    return Effect.fn("TelegramChatVerifier.verify")(function* verify(
      signIn: Extract<ChatSignIn, { readonly platform: "telegram" }>
    ) {
      const token = Redacted.make(Redacted.value(signIn.botToken).trim());
      const asked = signIn.chat.trim();

      if (!isBotToken(Redacted.value(token))) {
        return yield* new ChatRefused({ reason: "credentialsRefused" });
      }

      if (!chatPattern.test(asked)) {
        return yield* new ChatRefused({ reason: "chatNotFound" });
      }

      const bot = yield* call(token, "getMe", {}, BotSchema);

      if (bot._tag === "refused") {
        return yield* new ChatRefused({ reason: "credentialsRefused" });
      }

      const chat = yield* call(
        token,
        "getChat",
        { chat_id: asked },
        ChatSchema
      );

      if (chat._tag === "refused") {
        return yield* new ChatRefused({
          reason: chat.code === 401 ? "credentialsRefused" : "chatNotFound",
        });
      }

      if (chat.result.type === "private") {
        return yield* new ChatRefused({ reason: "chatKindNotSupported" });
      }

      const member = yield* call(
        token,
        "getChatMember",
        { chat_id: chat.result.id, user_id: bot.result.id },
        MemberSchema
      );

      if (member._tag === "refused" || !mayPost(chat.result, member.result)) {
        return yield* new ChatRefused({ reason: "cannotPost" });
      }

      const title = Option.fromUndefinedOr(chat.result.title).pipe(
        Option.filter((written) => written.trim() !== "")
      );

      const name = Option.fromUndefinedOr(chat.result.username);

      const verified: VerifiedChat = {
        accountId: String(chat.result.id),
        displayName: title,
        handle: Option.match(name, {
          onNone: () => Option.getOrElse(title, () => String(chat.result.id)),
          onSome: (username) => `@${username}`,
        }),
        platform: "telegram",
        secret: token,
      };

      return verified;
    });
  }
);
