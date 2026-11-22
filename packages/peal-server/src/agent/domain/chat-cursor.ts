import { DateTime, Option, Schema } from "effect";

import { AgentChatIdSchema } from "./ids.ts";
import type { AgentChatId } from "./ids.ts";

/** Where a page of the history starts: after this chat. */
export interface ChatPosition {
  readonly id: AgentChatId;
  readonly updatedAt: DateTime.Utc;
}

const decodeChatId = Schema.decodeUnknownOption(AgentChatIdSchema);

const cursorPattern = /^(?<millis>\d{1,15})\.(?<id>[0-9a-f-]{36})$/u;

/** The cursor of the page after this chat: its time, then its id. */
export const cursorOf = ({ id, updatedAt }: ChatPosition): string =>
  `${String(DateTime.toEpochMillis(updatedAt))}.${id}`;

/** The chat a cursor names; none for one this server never wrote. */
export const positionOf = (cursor: string): Option.Option<ChatPosition> => {
  const groups = cursorPattern.exec(cursor)?.groups;

  if (groups?.["millis"] === undefined) {
    return Option.none();
  }

  const updatedAt = DateTime.make(Number(groups["millis"]));

  return Option.all({
    id: decodeChatId(groups["id"]),
    updatedAt: updatedAt.pipe(Option.map(DateTime.toUtc)),
  });
};
