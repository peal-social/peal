import { Effect, Option, Schema } from "effect";
import { HttpClientRequest } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import { DiscordOptions } from "#publishing/domain/discord-options.ts";
import { postGone } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import type { LivePostEditor } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import {
  asRemovalFailure,
  invalidPlatformId,
} from "#publishing/infrastructure/platforms/live-post-remover.ts";
import type { LivePostRemover } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import { unanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";
import {
  discordCodeOf,
  discordCodes,
  discordUserAgent,
  webhookUrl,
} from "#shared/infrastructure/platforms/discord-api.ts";
import type { DiscordHosts } from "#shared/infrastructure/platforms/discord-api.ts";
import { untraced } from "#shared/infrastructure/platforms/public-http.ts";

import type { DiscordHttp } from "./discord-client.ts";
import { webhookIn } from "./discord-client.ts";
import {
  accountOf,
  allowedMentionsOf,
  discordPostIdOf,
} from "./discord-message.ts";
import { discordRefusal, unavailable } from "./discord-refusal.ts";

const isDiscord = Schema.is(DiscordOptions);

// The message a post id names, in the channel's webhook: refused before
// any call when the id is not one of Peal's, and the thread it is in when
// it is not the webhook's own channel.
const messageOf = (token: PublishingToken, platformPostId: PlatformPostId) =>
  Effect.gen(function* message() {
    const account = yield* accountOf(token.accountId);
    const id = discordPostIdOf(platformPostId);

    if (Option.isNone(id)) {
      return yield* new BadRequest({ code: invalidPlatformId });
    }

    const { channelId, messageId } = id.value;

    const query: Record<string, string> =
      channelId === account.channelId ? {} : { thread_id: channelId };

    return { messageId, query };
  });

// Discord's "unknown message": the message is gone.
const isUnknownMessage = (response: HttpClientResponse.HttpClientResponse) =>
  response.status === 404
    ? discordCodeOf(response).pipe(
        Effect.map(Option.contains<number>(discordCodes.unknownMessage))
      )
    : Effect.succeed(false);

/**
 * Deletes a message of the channel's webhook with `DELETE
 * /webhooks/{id}/{token}/messages/{message.id}` ("Returns a 204 No Content
 * response on success"), with `thread_id` for one in a thread
 * (docs.discord.com/developers/resources/webhook, read 2026-11-16).
 * Discord's unknown message (10008) is `alreadyGone`; an unknown webhook
 * (10015), the webhook deleted, is a refused token. A post Peal cannot
 * tell is a message of its own is refused before any call.
 */
export const discordLivePost =
  (options: {
    readonly api: DiscordHttp;
    readonly hosts: DiscordHosts;
  }): LivePostRemover =>
  (token, platformPostId) =>
    Effect.gen(function* remove() {
      const { messageId, query } = yield* messageOf(token, platformPostId);
      const webhook = yield* webhookIn(token.accessToken);

      const response = yield* untraced(options.api)
        .execute(
          HttpClientRequest.delete(
            webhookUrl(options.hosts, webhook, `/messages/${messageId}`, query)
          ).pipe(HttpClientRequest.setHeader("user-agent", discordUserAgent))
        )
        .pipe(
          Effect.catchTags({
            HttpClientError: unanswered,
            OutboundRequestRefused: unanswered,
          })
        );

      if (response.status === 204 || response.status === 200) {
        return "removed" as const;
      }

      if (yield* isUnknownMessage(response)) {
        return "alreadyGone" as const;
      }

      return yield* discordRefusal(response, unavailable).pipe(
        Effect.mapError(asRemovalFailure)
      );
    });

/**
 * Replaces a message's text with `PATCH /webhooks/{id}/{token}/messages/
 * {message.id}`, sending `content` and the `allowed_mentions` the target's
 * options ask, nothing else: "To remove or replace files you will have to
 * supply the attachments field", so its files stay
 * (docs.discord.com/developers/resources/webhook, read 2026-11-16). An
 * unknown message is `postGone`.
 */
export const discordLiveEdit =
  (options: {
    readonly api: DiscordHttp;
    readonly hosts: DiscordHosts;
  }): LivePostEditor =>
  (token, edit) =>
    Effect.gen(function* edited() {
      const { messageId, query } = yield* messageOf(token, edit.platformPostId);

      const webhook = yield* webhookIn(token.accessToken);
      const chosen = edit.options.pipe(Option.filter(isDiscord));

      const response = yield* untraced(options.api)
        .execute(
          HttpClientRequest.patch(
            webhookUrl(options.hosts, webhook, `/messages/${messageId}`, query)
          ).pipe(
            HttpClientRequest.setHeader("user-agent", discordUserAgent),
            HttpClientRequest.bodyJsonUnsafe({
              allowed_mentions: allowedMentionsOf(chosen),
              content: edit.text,
            })
          )
        )
        .pipe(
          Effect.catchTags({
            HttpClientError: unanswered,
            OutboundRequestRefused: unanswered,
          })
        );

      if (response.status === 200) {
        return "edited" as const;
      }

      if (yield* isUnknownMessage(response)) {
        return yield* new BadRequest({ code: postGone });
      }

      return yield* discordRefusal(response, unavailable).pipe(
        Effect.mapError(asRemovalFailure)
      );
    });
