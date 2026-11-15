import { Duration, Effect, Option, Redacted, Schema, Stream } from "effect";
import { HttpClientRequest } from "effect/http";
import type {
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from "effect/http";

import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
import type {
  MediaFailure,
  PublishableMedia,
} from "#publishing/application/media-for-publishing.ts";
import type { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import {
  defaultStepTiming,
  sequenced,
} from "#publishing/application/publication-steps.ts";
import type {
  PublicationSteps,
  StepTiming,
} from "#publishing/application/publication-steps.ts";
import { TelegramOptions } from "#publishing/domain/telegram-options.ts";
import { commitUnanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import type { Published } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  formBoundary,
  multipartFormBody,
} from "#shared/infrastructure/platforms/multipart-stream.ts";
import type {
  MultipartField,
  MultipartFile,
} from "#shared/infrastructure/platforms/multipart-stream.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  streamedBody,
  untraced,
} from "#shared/infrastructure/platforms/public-http.ts";
import {
  isBotToken,
  telegramMethodUrl,
  telegramResult,
} from "#shared/infrastructure/platforms/telegram-api.ts";
import type { TelegramHosts } from "#shared/infrastructure/platforms/telegram-api.ts";

import {
  firstMessageOf,
  mediaPostId,
  telegramPostOf,
  textPostId,
} from "./telegram-message.ts";
import { telegramRefusal, unknownOutcome } from "./telegram-refusal.ts";

/** The HTTP client the adapter sends through: the public one. */
export type TelegramHttp = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

export interface TelegramClientOptions {
  readonly api: TelegramHttp;
  readonly hosts: TelegramHosts;
  readonly timing?: StepTiming;
  /** For messages with files, which take longer. */
  readonly uploads: TelegramHttp;
}

// The Message a send method answers: its id, and the chat's public name,
// which links to it.
const MessageSchema = Schema.Struct({
  chat: Schema.Struct({ username: Schema.optionalKey(Schema.String) }),
  message_id: Schema.Int,
});

type Message = typeof MessageSchema.Type;

// What answering a call can fail with, short of Telegram's refusal.
type AnswerError = HttpClientError.HttpClientError | Schema.SchemaError;

const isTelegram = Schema.is(TelegramOptions);

/** The bot's token, as the channel keeps it: refused unless it is one. */
export const botTokenIn = (
  secret: Redacted.Redacted
): Effect.Effect<Redacted.Redacted, BadRequest> =>
  Effect.fromOption(
    Option.some(secret).pipe(
      Option.filter((token) => isBotToken(Redacted.value(token)))
    )
  ).pipe(Effect.mapError(() => new BadRequest({ code: "invalidCredential" })));

/** How a file goes out: alone, by its method and field, or in an album. */
interface FileKind {
  /** Its type in an album; none for a GIF, which an album takes none of. */
  readonly album: Option.Option<"photo" | "video">;
  readonly field: string;
  readonly method: "sendAnimation" | "sendPhoto" | "sendVideo";
}

const kinds = new Map<string, FileKind>([
  [
    "image/gif",
    { album: Option.none(), field: "animation", method: "sendAnimation" },
  ],
  [
    "image/jpeg",
    { album: Option.some("photo"), field: "photo", method: "sendPhoto" },
  ],
  [
    "image/png",
    { album: Option.some("photo"), field: "photo", method: "sendPhoto" },
  ],
  [
    "video/mp4",
    { album: Option.some("video"), field: "video", method: "sendVideo" },
  ],
]);

// The rules take no other type: one is refused here, before any call.
const kindOf = (file: PublishableMedia): Option.Option<FileKind> =>
  Option.fromUndefinedOr(kinds.get(file.contentType));

/** A video's facts, which Telegram shows before it plays. */
interface VideoFacts {
  duration?: number;
  height?: number;
  supports_streaming?: true;
  width?: number;
}

/** An album's item: a photo or a video, by the form's file it names. */
interface AlbumItem extends VideoFacts {
  caption?: string;
  readonly media: string;
  readonly type: "photo" | "video";
}

/** What a send method is sent, but the file. */
interface SendFields extends VideoFacts {
  caption?: string;
  readonly chat_id: string;
  disable_notification?: true;
  link_preview_options?: { readonly is_disabled: true };
  media?: readonly AlbumItem[];
  reply_parameters?: { readonly message_id: number };
  text?: string;
}

// The video's size and its length in whole seconds, as the media library
// probed them, and that it plays as it loads.
const withVideoFacts = <F extends VideoFacts>(
  fields: F,
  file: PublishableMedia
): F => {
  const facts: F = { ...fields, supports_streaming: true };

  if (Option.isSome(file.dimensions)) {
    facts.height = file.dimensions.value.height;
    facts.width = file.dimensions.value.width;
  }

  if (Option.isSome(file.duration)) {
    facts.duration = Math.round(Duration.toSeconds(file.duration.value));
  }

  return facts;
};

// What every send method takes: the chat, silence, and the message it
// replies to, the first of the part before.
const commonFields = (post: OutgoingPost): SendFields => {
  const fields: SendFields = { chat_id: post.accountId };
  const chosen = post.options.pipe(Option.filter(isTelegram));

  const replyTo = post.replyTo.pipe(
    Option.flatMap(({ parent }) => telegramPostOf(parent)),
    Option.map(firstMessageOf)
  );

  if (Option.exists(chosen, ({ silent }) => silent === true)) {
    fields.disable_notification = true;
  }

  if (Option.isSome(replyTo)) {
    fields.reply_parameters = { message_id: replyTo.value };
  }

  return fields;
};

// A text alone, as sendMessage's JSON.
const messageBody = (post: OutgoingPost): SendFields => {
  const fields: SendFields = { ...commonFields(post), text: post.text };

  const noPreview = post.options.pipe(
    Option.filter(isTelegram),
    Option.exists(({ linkPreview }) => linkPreview === false)
  );

  if (noPreview) {
    fields.link_preview_options = { is_disabled: true };
  }

  return fields;
};

// The text as a caption, when there is one.
const withCaption = <F extends { caption?: string }>(
  fields: F,
  text: string
): F => (text.trim() === "" ? fields : { ...fields, caption: text });

const isText = Schema.is(Schema.String);

// A form's fields: a text as it is, anything else as its JSON (a number,
// `true`, the album's `media`, `reply_parameters`).
const formFields = (fields: SendFields): readonly MultipartField[] => {
  const entries: readonly (readonly [string, unknown])[] =
    Object.entries(fields);

  return entries.map(([name, value]) => ({
    name,
    value: isText(value) ? value : JSON.stringify(value),
  }));
};

// The post as Peal keeps it, linked where the chat has a public name.
const publishedAs = (
  id: string,
  messages: readonly [Message, ...Message[]]
): Published => {
  const [first] = messages;
  const name = first.chat.username;
  const platformPostId = PlatformPostIdSchema.make(id);

  return name === undefined
    ? { _tag: "published", platformPostId }
    : {
        _tag: "published",
        permalink: `https://t.me/${name}/${String(first.message_id)}`,
        platformPostId,
      };
};

const oneMessage = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Message, AnswerError> =>
  telegramResult(MessageSchema)(response).pipe(
    Effect.map(({ result }) => result)
  );

const albumMessages = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<readonly [Message, ...Message[]], AnswerError> =>
  telegramResult(Schema.NonEmptyArray(MessageSchema))(response).pipe(
    Effect.map(({ result }) => result)
  );

/** A file of the part, with the bytes it is sent with. */
interface HeldFile {
  readonly bytes: Stream.Stream<Uint8Array, MediaFailure>;
  readonly file: PublishableMedia;
}

const formFile = (
  { bytes, file }: HeldFile,
  name: string
): MultipartFile<MediaFailure, never> => ({
  byteSize: file.byteSize,
  bytes,
  contentType: file.contentType,
  fileName: file.fileName,
  name,
});

// An album's items, photos and videos, the text the first one's caption;
// none if a file cannot be in one.
const albumOf = (post: OutgoingPost, held: readonly HeldFile[]) => {
  const items = held.flatMap(({ file }, index) => {
    const type = kindOf(file).pipe(Option.flatMap(({ album }) => album));

    if (Option.isNone(type)) {
      return [];
    }

    const item: AlbumItem = {
      media: `attach://file${String(index)}`,
      type: type.value,
    };

    const described =
      type.value === "video" ? withVideoFacts(item, file) : item;

    return [index === 0 ? withCaption(described, post.text) : described];
  });

  return items.length === held.length ? Option.some(items) : Option.none();
};

/**
 * Publishes in a Telegram channel or group with the member's own bot
 * (Bot API 10.4, read 2026-11-16), one request a part, by what it holds:
 * a text alone with `sendMessage`, in plain text (no `parse_mode`); one
 * photo with `sendPhoto`, a GIF with `sendAnimation`, a video with
 * `sendVideo` (`supports_streaming`, its size and length); 2 to 10 files
 * with `sendMediaGroup`, the text the first one's caption. Every file is
 * uploaded in the request (`multipart/form-data`, `attach://`), never
 * handed by address, which Telegram fetches up to 5 MB for photos and
 * 20 MB for other files only. A later part replies to the part before it
 * (`reply_parameters`, by its first message).
 *
 * The post id says what was sent: `t:<id>` for a text, `m:<ids>` for
 * files, every message of an album. Its address is `t.me/<chat>/<id>` when
 * the chat has a public name.
 *
 * Telegram keeps no idempotency key and lists no chat's messages: a
 * commit that may have gone out is unconfirmed (`none`), never sent again.
 */
export const telegramClient = Effect.fn("TelegramClient.make")(
  function* telegramClient(options: TelegramClientOptions) {
    const credentials = yield* PlatformCredentials;
    const media = yield* MediaForPublishing;
    const api = untraced(options.api);
    const uploads = untraced(options.uploads);
    const { hosts } = options;

    // One call of `method` with the channel's bot: the answer read by
    // `answer`, any other a refusal, none an unknown outcome.
    const call = <A>(
      post: OutgoingPost,
      method: string,
      client: TelegramHttp,
      body: (
        request: HttpClientRequest.HttpClientRequest
      ) => HttpClientRequest.HttpClientRequest,
      answer: (
        response: HttpClientResponse.HttpClientResponse
      ) => Effect.Effect<A, AnswerError>
    ) =>
      credentials.withToken(post.channelId, ({ accessToken }) =>
        botTokenIn(accessToken).pipe(
          Effect.flatMap((token) =>
            client.execute(
              HttpClientRequest.post(
                telegramMethodUrl(hosts, token, method)
              ).pipe(body)
            )
          ),
          Effect.flatMap(
            (
              response
            ): Effect.Effect<
              A,
              AnswerError | OutcomeUnknown | PublishFailure | TokenRejected
            > =>
              response.status === 200
                ? answer(response)
                : telegramRefusal(response, unknownOutcome)
          ),
          Effect.catchTags({
            HttpClientError: commitUnanswered,
            OutboundRequestRefused: commitUnanswered,
            SchemaError: commitUnanswered,
          })
        )
      );

    const sendText = (post: OutgoingPost) =>
      call(
        post,
        "sendMessage",
        api,
        HttpClientRequest.bodyJsonUnsafe(messageBody(post)),
        oneMessage
      ).pipe(
        Effect.map((message) =>
          publishedAs(textPostId(message.message_id), [message])
        )
      );

    const sendOne = (post: OutgoingPost, held: HeldFile, kind: FileKind) => {
      const fields = withCaption(commonFields(post), post.text);

      const form = multipartFormBody({
        boundary: formBoundary(post.idempotencyKey),
        fields: formFields(
          kind.method === "sendVideo"
            ? withVideoFacts(fields, held.file)
            : fields
        ),
        files: [formFile(held, kind.field)],
      });

      return call(
        post,
        kind.method,
        uploads,
        streamedBody(form.bytes, form),
        oneMessage
      ).pipe(
        Effect.map((message) =>
          publishedAs(mediaPostId([message.message_id]), [message])
        )
      );
    };

    const sendAlbum = (
      post: OutgoingPost,
      held: readonly HeldFile[],
      items: readonly AlbumItem[]
    ) => {
      const form = multipartFormBody({
        boundary: formBoundary(post.idempotencyKey),
        fields: formFields({ ...commonFields(post), media: items }),
        files: held.map((file, index) =>
          formFile(file, `file${String(index)}`)
        ),
      });

      return call(
        post,
        "sendMediaGroup",
        uploads,
        streamedBody(form.bytes, form),
        albumMessages
      ).pipe(
        Effect.map((messages) =>
          publishedAs(
            mediaPostId(messages.map(({ message_id: id }) => id)),
            messages
          )
        )
      );
    };

    const sendFiles = Effect.fn("TelegramClient.sendFiles")(function* sendFiles(
      post: OutgoingPost
    ) {
      const files = yield* Effect.all(
        post.media.map(({ mediaId }) =>
          media.describe(post.workspaceId, mediaId)
        )
      );

      // Every file waits for its turn before the request opens.
      const streams = yield* media.heldInTurn(
        post.workspaceId,
        post.media.map(({ mediaId }) => mediaId)
      );

      const held = files.map((file, index) => ({
        bytes: streams[index] ?? Stream.empty,
        file,
      }));

      const [only] = held;

      if (held.length === 1 && only !== undefined) {
        const kind = kindOf(only.file);

        return Option.isNone(kind)
          ? yield* new MediaRejected({ code: "unsupportedType" })
          : yield* sendOne(post, only, kind.value);
      }

      const items = albumOf(post, held);

      return Option.isNone(items)
        ? yield* new MediaRejected({ code: "unsupportedType" })
        : yield* sendAlbum(post, held, items.value);
    }, Effect.scoped);

    const commit = (post: OutgoingPost) =>
      post.media.length === 0 ? sendText(post) : sendFiles(post);

    const steps: PublicationSteps<undefined> = {
      commit,
      confirmation: { _tag: "none" },
      platform: "telegram",
      poll: () => Effect.succeed({ _tag: "ready", prepared: undefined }),
      prepare: () => Effect.succeed({ _tag: "ready", prepared: undefined }),
    };

    return sequenced(steps, options.timing ?? defaultStepTiming);
  }
);
