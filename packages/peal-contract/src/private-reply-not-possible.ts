import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why a comment cannot get a private reply: `ownComment`, the channel's
 * own account wrote it; `gone`, the platform no longer shows it; `tooOld`,
 * it was written longer ago than the platform's seven days allow, less
 * Peal's hour.
 */
export const PrivateReplyRefusalSchema = Schema.Literals([
  "ownComment",
  "gone",
  "tooOld",
]).annotate({ identifier: "PrivateReplyRefusal" });

export type PrivateReplyRefusal = typeof PrivateReplyRefusalSchema.Type;

/** The comment cannot get a private reply: see `reason`. Nothing was journalled, nor asked of the platform. */
export class PrivateReplyNotPossible extends Schema.TaggedError<PrivateReplyNotPossible>()(
  "PrivateReplyNotPossible",
  {
    ...errorEnvelope,
    reason: PrivateReplyRefusalSchema,
  },
  {
    description:
      "The comment cannot get a private reply: the channel's own account wrote it (`ownComment`), the platform no longer shows it (`gone`), or it was written longer ago than the platform's seven days allow, less Peal's hour (`tooOld`). Nothing was journalled, nor asked of the platform.",
    httpApiStatus: 409,
  }
) {}
