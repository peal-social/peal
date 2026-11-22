import { Option, Schema } from "effect";

import { storableText } from "#shared/domain/platform-text.ts";

import { maxExcerptLength } from "./run-limits.ts";

// What the agent reads of the items tools answer and of the parameters
// they are called with, from their JSON: only the fields cards and
// approvals show, whatever else they hold. Never the model's words.

/** A post, as the post tools answer it (the API's `Post`). */
export const PostItemSchema = Schema.Struct({
  content: Schema.Struct({ text: Schema.String }),
  id: Schema.String,
  schedule: Schema.NullOr(Schema.Struct({ at: Schema.DateTimeUtcFromString })),
  status: Schema.String,
  targets: Schema.Array(Schema.Struct({ channelId: Schema.String })),
});

export type PostItem = typeof PostItemSchema.Type;

/** A reply sent to a comment or a review, as the inbox tools answer it. */
export const ReplyItemSchema = Schema.Struct({
  text: Schema.String,
  threadId: Schema.String,
});

/** A comment, as the inbox tools answer it once moderated or marked. */
export const CommentItemSchema = ReplyItemSchema;

/** The parameters of a call, as far as an approval shows them. */
export const CallParametersSchema = Schema.Struct({
  at: Schema.optionalKey(Schema.DateTimeUtcFromString),
  channelIds: Schema.optionalKey(Schema.Array(Schema.String)),
  content: Schema.optionalKey(Schema.Struct({ text: Schema.String })),
  postId: Schema.optionalKey(Schema.String),
  text: Schema.optionalKey(Schema.String),
  threadId: Schema.optionalKey(Schema.String),
  when: Schema.optionalKey(
    Schema.Union([
      Schema.Struct({
        _tag: Schema.Literal("at"),
        at: Schema.DateTimeUtcFromString,
      }),
      Schema.Struct({ _tag: Schema.Literals(["now", "queue"]) }),
    ])
  ),
});

export type CallParameters = typeof CallParametersSchema.Type;

const decodePost = Schema.decodeUnknownOption(PostItemSchema);

const decodeReply = Schema.decodeUnknownOption(ReplyItemSchema);

const decodeParameters = Schema.decodeUnknownOption(CallParametersSchema);

/** The post a tool answered, when it answered one. */
export const postOf = (encoded: Schema.Json): Option.Option<PostItem> =>
  decodePost(encoded);

/** The reply or comment a tool answered, when it answered one. */
export const replyOf = (
  encoded: Schema.Json
): Option.Option<typeof ReplyItemSchema.Type> => decodeReply(encoded);

/** What a call's parameters say, as far as an approval shows it. */
export const parametersOf = (encoded: Schema.Json): CallParameters =>
  Option.getOrElse(decodeParameters(encoded), () => ({}));

/** The start of an item's text, as a card shows it. */
export const excerptOf = (text: string): string =>
  storableText(text, maxExcerptLength);
