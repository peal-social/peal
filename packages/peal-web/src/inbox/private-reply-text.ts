import { maxInboxMessageLength, privateReplyLimits } from "peal-contract";
import type { Platform } from "peal-contract";
import { measureText } from "peal-contract/post-text";

import type { ReplyFit } from "./reply-text.ts";

// What the private reply's box tells while a member writes: the text,
// counted as its platform counts a message. The server checks again.

/**
 * How `text` fits a private reply on `platform`: Instagram's bytes or
 * Messenger's characters, and the longest message the API takes,
 * whichever is closer.
 */
export const privateReplyFit = (platform: Platform, text: string): ReplyFit => {
  const written = text.trim();

  const limits = [
    { maximum: maxInboxMessageLength, unit: "utf16Units" as const },
    ...(platform === "facebook" || platform === "instagram"
      ? [privateReplyLimits[platform]]
      : []),
  ];

  const [tightest] = limits
    .map(({ maximum, unit }) => {
      const length = measureText(text, unit);

      return { length, maximum, remaining: maximum - length, unit };
    })
    .toSorted((left, right) => left.remaining - right.remaining);

  return {
    empty: written === "",
    length: tightest?.length ?? 0,
    maximum: tightest?.maximum ?? maxInboxMessageLength,
    mention: null,
    outgoing: written,
    remaining: tightest?.remaining ?? maxInboxMessageLength,
    unit: tightest?.unit ?? "utf16Units",
  };
};
