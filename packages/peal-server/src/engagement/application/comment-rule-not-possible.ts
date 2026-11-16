import { Schema } from "effect";

import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { PlatformSchema } from "#shared/domain/platform.ts";

/**
 * The comment rule cannot answer: its keywords are none, too many or too
 * long (`keywords`), its reply is empty (`emptyReply`), it answers on no
 * channel of the workspace's inbox (`noChannel`), or no channel can carry
 * its reply, or it is too long for one that could (`channels`, each with
 * its reason); its private text is empty (`emptyPrivateReply`), or no
 * channel that answers can carry it, or it is too long for one that could
 * (`privateReply`, each channel with its reason).
 */
export class CommentRuleNotPossible extends Schema.TaggedError<CommentRuleNotPossible>()(
  "CommentRuleNotPossible",
  {
    channels: Schema.Array(
      Schema.Struct({
        channelId: ChannelIdSchema,
        platform: PlatformSchema,
        privateReply: Schema.Literals([
          "available",
          "noApi",
          "unsupported",
          "messagesOff",
          "reconnect",
          "textTooLong",
        ]),
        reply: Schema.Literals([
          "available",
          "noApi",
          "notAllowed",
          "unsupported",
          "reconnect",
          "textTooLong",
        ]),
      })
    ),
    reason: Schema.Literals([
      "keywords",
      "emptyReply",
      "noChannel",
      "channels",
      "emptyPrivateReply",
      "privateReply",
    ]),
  }
) {
  override get message(): string {
    return `The comment rule cannot answer (${this.reason})`;
  }
}
