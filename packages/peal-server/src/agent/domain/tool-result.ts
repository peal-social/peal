import type { Schema } from "effect";

import { maxToolResultLength } from "./run-limits.ts";

/** What the model reads after a tool's answer that was longer than it reads. */
export const cutNote =
  "[Peal cut this answer here: the tool answered more than the agent reads. Ask for less, with a filter or a smaller page, if what is missing matters.]";

/**
 * A tool's answer as the model reads it, and as the chat keeps it: its
 * JSON, cut to `maxToolResultLength` with a note that says so, so a chat
 * stays small whatever a tool answers.
 */
export const forModel = (
  encoded: Schema.Json,
  maximum: number = maxToolResultLength
): string => {
  const json = JSON.stringify(encoded);

  if (json.length <= maximum) {
    return json;
  }

  // Never half a surrogate pair at the cut: the high half of one is a
  // code point above U+FFFF where it starts.
  const end =
    (json.codePointAt(maximum - 1) ?? 0) > 0xff_ff ? maximum - 1 : maximum;

  return `${json.slice(0, end)}\n${cutNote}`;
};
