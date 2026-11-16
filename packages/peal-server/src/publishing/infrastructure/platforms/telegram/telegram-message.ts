import { Option } from "effect";

import type { PlatformPostId } from "#shared/domain/publish-result.ts";

// How Peal names a post on Telegram: what it is and every message it is
// made of, so an edit picks the right method (a text, or a caption) and a
// deletion removes a whole album.

/** A post on Telegram: a text, or files (an album's every message). */
export type TelegramPost =
  | { readonly _tag: "text"; readonly messageId: number }
  | {
      readonly _tag: "media";
      /** The captioned message first. */
      readonly messageIds: readonly [number, ...number[]];
    };

const textPattern = /^t:(?<id>\d{1,15})$/u;

const mediaPattern = /^m:(?<ids>\d{1,15}(?:,\d{1,15}){0,9})$/u;

/** The post id of a text: `t:<id>`. */
export const textPostId = (messageId: number): string =>
  `t:${String(messageId)}`;

/** The post id of files: `m:<id>[,<id>…]`, the captioned one first. */
export const mediaPostId = (messageIds: readonly number[]): string =>
  `m:${messageIds.join(",")}`;

/** The post a post id names, if it is one of Peal's. */
export const telegramPostOf = (
  id: PlatformPostId | string
): Option.Option<TelegramPost> => {
  const text = textPattern.exec(id)?.groups?.["id"];

  if (text !== undefined) {
    return Option.some({ _tag: "text", messageId: Number(text) });
  }

  const [first, ...rest] = (mediaPattern.exec(id)?.groups?.["ids"] ?? "")
    .split(",")
    .filter((part) => part !== "")
    .map(Number);

  return first === undefined
    ? Option.none()
    : Option.some({ _tag: "media", messageIds: [first, ...rest] });
};

/** The first message of a post: what a reply answers, the captioned one. */
export const firstMessageOf = (post: TelegramPost): number =>
  post._tag === "text" ? post.messageId : post.messageIds[0];

/** Every message of a post. */
export const messagesOf = (post: TelegramPost): readonly number[] =>
  post._tag === "text" ? [post.messageId] : post.messageIds;
