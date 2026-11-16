import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Schema } from "effect";

import {
  dropped,
  empty,
  headerOf,
  json,
  platformServer,
  scripted,
  textOf,
} from "./platform-server.ts";
import type {
  JsonValue,
  PlatformAnswer,
  PlatformRequest,
} from "./platform-server.ts";

// Slack's Web API as an app's bot sees it (docs.slack.dev, read
// 2026-11-16): synthetic ids, and a token that says so and has not a real
// one's shape.

export const slackBotToken = "xoxb-synthetic-bot-token";

export const slackTeamId = "T0SYNTH01";

export const slackChannel = "C0SYNTH01";

/** What every upload address the fake answers carries, as a secret. */
export const slackUploadTicket = "synthetic-upload-ticket";

/** The channel's account id, as the channel keeps it: team and channel. */
export const slackAccount = `${slackTeamId}/${slackChannel}`;

/** A message the bot posted. */
export interface FakeSlackMessage {
  blocks: readonly JsonValue[];
  text: string;
  readonly channel: string;
  /** What `chat.postMessage` was sent. */
  readonly fields: Readonly<Record<string, JsonValue>>;
  readonly threadTs: string | undefined;
  readonly ts: string;
}

/** A file uploaded to Slack, shared nowhere. */
export interface FakeSlackFile {
  readonly altText: string | undefined;
  readonly bytes: Uint8Array | undefined;
  readonly completed: boolean;
  readonly deleted: boolean;
  readonly id: string;
  readonly length: number;
  readonly name: string;
}

/**
 * What the fake does with the next call of a method instead of its own
 * behaviour: an answer; `hang`, which takes the request and never
 * answers; `postThenDrop`, which posts the message and drops the
 * connection.
 */
export type SlackScript =
  | PlatformAnswer
  | { readonly _tag: "hang" }
  | { readonly _tag: "postThenDrop" };

export interface FakeSlackOptions {
  /** The app is not in the channel: posting answers `not_in_channel`. */
  readonly outsideChannel?: boolean;
  /** The bot's token was revoked: every call answers `token_revoked`. */
  readonly revoked?: boolean;
}

const FieldsSchema = Schema.Record(Schema.String, Schema.Json);

const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(FieldsSchema)
);

const FileRefsSchema = Schema.Array(
  Schema.Struct({ id: Schema.String, title: Schema.optionalKey(Schema.String) })
);

const decodeRefs = Schema.decodeUnknownSync(
  Schema.fromJsonString(FileRefsSchema)
);

const decodeBlocks = Schema.decodeUnknownSync(Schema.Array(Schema.Json));

const decodeText = Schema.decodeUnknownSync(Schema.String);

/** Slack's refusal of a call: 200, `ok` false, and its code. */
export const slackError = (error: string): PlatformAnswer =>
  json({ error, ok: false });

const ok = (fields: Readonly<Record<string, JsonValue>> = {}) =>
  json({ ok: true, ...fields });

// What a method was sent: JSON, or a form of text fields.
const sentOf = (request: PlatformRequest): Record<string, JsonValue> =>
  headerOf(request, "content-type").startsWith("application/json")
    ? decodeJson(textOf(request))
    : Object.fromEntries(new URLSearchParams(textOf(request)));

const never = async (): Promise<PlatformAnswer> => {
  await sleep(3_600_000, undefined, { ref: false });

  return empty(504);
};

/** A loopback Slack, whose state tests read. */
export const fakeSlackApi = Effect.fn("test.fakeSlackApi")(
  function* fakeSlackApi(options: FakeSlackOptions = {}) {
    const messages: FakeSlackMessage[] = [];
    const files: FakeSlackFile[] = [];
    const scripts = scripted<SlackScript>();

    const state = {
      nextFile: 1,
      nextTs: 1,
      outsideChannel: options.outsideChannel === true,
      revoked: options.revoked === true,
    };

    const messageAt = (channel: JsonValue | undefined, ts: JsonValue) =>
      messages.find(
        (message) => message.channel === channel && message.ts === ts
      );

    const post = (request: PlatformRequest): PlatformAnswer => {
      const fields = sentOf(request);

      if (fields["channel"] !== slackChannel) {
        return slackError("channel_not_found");
      }

      if (state.outsideChannel) {
        return slackError("not_in_channel");
      }

      const thread = fields["thread_ts"];

      if (
        thread !== undefined &&
        messageAt(slackChannel, thread) === undefined
      ) {
        return slackError("thread_not_found");
      }

      const blocks = decodeBlocks(fields["blocks"] ?? []);

      const ts = `1790000000.${String(state.nextTs).padStart(6, "0")}`;

      state.nextTs += 1;

      messages.push({
        blocks,
        channel: slackChannel,
        fields,
        text: decodeText(fields["text"] ?? ""),
        threadTs: thread === undefined ? undefined : decodeText(thread),
        ts,
      });

      return ok({ channel: slackChannel, message: { ts }, ts });
    };

    const update = (request: PlatformRequest): PlatformAnswer => {
      const fields = sentOf(request);
      const message = messageAt(fields["channel"], fields["ts"] ?? "");

      if (message === undefined) {
        return slackError("message_not_found");
      }

      message.text = decodeText(fields["text"] ?? "");
      // "If the message was created with blocks, and `text` is provided
      // and `blocks` omitted, the blocks will be removed."
      message.blocks = decodeBlocks(fields["blocks"] ?? []);

      return ok({ channel: message.channel, ts: message.ts });
    };

    const remove = (request: PlatformRequest): PlatformAnswer => {
      const fields = sentOf(request);
      const message = messageAt(fields["channel"], fields["ts"] ?? "");

      if (message === undefined) {
        return slackError("message_not_found");
      }

      messages.splice(messages.indexOf(message), 1);

      return ok({ channel: message.channel, ts: message.ts });
    };

    const uploadUrl = (request: PlatformRequest, origin: string) => {
      const fields = sentOf(request);
      const id = `F0SYNTH${String(state.nextFile).padStart(3, "0")}`;

      state.nextFile += 1;

      files.push({
        altText:
          fields["alt_txt"] === undefined
            ? undefined
            : decodeText(fields["alt_txt"]),
        bytes: undefined,
        completed: false,
        deleted: false,
        id,
        length: Number(fields["length"]),
        name: decodeText(fields["filename"] ?? ""),
      });

      // A ticket for the one file, as Slack's address carries one.
      return ok({
        file_id: id,
        upload_url: `${origin}/upload/v1/${id}?ticket=${slackUploadTicket}-${id}`,
      });
    };

    const replaceFile = (id: string, change: Partial<FakeSlackFile>) => {
      const index = files.findIndex((file) => file.id === id);
      const file = files[index];

      if (file !== undefined) {
        files[index] = { ...file, ...change };
      }

      return file;
    };

    const upload = (request: PlatformRequest): PlatformAnswer => {
      const id = request.path.slice("/upload/v1/".length);
      const file = replaceFile(id, { bytes: request.body });

      return file === undefined ? empty(404) : empty(200);
    };

    const complete = (request: PlatformRequest): PlatformAnswer => {
      const fields = sentOf(request);
      const refs = decodeRefs(decodeText(fields["files"] ?? "[]"));

      if (refs.some(({ id }) => files.every((file) => file.id !== id))) {
        return slackError("file_not_found");
      }

      for (const { id } of refs) {
        replaceFile(id, { completed: true });
      }

      return ok({
        files: refs.map(({ id, title }) => ({ id, title: title ?? id })),
      });
    };

    const deleteFile = (request: PlatformRequest): PlatformAnswer => {
      const id = sentOf(request)["file"];
      const file = files.find((each) => each.id === id && !each.deleted);

      if (file === undefined) {
        return slackError("file_not_found");
      }

      replaceFile(file.id, { deleted: true });

      return ok();
    };

    const permalink = (request: PlatformRequest): PlatformAnswer => {
      const fields = sentOf(request);
      const ts = decodeText(fields["message_ts"] ?? "");

      return messageAt(fields["channel"], ts) === undefined
        ? slackError("message_not_found")
        : ok({
            channel: slackChannel,
            permalink: `https://synthetic.slack.com/archives/${slackChannel}/p${ts.replace(".", "")}`,
          });
    };

    const behaviour = (
      method: string,
      request: PlatformRequest,
      origin: string
    ): PlatformAnswer => {
      switch (method) {
        case "chat.postMessage": {
          return post(request);
        }

        case "chat.update": {
          return update(request);
        }

        case "chat.delete": {
          return remove(request);
        }

        case "chat.getPermalink": {
          return permalink(request);
        }

        case "files.getUploadURLExternal": {
          return uploadUrl(request, origin);
        }

        case "files.completeUploadExternal": {
          return complete(request);
        }

        case "files.delete": {
          return deleteFile(request);
        }

        default: {
          return slackError("unknown_method");
        }
      }
    };

    const answer = async (
      request: PlatformRequest,
      origin: string
    ): Promise<PlatformAnswer> => {
      if (request.path.startsWith("/upload/v1/")) {
        const script = scripts.next("upload");

        if (script?._tag === "hang") {
          return await never();
        }

        return script?._tag === "answer" ? script : upload(request);
      }

      if (!request.path.startsWith("/api/")) {
        return empty(404);
      }

      const method = request.path.slice("/api/".length);

      if (headerOf(request, "authorization") !== `Bearer ${slackBotToken}`) {
        return slackError("invalid_auth");
      }

      if (state.revoked) {
        return slackError("token_revoked");
      }

      const script = scripts.next(method);

      if (script?._tag === "hang") {
        return await never();
      }

      if (script?._tag === "postThenDrop") {
        behaviour(method, request, origin);

        return dropped;
      }

      return script ?? behaviour(method, request, origin);
    };

    const server = yield* platformServer(answer);

    return {
      ...server,
      /** The calls of one method, in order. */
      calls: (method: string) =>
        server.requests().filter(({ path }) => path === `/api/${method}`),
      files: (): readonly FakeSlackFile[] => [...files],
      /** Invites the app to the channel. */
      invite: () => {
        state.outsideChannel = false;
      },
      messages: (): readonly FakeSlackMessage[] => [...messages],
      /** Revokes the bot's token, as uninstalling the app does. */
      revoke: () => {
        state.revoked = true;
      },
      /** Queues answers for a method, as `chat.postMessage`, or `upload`. */
      script: (method: string, answers: readonly SlackScript[]) => {
        scripts.push(method, answers);
      },
      /** What a field of a call was sent, read as Slack reads it. */
      sentOf,
    };
  }
);

export type FakeSlack = Effect.Success<ReturnType<typeof fakeSlackApi>>;
