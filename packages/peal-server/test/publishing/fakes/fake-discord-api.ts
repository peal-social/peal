import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Schema } from "effect";

import {
  dropped,
  empty,
  formPartsOf,
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

// A Discord channel and its webhook, as Execute Webhook, Get Webhook, Edit
// and Delete Webhook Message answer them
// (docs.discord.com/developers/resources/webhook): synthetic ids and a
// token that says so.

export const discordGuild = "200000000000000001";

export const discordChannel = "300000000000000001";

export const discordWebhookId = "400000000000000001";

export const discordWebhookToken = "synthetic-webhook-token";

/** The secret the channel keeps: `<id>/<token>`. */
export const discordSecret = `${discordWebhookId}/${discordWebhookToken}`;

/** The channel's account id: `<guild>/<channel>`. */
export const discordAccount = `${discordGuild}/${discordChannel}`;

/** What a message was sent with, as JSON (`payload_json` for a form). */
export type DiscordPayload = Readonly<Record<string, JsonValue>>;

/** A message the webhook posted. */
export interface FakeDiscordMessage {
  /** The channel it is in: the webhook's, or a thread's. */
  readonly channelId: string;
  readonly files: readonly FormPart[];
  readonly id: string;
  payload: DiscordPayload;
}

/**
 * What the fake does with the next request to a route instead of its own
 * behaviour: an answer; `hang`, which takes the request and never answers;
 * `postThenDrop`, which posts the message and drops the connection, so the
 * answer is lost; `postThenFail`, which posts it and answers an error.
 */
export type DiscordScript =
  | PlatformAnswer
  | { readonly _tag: "hang" }
  | { readonly _tag: "postThenDrop" }
  | { readonly _tag: "postThenFail"; readonly status: number };

export interface FakeDiscordOptions {
  /** The webhook's channel is a forum, whose messages open posts. */
  readonly forum?: boolean;
  /** The webhook was deleted: every call answers 404, unknown webhook. */
  readonly gone?: boolean;
  /** The webhook's name: Discord's text, which may hold anything. */
  readonly name?: string;
  /** The webhook's type: 1, incoming, unless said. */
  readonly type?: number;
}

const decodePayload = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json))
);

const discordError = (code: number, status: number) =>
  json({ code, message: `Synthetic error ${String(code)}` }, status);

// What Execute Webhook was sent: a JSON body, or a form's `payload_json`
// and its files.
const sentOf = (request: PlatformRequest) => {
  const parts = formPartsOf(request);

  if (parts.length === 0) {
    return { files: [], payload: decodePayload(textOf(request)) };
  }

  const payload = parts.find(({ name }) => name === "payload_json");

  return {
    files: parts.filter(({ name }) => name.startsWith("files[")),
    payload: decodePayload(new TextDecoder().decode(payload?.data)),
  };
};

// Where a message goes, or Discord's refusal.
type Place =
  | { readonly _tag: "placed"; readonly channelId: string }
  | { readonly _tag: "refused"; readonly answer: PlatformAnswer };

const placed = (channelId: string): Place => ({ _tag: "placed", channelId });

const refused = (answer: PlatformAnswer): Place => ({
  _tag: "refused",
  answer,
});

// Waits longer than any test: the client gives up first, and the server's
// closing ends it. It holds the process open for nothing.
const never = async (): Promise<PlatformAnswer> => {
  await sleep(3_600_000, undefined, { ref: false });

  return empty(504);
};

/** A loopback Discord, whose state tests read. */
export const fakeDiscordApi = Effect.fn("test.fakeDiscordApi")(
  function* fakeDiscordApi(options: FakeDiscordOptions = {}) {
    const messages: FakeDiscordMessage[] = [];
    const threads = new Set<string>();
    const scripts = scripted<DiscordScript>();
    const state = { gone: options.gone === true, nextId: 500_000_000_000_001n };

    const newId = () => {
      const id = String(state.nextId);

      state.nextId += 1n;

      return id;
    };

    const webhookPath = `/api/v10/webhooks/${discordWebhookId}/${discordWebhookToken}`;

    const messagesPath = `${webhookPath}/messages/`;

    // Where a message goes, as Discord decides: a forum's needs a thread's
    // name or id; a name opens a thread, an id goes into one. A refusal, or
    // the channel's id.
    const placeOf = (
      threadId: string | null,
      threadName: JsonValue | undefined
    ): Place => {
      if (threadName !== undefined && options.forum !== true) {
        return refused(discordError(220_003, 400));
      }

      if (
        options.forum === true &&
        threadName === undefined &&
        threadId === null
      ) {
        return refused(discordError(220_001, 400));
      }

      if (threadId !== null) {
        return threads.has(threadId)
          ? placed(threadId)
          : refused(discordError(10_003, 404));
      }

      if (threadName === undefined) {
        return placed(discordChannel);
      }

      const thread = newId();

      threads.add(thread);

      return placed(thread);
    };

    // Execute Webhook.
    const post = (request: PlatformRequest): PlatformAnswer => {
      if (request.query.get("wait") !== "true") {
        return empty(204);
      }

      const { files, payload } = sentOf(request);

      if (payload["content"] === undefined && files.length === 0) {
        return discordError(50_006, 400);
      }

      const place = placeOf(
        request.query.get("thread_id"),
        payload["thread_name"]
      );

      if (place._tag === "refused") {
        return place.answer;
      }

      const message: FakeDiscordMessage = {
        channelId: place.channelId,
        files,
        id: newId(),
        payload,
      };

      messages.push(message);

      return json({
        channel_id: message.channelId,
        id: message.id,
        webhook_id: discordWebhookId,
      });
    };

    const webhook = (): PlatformAnswer =>
      json({
        channel_id: discordChannel,
        guild_id: discordGuild,
        id: discordWebhookId,
        name: options.name ?? "Synthetic announcements",
        token: discordWebhookToken,
        type: options.type ?? 1,
      });

    // Edit and Delete Webhook Message, in the thread the query names.
    const onMessage = (request: PlatformRequest): PlatformAnswer => {
      const id = request.path.slice(messagesPath.length);
      const channelId = request.query.get("thread_id") ?? discordChannel;

      const message = messages.find(
        (held) => held.id === id && held.channelId === channelId
      );

      if (message === undefined) {
        return discordError(10_008, 404);
      }

      if (request.method === "DELETE") {
        messages.splice(messages.indexOf(message), 1);

        return empty(204);
      }

      message.payload = {
        ...message.payload,
        ...decodePayload(textOf(request)),
      };

      return json({ channel_id: message.channelId, id: message.id });
    };

    // Discord's own behaviour, once no script took the request.
    const behaviour = (
      request: PlatformRequest,
      script: DiscordScript | undefined
    ): PlatformAnswer => {
      if (state.gone) {
        return discordError(10_015, 404);
      }

      if (!request.path.startsWith(webhookPath)) {
        return discordError(50_027, 401);
      }

      if (request.path.startsWith(messagesPath)) {
        return onMessage(request);
      }

      if (request.method === "GET") {
        return webhook();
      }

      const posted = post(request);

      if (script?._tag === "postThenDrop") {
        return dropped;
      }

      return script?._tag === "postThenFail"
        ? json({ message: "Synthetic outage" }, script.status)
        : posted;
    };

    const answer = async (
      request: PlatformRequest
    ): Promise<PlatformAnswer> => {
      const route = request.path.startsWith(messagesPath)
        ? `${request.method} message`
        : `${request.method} ${request.path}`;

      const script = scripts.next(route);

      if (script?._tag === "hang") {
        return await never();
      }

      if (
        script !== undefined &&
        script._tag !== "postThenDrop" &&
        script._tag !== "postThenFail"
      ) {
        return script;
      }

      return request.path.startsWith("/api/v10/webhooks/")
        ? behaviour(request, script)
        : empty(404);
    };

    const server = yield* platformServer(answer);

    return {
      ...server,
      /** Deletes the webhook, as a member does in the channel's settings. */
      deleteWebhook: () => {
        state.gone = true;
      },
      messages: (): readonly FakeDiscordMessage[] => [...messages],
      /** Queues answers for a route: `POST <webhook path>`, `PATCH message`. */
      script: (route: string, answers: readonly DiscordScript[]) => {
        scripts.push(route, answers);
      },
      webhookPath,
    };
  }
);

export type FakeDiscord = Effect.Success<ReturnType<typeof fakeDiscordApi>>;
