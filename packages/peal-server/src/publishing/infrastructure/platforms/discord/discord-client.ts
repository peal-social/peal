import { Effect, Option, Schema, Stream } from "effect";
import type { Redacted } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
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
import { DiscordOptions } from "#publishing/domain/discord-options.ts";
import { commitUnanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import type { Published } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  discordUserAgent,
  webhookOf,
  webhookUrl,
} from "#shared/infrastructure/platforms/discord-api.ts";
import type { DiscordHosts } from "#shared/infrastructure/platforms/discord-api.ts";
import {
  randomBoundary,
  multipartFormBody,
} from "#shared/infrastructure/platforms/multipart-stream.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  streamedBody,
  untraced,
} from "#shared/infrastructure/platforms/public-http.ts";

import {
  accountOf,
  allowedMentionsOf,
  discordPostIdOf,
  discordPostIdText,
  messageFlagsOf,
} from "./discord-message.ts";
import type { AllowedMentions, DiscordAccount } from "./discord-message.ts";
import { discordRefusal, unknownOutcome } from "./discord-refusal.ts";

/** The HTTP client the adapter sends through: the public one. */
export type DiscordHttp = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

export interface DiscordClientOptions {
  readonly api: DiscordHttp;
  readonly hosts: DiscordHosts;
  readonly timing?: StepTiming;
  /** For messages with files, which take longer. */
  readonly uploads: DiscordHttp;
}

// The message Execute Webhook answers with `wait=true`: "returns the
// created message body". `channel_id` is the thread's when the message went
// into one, or opened a forum post.
const MessageSchema = Schema.Struct({
  channel_id: Schema.String.check(Schema.isPattern(/^\d{1,20}$/u)),
  id: Schema.String.check(Schema.isPattern(/^\d{1,20}$/u)),
});

const isDiscord = Schema.is(DiscordOptions);

/**
 * The webhook a channel's secret names: one Peal did not keep itself is
 * refused, and never sent anywhere.
 */
export const webhookIn = (secret: Redacted.Redacted) =>
  Effect.fromOption(webhookOf(secret)).pipe(
    Effect.mapError(() => new BadRequest({ code: "invalidCredential" }))
  );

/** What Execute Webhook is sent beside the files. */
interface MessagePayload {
  allowed_mentions: AllowedMentions;
  attachments?: readonly { description?: string; id: number }[];
  content?: string;
  flags?: number;
  thread_name?: string;
}

// What the message says beside its files, in Discord's JSON: each
// field only when it says something.
const payloadOf = (post: OutgoingPost): MessagePayload => {
  const chosen = post.options.pipe(Option.filter(isDiscord));

  const payload: MessagePayload = {
    allowed_mentions: allowedMentionsOf(chosen),
  };

  const flags = messageFlagsOf(chosen);

  const threadName = chosen.pipe(
    Option.flatMapNullishOr(({ threadName: name }) => name),
    // Only the first part opens a forum post.
    Option.filter(() => post.part === 0)
  );

  if (post.text.trim() !== "") {
    payload.content = post.text;
  }

  if (flags !== 0) {
    payload.flags = flags;
  }

  if (Option.isSome(threadName)) {
    payload.thread_name = threadName.value;
  }

  return payload;
};

// The thread a later part goes into: the one the first part opened, as
// its post id says. Never guessed from the channel: a webhook moved to
// another channel answers there with the same token.
const threadOf = (post: OutgoingPost) =>
  post.replyTo.pipe(
    Option.flatMap(({ root }) => discordPostIdOf(root)),
    Option.filter(({ inThread }) => inThread),
    Option.map(({ channelId }) => channelId)
  );

// The message Discord made, named with the webhook that sent it and
// whether it is in a thread.
const answered = (
  account: DiscordAccount,
  sent: { readonly inThread: boolean; readonly webhookId: string },
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<
  Published,
  | HttpClientError.HttpClientError
  | OutcomeUnknown
  | PublishFailure
  | Schema.SchemaError
  | TokenRejected
> =>
  response.status === 200
    ? HttpClientResponse.schemaBodyJson(MessageSchema)(response).pipe(
        Effect.map(({ channel_id: channel, id }): Published => ({
          _tag: "published",
          permalink: `https://discord.com/channels/${account.guildId}/${channel}/${id}`,
          platformPostId: PlatformPostIdSchema.make(
            discordPostIdText({
              channelId: channel,
              inThread: sent.inThread,
              messageId: id,
              webhookId: sent.webhookId,
            })
          ),
        }))
      )
    : discordRefusal(response, unknownOutcome);

/**
 * Publishes in a Discord channel through its webhook: one request,
 * `POST /webhooks/{id}/{token}?wait=true` (Execute Webhook, read
 * 2026-11-16), JSON for a text alone, a multipart form (`payload_json` and
 * `files[n]`, each file streamed in turn) with media, alt text in each
 * attachment's `description`. Without `wait`, "a message that is not saved
 * does not return an error": Peal always waits. It always sends
 * `allowed_mentions`, so the text notifies nobody it mentions unless the
 * options say so. A later part goes after the part before it, in the
 * thread the first part opened (`thread_id`) when it opened one, as a
 * forum post. The post id names the webhook that sent the message and
 * whether it is in a thread (`discordPostIdText`).
 *
 * Discord keeps no idempotency key for a webhook (`nonce` is the bot's
 * Create Message's alone) and lists no message of one: a commit that may
 * have gone out is unconfirmed (`none`), never sent again.
 */
export const discordClient = Effect.fn("DiscordClient.make")(
  function* discordClient(options: DiscordClientOptions) {
    const credentials = yield* PlatformCredentials;
    const media = yield* MediaForPublishing;
    const api = untraced(options.api);
    const uploads = untraced(options.uploads);
    const { hosts } = options;

    const commit = Effect.fn("DiscordClient.commit")(function* commit(
      post: OutgoingPost
    ) {
      const account = yield* accountOf(post.accountId);
      const thread = threadOf(post);

      const query: Record<string, string> = Option.match(thread, {
        onNone: () => ({ wait: "true" }),
        onSome: (id) => ({ thread_id: id, wait: "true" }),
      });

      const payload = payloadOf(post);

      // In a thread: one the first part opens, or the first part's.
      const inThread =
        payload.thread_name !== undefined || Option.isSome(thread);

      return yield* Effect.scoped(
        Effect.gen(function* sending() {
          // Every file waits for its turn before the request opens.
          const described = yield* Effect.all(
            post.media.map(({ mediaId }) =>
              media.describe(post.workspaceId, mediaId)
            )
          );

          const streams = yield* media.heldInTurn(
            post.workspaceId,
            post.media.map(({ mediaId }) => mediaId)
          );

          const request = (url: URL) => {
            const base = HttpClientRequest.post(url).pipe(
              HttpClientRequest.setHeader("user-agent", discordUserAgent)
            );

            if (post.media.length === 0) {
              return base.pipe(HttpClientRequest.bodyJsonUnsafe(payload));
            }

            // Each file by its place, `files[n]`, described by
            // `attachments[n]`, its alt text when it has one.
            const attachments = post.media.map(({ altText }, index) =>
              altText.trim() === ""
                ? { id: index }
                : { description: altText, id: index }
            );

            const form = multipartFormBody({
              boundary: randomBoundary(),
              fields: [
                {
                  name: "payload_json",
                  value: JSON.stringify({ ...payload, attachments }),
                },
              ],
              files: described.map((file, index) => ({
                byteSize: file.byteSize,
                bytes: streams[index] ?? Stream.empty,
                contentType: file.contentType,
                fileName: file.fileName,
                name: `files[${String(index)}]`,
              })),
            });

            return base.pipe(streamedBody(form.bytes, form));
          };

          const client = post.media.length === 0 ? api : uploads;

          return yield* credentials.withToken(
            post.channelId,
            ({ accessToken }) =>
              webhookIn(accessToken).pipe(
                Effect.flatMap((webhook) =>
                  client
                    .execute(request(webhookUrl(hosts, webhook, "", query)))
                    .pipe(
                      Effect.flatMap((response) =>
                        answered(
                          account,
                          { inThread, webhookId: webhook.id },
                          response
                        )
                      ),
                      Effect.catchTags({
                        HttpClientError: commitUnanswered,
                        OutboundRequestRefused: commitUnanswered,
                        SchemaError: commitUnanswered,
                      })
                    )
                )
              )
          );
        })
      );
    });

    const steps: PublicationSteps<undefined> = {
      commit,
      confirmation: { _tag: "none" },
      platform: "discord",
      poll: () => Effect.succeed({ _tag: "ready", prepared: undefined }),
      prepare: () => Effect.succeed({ _tag: "ready", prepared: undefined }),
    };

    return sequenced(steps, options.timing ?? defaultStepTiming);
  }
);
