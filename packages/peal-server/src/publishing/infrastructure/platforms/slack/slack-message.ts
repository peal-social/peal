import { Option } from "effect";

import type { PlatformPostId } from "#shared/domain/publish-result.ts";

// How Peal names a message on Slack: its channel and its `ts` ("the
// timestamp ID", unique within a channel), and for one with images the
// files it shows, in order, so an edit can send its image blocks again
// (`chat.update` removes a message's blocks when it is sent a text alone)
// and a deletion can delete the files too.

/** A message the app posted, by its channel and `ts`, and its files. */
export interface SlackMessage {
  readonly channel: string;
  readonly files: readonly string[];
  readonly ts: string;
}

const pattern =
  /^(?<channel>[CDG][A-Z0-9]{2,30})\/(?<ts>\d{1,12}\.\d{1,9})(?:\/(?<files>F[A-Z0-9]{2,30}(?:,F[A-Z0-9]{2,30}){0,9}))?$/u;

/** The post id of a message: `<channel>/<ts>[/<file>,<file>…]`. */
export const slackPostId = (message: SlackMessage): string =>
  message.files.length === 0
    ? `${message.channel}/${message.ts}`
    : `${message.channel}/${message.ts}/${message.files.join(",")}`;

/** The message a post id names, if it is one of Peal's. */
export const slackMessageOf = (
  id: PlatformPostId | string
): Option.Option<SlackMessage> => {
  const groups = pattern.exec(id)?.groups;
  const channel = groups?.["channel"];
  const ts = groups?.["ts"];

  return channel === undefined || ts === undefined
    ? Option.none()
    : Option.some({
        channel,
        files: groups?.["files"]?.split(",") ?? [],
        ts,
      });
};

/**
 * The channel an account id names: `<team>/<channel>`, the channel the
 * member picked on Slack's page when the app was installed.
 */
export const slackChannelOf = (accountId: string): Option.Option<string> =>
  Option.fromNullishOr(
    /^T[A-Z0-9]{2,30}\/(?<channel>[CDG][A-Z0-9]{2,30})$/u.exec(accountId)
      ?.groups?.["channel"]
  );
