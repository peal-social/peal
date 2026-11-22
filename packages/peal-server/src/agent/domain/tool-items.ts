import { Option, Schema } from "effect";

import { storableText } from "#shared/domain/platform-text.ts";

import { ApprovalModerationSchema } from "./agent-parts.ts";
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

/** A file of the workspace's media a part shows, with its alt text. */
const AttachmentItemSchema = Schema.Struct({
  altText: Schema.String,
  mediaId: Schema.String,
});

/** What a part has instead on one channel: its text, and its own media. */
const OverrideItemSchema = Schema.Struct({
  channelId: Schema.String,
  media: Schema.optionalKey(Schema.Array(AttachmentItemSchema)),
  text: Schema.String,
});

/** A part after a post's first: a reply in a thread, or a first comment. */
const PartItemSchema = Schema.Struct({
  delaySeconds: Schema.Int,
  media: Schema.Array(AttachmentItemSchema),
  overrides: Schema.Array(OverrideItemSchema),
  text: Schema.String,
});

/**
 * A post as the workspace holds it, all that goes out of it (the API's
 * `Post`): its text, media, poll, what it has instead on some channels,
 * the parts after its first, its channels with their options, its time
 * and whether its links go out shortened. An approval of a change that
 * names a post shows all of it; a post that reads otherwise is not shown,
 * and the change is not asked.
 */
export const PublishablePostSchema = Schema.Struct({
  content: Schema.Struct({
    followUps: Schema.optionalKey(Schema.Array(PartItemSchema)),
    media: Schema.Array(AttachmentItemSchema),
    overrides: Schema.Array(OverrideItemSchema),
    poll: Schema.optionalKey(
      Schema.NullOr(
        Schema.Struct({
          choices: Schema.Array(Schema.String),
          durationMinutes: Schema.Int,
          multipleChoice: Schema.optionalKey(Schema.Boolean),
        })
      )
    ),
    text: Schema.String,
  }),
  id: Schema.String,
  schedule: Schema.NullOr(Schema.Struct({ at: Schema.DateTimeUtcFromString })),
  shortenLinks: Schema.Boolean,
  status: Schema.String,
  targets: Schema.Array(
    Schema.Struct({
      channelId: Schema.String,
      // A channel taken off the post before it went out: it goes out
      // there no more.
      dropped: Schema.optionalKey(Schema.Boolean),
      id: Schema.String,
      options: Schema.NullOr(Schema.Record(Schema.String, Schema.Json)),
    })
  ),
});

export type PublishablePost = typeof PublishablePostSchema.Type;

/** A tag of the workspace, as list_tags answers it. */
const TagItemSchema = Schema.Struct({
  colour: Schema.String,
  id: Schema.String,
  name: Schema.String,
});

export type TagItem = typeof TagItemSchema.Type;

/** A queue of the workspace, as list_queues answers it. */
const QueueItemSchema = Schema.Struct({
  channelIds: Schema.Array(Schema.String),
  channelSetId: Schema.NullOr(Schema.String),
  id: Schema.String,
  isDefault: Schema.Boolean,
  name: Schema.String,
});

export type QueueItem = typeof QueueItemSchema.Type;

/** A reply sent to a comment or a review, as the inbox tools answer it. */
export const ReplyItemSchema = Schema.Struct({
  text: Schema.String,
  threadId: Schema.String,
});

/** A comment, as the inbox tools answer it once moderated or marked. */
export const CommentItemSchema = ReplyItemSchema;

/**
 * The parameters of a call that waits for the person, every one an
 * approval shows: a call whose parameters read otherwise is not asked.
 */
export const CallParametersSchema = Schema.Struct({
  action: Schema.optionalKey(ApprovalModerationSchema),
  answered: Schema.optionalKey(Schema.Boolean),
  approvalId: Schema.optionalKey(Schema.String),
  at: Schema.optionalKey(Schema.DateTimeUtcFromString),
  channelId: Schema.optionalKey(Schema.String),
  channelIds: Schema.optionalKey(Schema.Array(Schema.String)),
  colour: Schema.optionalKey(Schema.String),
  comment: Schema.optionalKey(Schema.String),
  commentId: Schema.optionalKey(Schema.String),
  idempotencyKey: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
  part: Schema.optionalKey(Schema.Int),
  postId: Schema.optionalKey(Schema.String),
  queue: Schema.optionalKey(Schema.String),
  reviewId: Schema.optionalKey(Schema.String),
  subjectHash: Schema.optionalKey(Schema.String),
  tagIds: Schema.optionalKey(Schema.Array(Schema.String)),
  targetId: Schema.optionalKey(Schema.String),
  text: Schema.optionalKey(Schema.String),
  timeZone: Schema.optionalKey(Schema.String),
});

export type CallParameters = typeof CallParametersSchema.Type;

const decodePost = Schema.decodeUnknownOption(PostItemSchema);

const decodePublishable = Schema.decodeUnknownOption(PublishablePostSchema);

const decodeTags = Schema.decodeUnknownOption(
  Schema.Struct({ tags: Schema.Array(TagItemSchema) })
);

const decodeQueues = Schema.decodeUnknownOption(
  Schema.Struct({ queues: Schema.Array(QueueItemSchema) })
);

const decodeReply = Schema.decodeUnknownOption(ReplyItemSchema);

const decodeParameters = Schema.decodeUnknownOption(CallParametersSchema);

/** The post a tool answered, when it answered one. */
export const postOf = (encoded: Schema.Json): Option.Option<PostItem> =>
  decodePost(encoded);

/** The post get_post answered, all that goes out of it. */
export const publishableOf = (
  encoded: Schema.Json
): Option.Option<PublishablePost> => decodePublishable(encoded);

/** The workspace's tags, as list_tags answered them. */
export const tagsOf = (
  encoded: Schema.Json
): Option.Option<readonly TagItem[]> =>
  decodeTags(encoded).pipe(Option.map(({ tags }) => tags));

/** The workspace's queues, as list_queues answered them. */
export const queuesOf = (
  encoded: Schema.Json
): Option.Option<readonly QueueItem[]> =>
  decodeQueues(encoded).pipe(Option.map(({ queues }) => queues));

/** The reply or comment a tool answered, when it answered one. */
export const replyOf = (
  encoded: Schema.Json
): Option.Option<typeof ReplyItemSchema.Type> => decodeReply(encoded);

/** What a call's parameters say, when an approval can show all of it. */
export const parametersOf = (
  encoded: Schema.Json
): Option.Option<CallParameters> => decodeParameters(encoded);

/** The start of an item's text, as a card shows it. */
export const excerptOf = (text: string): string =>
  storableText(text, maxExcerptLength);
