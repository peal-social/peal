import { Effect, Option } from "effect";
import { HttpClientRequest } from "effect/http";

import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import { unansweredAfterSending } from "#publishing/domain/removal-decision.ts";
import { postGone } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import type { LivePostEditor } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import {
  asRemovalFailure,
  invalidPlatformId,
} from "#publishing/infrastructure/platforms/live-post-remover.ts";
import type { LivePostRemover } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import { sentUnanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";
import { untraced } from "#shared/infrastructure/platforms/public-http.ts";
import {
  escapedForSlack,
  slackAnswerOf,
  slackMethodUrl,
} from "#shared/infrastructure/platforms/slack-api.ts";
import type {
  SlackAnswer,
  SlackHosts,
} from "#shared/infrastructure/platforms/slack-api.ts";

import { altTextOf, blocksOf, fallbackTextOf } from "./slack-client.ts";
import type { SlackBlock, SlackHttp } from "./slack-client.ts";
import { slackChannelOf, slackMessageOf } from "./slack-message.ts";
import type { SlackMessage } from "./slack-message.ts";
import { failureOf } from "./slack-refusal.ts";

interface SlackLiveOptions {
  readonly api: SlackHttp;
  readonly hosts: SlackHosts;
}

// The message an id names, in the account's own channel: refused before
// any call unless it is one of Peal's there.
const messageOf = (token: PublishingToken, platformPostId: PlatformPostId) =>
  Effect.fromOption(
    Option.all({
      channel: slackChannelOf(token.accountId),
      message: slackMessageOf(platformPostId),
    }).pipe(
      Option.filter(({ channel, message }) => message.channel === channel),
      Option.map(({ message }) => message)
    )
  ).pipe(Effect.mapError(() => new BadRequest({ code: invalidPlatformId })));

/** What a method that changes a message, or deletes a file, is sent. */
interface ChangeBody {
  readonly blocks?: readonly SlackBlock[];
  readonly channel?: string;
  readonly file?: string;
  readonly text?: string;
  readonly ts?: string;
}

// One call of a method that changes a message, answered. A 5xx, or an
// answer that is not Slack's, reached Slack, which may have done it.
const changing = (
  options: SlackLiveOptions,
  token: PublishingToken,
  method: string,
  body: ChangeBody
) =>
  untraced(options.api)
    .execute(
      HttpClientRequest.post(slackMethodUrl(options.hosts, method)).pipe(
        HttpClientRequest.bearerToken(token.accessToken),
        HttpClientRequest.bodyJsonUnsafe(body)
      )
    )
    .pipe(
      Effect.catchTags({
        HttpClientError: sentUnanswered,
        OutboundRequestRefused: sentUnanswered,
      }),
      Effect.flatMap(slackAnswerOf)
    );

// Slack's answer as a change's outcome: done, or one of `gone` (the
// message, or the file, Slack has no more), or a failure.
const settled = (
  answer: SlackAnswer,
  gone: ReadonlySet<string>
): Effect.Effect<"done" | "gone", ReturnType<typeof asRemovalFailure>> => {
  if (answer._tag === "ok") {
    return Effect.succeed("done");
  }

  if (answer._tag === "refused" && gone.has(answer.code)) {
    return Effect.succeed("gone");
  }

  return Effect.fail(
    answer._tag === "unknown"
      ? new PlatformUnavailable({ code: unansweredAfterSending })
      : asRemovalFailure(failureOf(answer))
  );
};

const messageGone: ReadonlySet<string> = new Set(["message_not_found"]);

const fileGone: ReadonlySet<string> = new Set([
  "file_deleted",
  "file_not_found",
]);

// Deletes the images a message showed, shared nowhere else, once the
// message is gone: as far as Slack lets it, a file it keeps (a workspace
// that turned file deletion off, `file_deleting_disabled`) logged by its
// code and left, as the post is gone all the same.
const deleteFiles = (
  options: SlackLiveOptions,
  token: PublishingToken,
  message: SlackMessage
) =>
  Effect.forEach(
    message.files,
    (file) =>
      changing(options, token, "files.delete", { file }).pipe(
        Effect.flatMap((answer) => settled(answer, fileGone)),
        Effect.matchEffect({
          onFailure: (refusal) =>
            Effect.logWarning(
              "Slack kept an image of a message Peal deleted"
            ).pipe(
              Effect.annotateLogs({
                code:
                  refusal._tag === "BadRequest" ? refusal.code : refusal._tag,
              })
            ),
          onSuccess: () => Effect.void,
        })
      ),
    { discard: true }
  );

/**
 * Deletes a message with `chat.delete`, then the images it showed with
 * `files.delete` (`files:write`), which nothing else shows; a message
 * Slack no longer has (`message_not_found`) is gone already, and its files
 * are deleted all the same, one gone already counting as deleted, one
 * Slack keeps logged: the removal is done once the message is
 * (docs.slack.dev, methods/chat.delete and files.delete, read 2026-11-16).
 */
export const slackLivePost =
  (options: SlackLiveOptions): LivePostRemover =>
  (token, platformPostId) =>
    messageOf(token, platformPostId).pipe(
      Effect.flatMap((message) =>
        changing(options, token, "chat.delete", {
          channel: message.channel,
          ts: message.ts,
        }).pipe(
          Effect.flatMap((answer) => settled(answer, messageGone)),
          Effect.tap(() => deleteFiles(options, token, message))
        )
      ),
      Effect.map((outcome) =>
        outcome === "done" ? ("removed" as const) : ("alreadyGone" as const)
      )
    );

/**
 * Replaces a message's text with `chat.update`, escaped as it was sent.
 * A message with images is sent its blocks again, its text as their
 * section and each image with the alt text the part has, as "the `blocks`
 * will be removed" from a message sent a text alone. A message gone is
 * `postGone`; any other refusal keeps Slack's code (`edit_window_closed`:
 * the workspace no longer lets messages be edited).
 */
export const slackLiveEdit =
  (options: SlackLiveOptions): LivePostEditor =>
  (token, edit) =>
    messageOf(token, edit.platformPostId).pipe(
      Effect.flatMap((message) => {
        const text = escapedForSlack(edit.text);
        const target = { channel: message.channel, ts: message.ts };

        const files = message.files.map((id, index) => ({
          altText: altTextOf(edit.media[index]?.altText ?? ""),
          id,
        }));

        const fallback = Option.getOrElse(
          fallbackTextOf(text, files),
          () => text
        );

        const body =
          files.length === 0
            ? { ...target, text }
            : { ...target, blocks: blocksOf(text, files), text: fallback };

        return changing(options, token, "chat.update", body);
      }),
      Effect.flatMap((answer) => settled(answer, messageGone)),
      Effect.flatMap((outcome) =>
        outcome === "done"
          ? Effect.succeed("edited" as const)
          : Effect.fail(new BadRequest({ code: postGone }))
      )
    );
