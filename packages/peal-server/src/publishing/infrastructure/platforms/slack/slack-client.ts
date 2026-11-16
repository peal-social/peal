import { Duration, Effect, Option, Schema } from "effect";
import { HttpClientRequest } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
import type { PublishableMedia } from "#publishing/application/media-for-publishing.ts";
import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import {
  defaultStepTiming,
  sequenced,
} from "#publishing/application/publication-steps.ts";
import type {
  PublicationSteps,
  Readiness,
  StepTiming,
} from "#publishing/application/publication-steps.ts";
import type { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import { SlackOptions } from "#publishing/domain/slack-options.ts";
import {
  commitUnanswered,
  unanswered,
} from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import type { Published } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  streamedBody,
  untraced,
} from "#shared/infrastructure/platforms/public-http.ts";
import {
  escapedForSlack,
  slackAnswerOf,
  slackCode,
  slackMethodUrl,
} from "#shared/infrastructure/platforms/slack-api.ts";
import type {
  SlackAnswer,
  SlackHosts,
} from "#shared/infrastructure/platforms/slack-api.ts";

import {
  slackChannelOf,
  slackMessageOf,
  slackPostId,
} from "./slack-message.ts";
import { commitFailureOf, failureOf } from "./slack-refusal.ts";

/** The HTTP client the adapter sends through: the public one. */
export type SlackHttp = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

export interface SlackClientOptions {
  readonly api: SlackHttp;
  readonly hosts: SlackHosts;
  /**
   * How long to leave Slack after the files are uploaded, before the
   * message that shows them: Slack "will scan the file for malware before
   * making it available". Two seconds unless said.
   */
  readonly settle?: Duration.Duration;
  readonly timing?: StepTiming;
  /** For the files' bytes, which take longer. */
  readonly uploads: SlackHttp;
}

/** A file uploaded for the message, shared nowhere yet. */
export interface UploadedFile {
  readonly altText: string;
  readonly id: string;
}

// What `files.getUploadURLExternal` answers.
const UploadTicketSchema = Schema.Struct({
  file_id: Schema.String.check(Schema.isPattern(/^F[A-Z0-9]{2,30}$/u)),
  upload_url: Schema.String,
});

// What `chat.postMessage` answers: the message's channel and `ts`.
const PostedSchema = Schema.Struct({
  channel: Schema.String.check(Schema.isPattern(/^[CDG][A-Z0-9]{2,30}$/u)),
  ts: Schema.String.check(Schema.isPattern(/^\d{1,12}\.\d{1,9}$/u)),
});

const PermalinkSchema = Schema.Struct({ permalink: Schema.String });

const CompletedSchema = Schema.Struct({ ok: Schema.Literal(true) });

const isSlack = Schema.is(SlackOptions);

/** The most of an image's alt text the upload and the block take. */
const maxAltText = 1000;

/**
 * An image block's `alt_text`, which Slack requires: the member's, or
 * "Image" when they wrote none.
 */
export const altTextOf = (altText: string): string => {
  const written = altText.trim();

  return (written === "" ? "Image" : written).slice(0, maxAltText);
};

/** A section of mrkdwn text, as Block Kit has it. */
interface SectionBlock {
  readonly text: { readonly text: string; readonly type: "mrkdwn" };
  readonly type: "section";
}

/** An image block showing a file uploaded to Slack. */
interface ImageBlock {
  readonly alt_text: string;
  readonly slack_file: { readonly id: string };
  readonly type: "image";
}

export type SlackBlock = ImageBlock | SectionBlock;

/** A message's blocks: its text as a section, then each image. */
export const blocksOf = (
  text: string,
  files: readonly UploadedFile[]
): readonly SlackBlock[] => [
  ...(text.trim() === ""
    ? []
    : [
        {
          text: { text, type: "mrkdwn" },
          type: "section",
        } satisfies SectionBlock,
      ]),
  ...files.map(({ altText, id }): ImageBlock => ({
    alt_text: altText,
    slack_file: { id },
    type: "image",
  })),
];

/** What `chat.postMessage` is sent. */
interface PostFields {
  blocks?: readonly SlackBlock[];
  readonly channel: string;
  text?: string;
  thread_ts?: string;
  readonly unfurl_links: boolean;
}

/** What `files.getUploadURLExternal` is sent. */
interface UploadFields {
  alt_txt?: string;
  readonly filename: string;
  readonly length: string;
}

/** The answer's body as `schema` reads it, any other answer refused. */
export const read = <A, I, E>(
  answer: SlackAnswer,
  schema: Schema.Codec<A, I>,
  refused: (answer: Exclude<SlackAnswer, { readonly _tag: "ok" }>) => E,
  unreadable: () => E
): Effect.Effect<A, E> => {
  if (answer._tag !== "ok") {
    return Effect.fail(refused(answer));
  }

  return Option.match(Schema.decodeUnknownOption(schema)(answer.body), {
    onNone: () => Effect.fail(unreadable()),
    onSome: Effect.succeed,
  });
};

const channelOf = (post: OutgoingPost) =>
  Effect.fromOption(slackChannelOf(post.accountId)).pipe(
    Effect.mapError(() => new BadRequest({ code: "invalidAccount" }))
  );

/**
 * Publishes in the Slack channel the member picked when the app was
 * installed, with the app's bot token (docs.slack.dev, read 2026-11-16).
 *
 * A text alone is one `chat.postMessage`, the commit, its text escaped
 * (`&`, `<`, `>`) so that nothing a member types notifies a channel or a
 * person, `unfurl_links` as the options say. With images, `prepare`
 * uploads each without sharing it (`files.getUploadURLExternal`, the
 * bytes to the address it gives, then one `files.completeUploadExternal`
 * with no channel: "the file will remain private"), which is safe to do
 * again, as a file shared nowhere shows nowhere; the commit is then one
 * `chat.postMessage` whose blocks are the text as a section and each file
 * as an image block (`slack_file`), so Slack answers the message's `ts`
 * at once, and no scope reads files back. A later part replies in the
 * first part's thread (`thread_ts`, the first part's `ts`: "Use the
 * parent message's `ts`, not a reply's").
 *
 * The post id is `<channel>/<ts>`, with the files after a slash; its
 * address is the one `chat.getPermalink` answers (no scope), left out if
 * it answers none. Slack keeps no idempotency key: a commit that may have
 * gone out is unconfirmed (`none`), never sent again.
 */
export const slackClient = Effect.fn("SlackClient.make")(function* slackClient(
  options: SlackClientOptions
) {
  const credentials = yield* PlatformCredentials;
  const media = yield* MediaForPublishing;
  const api = untraced(options.api);
  const uploads = untraced(options.uploads);
  const { hosts } = options;
  const settle = options.settle ?? Duration.seconds(2);

  // One call of a Web API method with the bot's token, its answer read.
  const call = (
    token: PublishingToken,
    method: string,
    body: (
      request: HttpClientRequest.HttpClientRequest
    ) => HttpClientRequest.HttpClientRequest
  ) =>
    api
      .execute(
        HttpClientRequest.post(slackMethodUrl(hosts, method)).pipe(
          HttpClientRequest.bearerToken(token.accessToken),
          body
        )
      )
      .pipe(Effect.flatMap(slackAnswerOf));

  // Uploads one file, shared nowhere: its ticket, then its bytes.
  const uploadOne = (
    token: PublishingToken,
    post: OutgoingPost,
    attachment: MediaAttachment,
    file: PublishableMedia
  ) =>
    Effect.gen(function* uploading() {
      const altText = altTextOf(attachment.altText);
      const written = attachment.altText.trim();

      const fields: UploadFields = {
        filename: file.fileName,
        length: String(file.byteSize),
      };

      if (written !== "") {
        fields.alt_txt = written.slice(0, maxAltText);
      }

      const ticket = yield* call(
        token,
        "files.getUploadURLExternal",
        HttpClientRequest.bodyUrlParams({ ...fields })
      ).pipe(
        Effect.flatMap((answer) =>
          read(
            answer,
            UploadTicketSchema,
            failureOf,
            () => new PlatformUnavailable()
          )
        )
      );

      // The bytes go only to Slack's upload host: the address is Slack's
      // answer, which a server on the way could have changed.
      const address = URL.parse(ticket.upload_url);

      if (
        address === null ||
        address.origin !== new URL(hosts.uploads).origin
      ) {
        yield* Effect.logWarning(
          "Slack answered an upload address on another host: nothing was sent"
        ).pipe(Effect.annotateLogs({ channelId: post.channelId }));

        return yield* new PlatformUnavailable();
      }

      const bytes = yield* media.held(post.workspaceId, attachment.mediaId);

      const response = yield* uploads.execute(
        HttpClientRequest.post(address).pipe(
          streamedBody(bytes, {
            contentLength: file.byteSize,
            contentType: "application/octet-stream",
          })
        )
      );

      // "Slack will return HTTP 200 if the upload is successful; a
      // non-200 response indicates a failure."
      if (response.status !== 200) {
        return yield* new PlatformUnavailable();
      }

      const uploaded: UploadedFile = { altText, id: ticket.file_id };

      return uploaded;
    }).pipe(Effect.scoped);

  const prepare = (
    post: OutgoingPost
  ): Effect.Effect<Readiness<readonly UploadedFile[]>, PublishFailure> => {
    if (post.media.length === 0) {
      return Effect.succeed({ _tag: "ready", prepared: [] });
    }

    return credentials.withToken(post.channelId, (token) =>
      Effect.gen(function* uploadAll() {
        const files: UploadedFile[] = [];

        for (const attachment of post.media) {
          const file = yield* media.describe(
            post.workspaceId,
            attachment.mediaId
          );

          files.push(yield* uploadOne(token, post, attachment, file));
        }

        // No channel: the files stay private until the message shows them.
        yield* call(
          token,
          "files.completeUploadExternal",
          HttpClientRequest.bodyUrlParams({
            files: JSON.stringify(files.map(({ id }) => ({ id }))),
          })
        ).pipe(
          Effect.flatMap((answer) =>
            read(
              answer,
              CompletedSchema,
              failureOf,
              () => new PlatformUnavailable()
            )
          )
        );

        const readiness: Readiness<readonly UploadedFile[]> = Duration.isZero(
          settle
        )
          ? { _tag: "ready", prepared: files }
          : { _tag: "processing", pollAfter: settle, prepared: files };

        return readiness;
      }).pipe(
        Effect.catchTags({
          HttpClientError: unanswered,
          OutboundRequestRefused: unanswered,
        })
      )
    );
  };

  // A link to the message, if Slack gives one: nothing else depends on it.
  const permalinkOf = (
    token: PublishingToken,
    channel: string,
    ts: string
  ): Effect.Effect<Option.Option<string>> =>
    call(
      token,
      "chat.getPermalink",
      HttpClientRequest.bodyUrlParams({ channel, message_ts: ts })
    ).pipe(
      Effect.map((answer) =>
        answer._tag === "ok"
          ? Schema.decodeUnknownOption(PermalinkSchema)(answer.body).pipe(
              Option.map(({ permalink }) => permalink),
              Option.filter((link) => link.startsWith("https://"))
            )
          : Option.none()
      ),
      Effect.orElseSucceed(() => Option.none<string>())
    );

  const commit = (
    post: OutgoingPost,
    files: readonly UploadedFile[]
  ): Effect.Effect<Published, OutcomeUnknown | PublishFailure> =>
    credentials.withToken(post.channelId, (token) =>
      Effect.gen(function* posting() {
        const channel = yield* channelOf(post);
        const text = escapedForSlack(post.text);

        const unfurl = post.options.pipe(
          Option.filter(isSlack),
          Option.exists(({ unfurlLinks }) => unfurlLinks === true)
        );

        const fields: PostFields = { channel, unfurl_links: unfurl };

        if (text.trim() !== "") {
          fields.text = text;
        }

        if (files.length > 0) {
          fields.blocks = blocksOf(text, files);
        }

        const root = post.replyTo.pipe(
          Option.flatMap(({ root: first }) => slackMessageOf(first))
        );

        if (Option.isSome(root)) {
          fields.thread_ts = root.value.ts;
        }

        const answer = yield* call(
          token,
          "chat.postMessage",
          HttpClientRequest.bodyJsonUnsafe(fields)
        ).pipe(
          Effect.catchTags({
            HttpClientError: commitUnanswered,
            OutboundRequestRefused: commitUnanswered,
          })
        );

        // Blocks Slack refuses with images in them: most likely a file it
        // has not finished scanning, and nothing was posted, so a later
        // attempt uploads again.
        if (
          answer._tag === "refused" &&
          answer.code === "invalid_blocks" &&
          files.length > 0
        ) {
          return yield* new PlatformUnavailable({
            code: slackCode(answer.code),
          });
        }

        const posted = yield* read(
          answer,
          PostedSchema,
          commitFailureOf,
          (): OutcomeUnknown | PublishFailure | TokenRejected =>
            new OutcomeUnknown({ reason: "unreadableResponse" })
        );

        const platformPostId = PlatformPostIdSchema.make(
          slackPostId({
            channel: posted.channel,
            files: files.map(({ id }) => id),
            ts: posted.ts,
          })
        );

        const link = yield* permalinkOf(token, posted.channel, posted.ts);

        const published: Published = Option.isSome(link)
          ? { _tag: "published", permalink: link.value, platformPostId }
          : { _tag: "published", platformPostId };

        return published;
      })
    );

  const steps: PublicationSteps<readonly UploadedFile[]> = {
    commit,
    confirmation: { _tag: "none" },
    platform: "slack",
    poll: (_post, prepared) => Effect.succeed({ _tag: "ready", prepared }),
    prepare,
  };

  return sequenced(steps, options.timing ?? defaultStepTiming);
});
