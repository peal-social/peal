import { Effect, Option, Schema } from "effect";
import { HttpClientRequest } from "effect/http";

import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import { TelegramOptions } from "#publishing/domain/telegram-options.ts";
import type { LivePostEditor } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import {
  asRemovalFailure,
  invalidPlatformId,
} from "#publishing/infrastructure/platforms/live-post-remover.ts";
import type { LivePostRemover } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import { unanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";
import { untraced } from "#shared/infrastructure/platforms/public-http.ts";
import { telegramMethodUrl } from "#shared/infrastructure/platforms/telegram-api.ts";
import type { TelegramHosts } from "#shared/infrastructure/platforms/telegram-api.ts";

import type { TelegramHttp } from "./telegram-client.ts";
import { botTokenIn } from "./telegram-client.ts";
import {
  firstMessageOf,
  messagesOf,
  telegramPostOf,
} from "./telegram-message.ts";
import { telegramRefusal, unavailable } from "./telegram-refusal.ts";

const isTelegram = Schema.is(TelegramOptions);

// The post an id names: refused before any call unless it is one of
// Peal's.
const postOf = (platformPostId: PlatformPostId) =>
  Effect.fromOption(telegramPostOf(platformPostId)).pipe(
    Effect.mapError(() => new BadRequest({ code: invalidPlatformId }))
  );

/** What a method that changes messages is sent. */
interface ChangeBody {
  readonly caption?: string;
  readonly chat_id: string;
  readonly link_preview_options?: { readonly is_disabled: true };
  readonly message_id?: number;
  readonly message_ids?: readonly number[];
  readonly text?: string;
}

// One call of a method that changes a message, with the channel's bot.
const changing = (
  options: { readonly api: TelegramHttp; readonly hosts: TelegramHosts },
  token: PublishingToken,
  method: string,
  body: ChangeBody
) =>
  botTokenIn(token.accessToken).pipe(
    Effect.flatMap((bot) =>
      untraced(options.api).execute(
        HttpClientRequest.post(
          telegramMethodUrl(options.hosts, bot, method)
        ).pipe(HttpClientRequest.bodyJsonUnsafe(body))
      )
    ),
    Effect.catchTags({
      HttpClientError: unanswered,
      OutboundRequestRefused: unanswered,
    }),
    Effect.flatMap((response) =>
      response.status === 200
        ? Effect.void
        : telegramRefusal(response, unavailable).pipe(
            Effect.mapError(asRemovalFailure)
          )
    )
  );

/**
 * Deletes every message of a post, an album's included, with one
 * `deleteMessages` ("A JSON-serialized list of 1-100 identifiers of
 * messages to delete"; "If some of the specified messages can't be found,
 * they are skipped", so one gone already is deleted). Telegram deletes a
 * message "only if it was sent less than 48 hours ago": an older one is
 * refused with a 400, which no field tells from another, so it fails as
 * `telegram400` (Bot API 10.4, read 2026-11-16).
 */
export const telegramLivePost =
  (options: {
    readonly api: TelegramHttp;
    readonly hosts: TelegramHosts;
  }): LivePostRemover =>
  (token, platformPostId) =>
    postOf(platformPostId).pipe(
      Effect.flatMap((post) =>
        changing(options, token, "deleteMessages", {
          chat_id: token.accountId,
          message_ids: messagesOf(post),
        })
      ),
      Effect.as("removed" as const)
    );

/**
 * Replaces a post's text: `editMessageText` for a text (`t:`),
 * `editMessageCaption` for the caption of a post with files (`m:`, its
 * first message, which holds an album's caption). The page states no time
 * limit on editing a bot's own message. A message gone answers a 400,
 * which no field tells from another: it fails as `telegram400`.
 */
export const telegramLiveEdit =
  (options: {
    readonly api: TelegramHttp;
    readonly hosts: TelegramHosts;
  }): LivePostEditor =>
  (token, edit) =>
    postOf(edit.platformPostId).pipe(
      Effect.flatMap((post) => {
        const target = {
          chat_id: token.accountId,
          message_id: firstMessageOf(post),
        };

        if (post._tag === "media") {
          return changing(options, token, "editMessageCaption", {
            ...target,
            caption: edit.text,
          });
        }

        const noPreview = edit.options.pipe(
          Option.filter(isTelegram),
          Option.exists(({ linkPreview }) => linkPreview === false)
        );

        return changing(
          options,
          token,
          "editMessageText",
          noPreview
            ? {
                ...target,
                link_preview_options: { is_disabled: true },
                text: edit.text,
              }
            : { ...target, text: edit.text }
        );
      }),
      Effect.as("edited" as const)
    );
