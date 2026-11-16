import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Schema } from "effect";

import {
  dropped,
  empty,
  formPartsOf,
  headerOf,
  json,
  platformServer,
  scripted,
  textOf,
} from "./platform-server.ts";
import type {
  FormPart,
  JsonValue,
  PlatformAnswer,
  PlatformRequest,
} from "./platform-server.ts";

// Telegram's Bot API as a bot of the member's sees it
// (core.telegram.org/bots/api, Bot API 10.4): synthetic ids, and a token
// that says so and has not a real one's shape.

export const telegramBotId = 100_001;

export const telegramBotToken = `${String(telegramBotId)}:synthetic-bot-token`;

/** A channel the bot posts in, by its id. */
export const telegramChannelId = -1_001_000_000_001;

/** The channel's account id, as the channel keeps it. */
export const telegramAccount = String(telegramChannelId);

/** A message the bot sent. */
export interface FakeTelegramMessage {
  /** Its caption, or its text. */
  text: string;
  readonly chatId: number;
  readonly files: readonly FormPart[];
  /** The method that sent it, as `sendPhoto`. */
  readonly method: string;
  readonly id: number;
  /** What it was sent with, but its files. */
  readonly fields: Readonly<Record<string, JsonValue>>;
  /** A message older than 48 hours, which Telegram deletes no more. */
  old: boolean;
}

/** A chat Telegram knows. */
export interface FakeTelegramChat {
  readonly id: number;
  /** The bot's place in it, as getChatMember answers it. */
  readonly member: JsonValue;
  readonly title: string;
  readonly type: "channel" | "group" | "private" | "supergroup";
  readonly username?: string;
}

/**
 * What the fake does with the next call of a method instead of its own
 * behaviour: an answer; `hang`, which takes the request and never answers;
 * `sendThenDrop`, which sends the message and drops the connection.
 */
export type TelegramScript =
  | PlatformAnswer
  | { readonly _tag: "hang" }
  | { readonly _tag: "sendThenDrop" };

export interface FakeTelegramOptions {
  readonly chats?: readonly FakeTelegramChat[];
  /** The bot's token was revoked: every call answers 401. */
  readonly revoked?: boolean;
}

/** The channel the bot administers, with the right to post. */
export const postingChannel: FakeTelegramChat = {
  id: telegramChannelId,
  member: {
    can_post_messages: true,
    status: "administrator",
    user: { id: telegramBotId, is_bot: true },
  },
  title: "Synthetic announcements",
  type: "channel",
  username: "synthetic_news",
};

const decodeFields = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json))
);

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json));

const failed = (code: number, description: string, extra = {}) =>
  json({ description, error_code: code, ok: false, ...extra }, code);

const ok = (result: JsonValue) => json({ ok: true, result });

// What a method was sent: JSON, or a form whose text fields hold JSON
// where Telegram takes it (`reply_parameters`, `media`), and its files.
const sentOf = (request: PlatformRequest) => {
  if (headerOf(request, "content-type").startsWith("application/json")) {
    return { fields: decodeFields(textOf(request)), files: [] };
  }

  const parts = formPartsOf(request);
  const fields: Record<string, JsonValue> = {};

  for (const part of parts.filter(({ fileName }) => fileName === undefined)) {
    const text = new TextDecoder().decode(part.data);

    fields[part.name] =
      part.name === "reply_parameters" || part.name === "media"
        ? decodeJson(text)
        : text;
  }

  return {
    fields,
    files: parts.filter(({ fileName }) => fileName !== undefined),
  };
};

// A chat as Telegram describes it: its public name only when it has one.
const chatJson = (chat: FakeTelegramChat): JsonValue => {
  const described = { id: chat.id, title: chat.title, type: chat.type };

  return chat.username === undefined
    ? described
    : { ...described, username: chat.username };
};

const never = async (): Promise<PlatformAnswer> => {
  await sleep(3_600_000, undefined, { ref: false });

  return empty(504);
};

const MediaItemsSchema = Schema.Array(
  Schema.Struct({ caption: Schema.optionalKey(Schema.String) })
);

const ReplySchema = Schema.Struct({ message_id: Schema.Int });

const IdsSchema = Schema.Array(Schema.Int);

const decodeItems = Schema.decodeUnknownSync(MediaItemsSchema);

const decodeReply = Schema.decodeUnknownSync(ReplySchema);

const decodeIds = Schema.decodeUnknownSync(IdsSchema);

const textField = Schema.decodeUnknownSync(Schema.String);

/** A loopback Telegram, whose state tests read. */
export const fakeTelegramApi = Effect.fn("test.fakeTelegramApi")(
  function* fakeTelegramApi(options: FakeTelegramOptions = {}) {
    const chats = options.chats ?? [postingChannel];
    const messages: FakeTelegramMessage[] = [];
    const scripts = scripted<TelegramScript>();
    const state = { nextId: 1, revoked: options.revoked === true };
    const prefix = `/bot${telegramBotToken}/`;

    const chatOf = (fields: Readonly<Record<string, JsonValue>>) => {
      const asked = JSON.stringify(fields["chat_id"]).replaceAll('"', "");

      return chats.find(
        (chat) =>
          String(chat.id) === asked ||
          (chat.username !== undefined && asked === `@${chat.username}`)
      );
    };

    const messageJson = (
      message: FakeTelegramMessage,
      chat: FakeTelegramChat
    ) => ({
      chat: chatJson(chat),
      date: 1_790_000_000,
      message_id: message.id,
    });

    // A send method: one message, or an album's.
    const send = (method: string, request: PlatformRequest): PlatformAnswer => {
      const { fields, files } = sentOf(request);
      const chat = chatOf(fields);

      if (chat === undefined) {
        return failed(400, "Bad Request: chat not found");
      }

      const reply = fields["reply_parameters"];

      if (
        reply !== undefined &&
        !messages.some(
          ({ chatId, id }) =>
            chatId === chat.id && id === decodeReply(reply).message_id
        )
      ) {
        return failed(400, "Bad Request: message to be replied not found");
      }

      const captions =
        method === "sendMediaGroup"
          ? decodeItems(fields["media"]).map(({ caption }) => caption ?? "")
          : [textField(fields["text"] ?? fields["caption"] ?? "")];

      const made = captions.map((text): FakeTelegramMessage => {
        const message = {
          chatId: chat.id,
          fields,
          files,
          id: state.nextId,
          method,
          old: false,
          text,
        };

        state.nextId += 1;

        return message;
      });

      messages.push(...made);

      const answered = made.map((message) => messageJson(message, chat));

      return ok(method === "sendMediaGroup" ? answered : (answered[0] ?? null));
    };

    // editMessageText and editMessageCaption.
    const edit = (method: string, request: PlatformRequest): PlatformAnswer => {
      const { fields } = sentOf(request);
      const chat = chatOf(fields);

      const message = messages.find(
        ({ chatId, id }) =>
          chatId === chat?.id && id === Number(fields["message_id"])
      );

      if (chat === undefined || message === undefined) {
        return failed(400, "Bad Request: message to edit not found");
      }

      message.text = textField(
        method === "editMessageText" ? fields["text"] : fields["caption"]
      );

      return ok(messageJson(message, chat));
    };

    const remove = (request: PlatformRequest): PlatformAnswer => {
      const { fields } = sentOf(request);
      const chat = chatOf(fields);
      const ids = decodeIds(fields["message_ids"]);

      const found = messages.filter(
        ({ chatId, id }) => chatId === chat?.id && ids.includes(id)
      );

      if (found.some(({ old }) => old)) {
        return failed(400, "Bad Request: message can't be deleted");
      }

      for (const message of found) {
        messages.splice(messages.indexOf(message), 1);
      }

      // "If some of the specified messages can't be found, they are
      // skipped."
      return ok(true);
    };

    const read = (method: string, request: PlatformRequest): PlatformAnswer => {
      if (method === "getMe") {
        return ok({
          first_name: "Synthetic bot",
          id: telegramBotId,
          is_bot: true,
          username: "synthetic_bot",
        });
      }

      const { fields } = sentOf(request);
      const chat = chatOf(fields);

      if (chat === undefined) {
        return failed(400, "Bad Request: chat not found");
      }

      return method === "getChat" ? ok(chatJson(chat)) : ok(chat.member);
    };

    const behaviour = (method: string, request: PlatformRequest) => {
      if (method.startsWith("send")) {
        return send(method, request);
      }

      if (method.startsWith("edit")) {
        return edit(method, request);
      }

      return method === "deleteMessages"
        ? remove(request)
        : read(method, request);
    };

    const answer = async (
      request: PlatformRequest
    ): Promise<PlatformAnswer> => {
      if (!request.path.startsWith("/bot")) {
        return empty(404);
      }

      if (state.revoked || !request.path.startsWith(prefix)) {
        return failed(401, "Unauthorized");
      }

      const method = request.path.slice(prefix.length);
      const script = scripts.next(method);

      if (script?._tag === "hang") {
        return await never();
      }

      if (script?._tag === "sendThenDrop") {
        behaviour(method, request);

        return dropped;
      }

      return script ?? behaviour(method, request);
    };

    const server = yield* platformServer(answer);

    return {
      ...server,
      /** Makes every message sent so far older than 48 hours. */
      age: () => {
        for (const message of messages) {
          message.old = true;
        }
      },
      /** The calls of one method, in order. */
      calls: (method: string) =>
        server.requests().filter(({ path }) => path === `${prefix}${method}`),
      messages: (): readonly FakeTelegramMessage[] => [...messages],
      /** Revokes the bot's token, as the member does with Telegram's bot. */
      revoke: () => {
        state.revoked = true;
      },
      /** Queues answers for a method, as `sendMessage`. */
      script: (method: string, answers: readonly TelegramScript[]) => {
        scripts.push(method, answers);
      },
      /** What a refusal looks like, for scripts. */
      failed,
    };
  }
);

export type FakeTelegram = Effect.Success<ReturnType<typeof fakeTelegramApi>>;
