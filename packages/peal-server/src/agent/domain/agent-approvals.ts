import { DateTime, Option, Result, Schema } from "effect";

import { storableText } from "#shared/domain/platform-text.ts";

import { AgentMessage } from "./agent-message.ts";
import { AgentApprovalSchema } from "./agent-parts.ts";
import type {
  AgentApproval,
  AgentApprovalState,
  ApprovalPost,
  InReplyTo,
} from "./agent-parts.ts";
import { approvalLifetimeHours, maxQuotedLength } from "./run-limits.ts";
import { parametersOf } from "./tool-items.ts";
import type {
  CallParameters,
  PublishablePost,
  QueueItem,
  TagItem,
} from "./tool-items.ts";

/** A call the model made that waits for the person, as the run saw it. */
export interface RequestedCall {
  readonly callId: string;
  /** Its parameters, as JSON. */
  readonly params: Schema.Json;
  readonly tool: string;
}

/** The comment or review a call names, as the workspace holds it. */
export interface CallSubject {
  readonly inReplyTo: InReplyTo;
  readonly threadId: string;
}

/**
 * A comment or review as an approval quotes it: who wrote it (the name
 * they show, else their handle) and the start of its text.
 */
export const quoted = (author: string, text: string): InReplyTo => ({
  author: storableText(author, maxQuotedLength),
  text: storableText(text, maxQuotedLength),
});

/**
 * What a call names, as the workspace holds it, read as the person may
 * read it: the post (`get_post`), the comment or review, the queues and
 * the tags; none for what was not read, or could not be.
 */
export interface ApprovalSources {
  readonly post: Option.Option<PublishablePost>;
  readonly queues: Option.Option<readonly QueueItem[]>;
  readonly subject: Option.Option<CallSubject>;
  readonly tags: Option.Option<readonly TagItem[]>;
}

/** What an approval of this call needs read besides the call itself. */
export interface SourcesNeeded {
  readonly postId: Option.Option<string>;
  readonly queues: boolean;
  readonly tags: boolean;
}

/**
 * Why a change is not asked of the person: what they would approve could
 * not be shown to them whole. The model reads it as the tool's refusal.
 */
export const approvalRefusals = {
  parameters:
    "Peal cannot show the person every parameter of this call, so nothing was asked of them: call the tool again with only the parameters its schema describes.",
  post: "Peal could not read this post to show the person all that goes out of it, so nothing was asked of them: check its id with get_post, or tell them to do it in Peal's web app.",
  queue:
    "Peal found no such queue to show the person, so nothing was asked of them: name one list_queues answers, or leave it out for the workspace's default queue.",
  queueChannels:
    "This draft has no channels, and the queue's come from a channel set: name the channels (channelIds) so the person sees where it goes, or tell them to do it in Peal's web app.",
  tags: "Peal found no such tag to show the person, so nothing was asked of them: use the ids list_tags answers.",
  target:
    "This post has no such channel to show the person, so nothing was asked of them: name one of the targets get_post answers.",
  tool: "Peal cannot show the person this change whole, so nothing was asked of them: tell them to make it in Peal's web app.",
} as const;

// Each tool that waits for the person, and every parameter it takes, as
// its card shows them. A tool missing here, or a parameter, is never
// asked: what the person approves is all the call does.
// test/app/agent-toolbox.test.ts keeps them the MCP tools' own.
const shownParameters: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries({
    approve_post: ["approvalId", "postId", "subjectHash"],
    cancel_post: ["postId"],
    create_tag: ["colour", "name"],
    discard_draft: ["postId"],
    edit_published_post: ["channelId", "part", "postId", "targetId", "text"],
    mark_comment_answered: ["answered", "commentId"],
    moderate_comment: ["action", "commentId"],
    publish_post: ["postId"],
    queue_post: ["channelIds", "postId", "queue"],
    reply_to_comment: ["commentId", "idempotencyKey", "text"],
    reply_to_location_review: ["reviewId", "text"],
    request_changes: ["approvalId", "comment", "postId", "subjectHash"],
    reschedule_post: ["at", "postId", "timeZone"],
    schedule_post: ["at", "channelIds", "postId", "timeZone"],
    tag_post: ["postId", "tagIds"],
    unpublish_post: ["channelId", "postId", "targetId"],
    unschedule_post: ["postId"],
  }).map(([tool, keys]) => [tool, new Set(keys)] as const)
);

/** The parameters each tool that waits for the person shows, by tool. */
export const shownParametersOf = (
  tool: string
): Option.Option<ReadonlySet<string>> =>
  Option.fromUndefinedOr(shownParameters.get(tool));

// The tools whose change happens at the post's own time.
const atPostTime: ReadonlySet<string> = new Set([
  "approve_post",
  "cancel_post",
  "unschedule_post",
]);

const decodeObject = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Json)
);

const decodeNamed = Schema.decodeUnknownOption(
  Schema.Struct({ postId: Schema.String })
);

/** What an approval of this call reads besides it. */
export const sourcesNeeded = ({
  params,
  tool,
}: RequestedCall): SourcesNeeded => ({
  postId: decodeNamed(params).pipe(Option.map(({ postId }) => postId)),
  queues: tool === "queue_post",
  tags: tool === "tag_post",
});

const caseless = (one: string, other: string) =>
  one.toLowerCase() === other.toLowerCase();

// The channels a post goes out on from now: none taken off it.
const liveTargets = (post: PublishablePost) =>
  post.targets.filter(({ dropped }) => dropped !== true);

// The queue a call names, or the workspace's default.
const queueNamed = (
  asked: CallParameters,
  sources: ApprovalSources
): Result.Result<QueueItem, string> => {
  const { queue } = asked;

  const found = sources.queues.pipe(
    Option.flatMap((queues) =>
      Option.fromUndefinedOr(
        queues.find((one) =>
          queue === undefined
            ? one.isDefault
            : one.id === queue || caseless(one.name, queue)
        )
      )
    )
  );

  return Option.match(found, {
    onNone: () => Result.fail(approvalRefusals.queue),
    onSome: Result.succeed,
  });
};

// The channel a call names on a post: by its id, or by its target's.
const channelNamed = (
  asked: CallParameters,
  post: PublishablePost
): Result.Result<string, string> => {
  if (asked.channelId !== undefined) {
    return Result.succeed(asked.channelId);
  }

  const target = post.targets.find(({ id }) => id === asked.targetId);

  return target === undefined
    ? Result.fail(approvalRefusals.target)
    : Result.succeed(target.channelId);
};

// The channels a change to a post goes out on, or acts on.
const postChannels = (
  tool: string,
  asked: CallParameters,
  post: PublishablePost,
  sources: ApprovalSources
): Result.Result<readonly string[], string> => {
  const own = liveTargets(post).map(({ channelId }) => channelId);

  if (tool === "edit_published_post") {
    return channelNamed(asked, post).pipe(Result.map((id) => [id]));
  }

  if (tool === "unpublish_post") {
    return asked.channelId === undefined && asked.targetId === undefined
      ? Result.succeed(own)
      : channelNamed(asked, post).pipe(Result.map((id) => [id]));
  }

  if (tool === "queue_post" && asked.channelIds === undefined) {
    if (own.length > 0) {
      return Result.succeed(own);
    }

    // A draft with no channels goes to the queue's.
    return queueNamed(asked, sources).pipe(
      Result.flatMap((queue) =>
        queue.channelSetId === null
          ? Result.succeed(queue.channelIds)
          : Result.fail(approvalRefusals.queueChannels)
      )
    );
  }

  return Result.succeed(asked.channelIds ?? own);
};

/**
 * All that goes out of the post on these channels: its text, media and
 * poll, the parts after its first, what it has instead on them, each
 * one's options, and whether its links go out shortened.
 */
const shownPost = (
  post: PublishablePost,
  channelIds: readonly string[]
): ApprovalPost => {
  const on = new Set(channelIds);
  const { content } = post;

  const overridesOn = (overrides: PublishablePost["content"]["overrides"]) =>
    overrides
      .filter(({ channelId }) => on.has(channelId))
      .map(({ channelId, media, text }) => ({
        channelId,
        media: media ?? null,
        text,
      }));

  return {
    followUps: (content.followUps ?? []).map((part) => ({
      delaySeconds: part.delaySeconds,
      media: part.media,
      overrides: overridesOn(part.overrides),
      text: part.text,
    })),
    media: content.media,
    overrides: overridesOn(content.overrides),
    poll:
      content.poll === undefined || content.poll === null
        ? null
        : {
            choices: content.poll.choices,
            durationMinutes: content.poll.durationMinutes,
            multipleChoice: content.poll.multipleChoice ?? false,
          },
    shortenLinks: post.shortenLinks,
    targets: channelIds.map((channelId) => ({
      channelId,
      options:
        liveTargets(post).find((target) => target.channelId === channelId)
          ?.options ?? null,
    })),
    text: content.text,
  };
};

// The tags a call makes, or files a post under, by name and colour.
const tagsAsked = (
  tool: string,
  asked: CallParameters,
  sources: ApprovalSources
): Result.Result<AgentApproval["tags"], string> => {
  if (tool === "create_tag") {
    return Result.succeed([
      { colour: asked.colour ?? "", name: asked.name ?? "" },
    ]);
  }

  if (tool !== "tag_post") {
    return Result.succeed([]);
  }

  const known = Option.getOrElse(sources.tags, (): readonly TagItem[] => []);

  const named = (asked.tagIds ?? []).map((id) =>
    known.find((tag) => tag.id === id)
  );

  return named.every((tag) => tag !== undefined)
    ? Result.succeed(named.map(({ colour, name }) => ({ colour, name })))
    : Result.fail(approvalRefusals.tags);
};

// When the change happens: the time it gives, or the post's own for a
// change that keeps it; none for now, or a queue's next slot.
const timeOf = (
  tool: string,
  asked: CallParameters,
  post: Option.Option<PublishablePost>
): DateTime.Utc | null =>
  asked.at ??
  (atPostTime.has(tool)
    ? Option.getOrNull(
        post.pipe(
          Option.flatMap(({ schedule }) => Option.fromNullOr(schedule)),
          Option.map(({ at }) => at)
        )
      )
    : null);

// The parameters a call gives, when its card shows every one of them.
const shownCall = ({
  params,
  tool,
}: RequestedCall): Result.Result<CallParameters, string> => {
  const keys = shownParameters.get(tool);

  if (keys === undefined) {
    return Result.fail(approvalRefusals.tool);
  }

  const given = decodeObject(params);
  const asked = parametersOf(params);

  return Option.isSome(given) &&
    Option.isSome(asked) &&
    Object.keys(given.value).every((key) => keys.has(key))
    ? Result.succeed(asked.value)
    : Result.fail(approvalRefusals.parameters);
};

// The post a call names, as the workspace holds it, when it names one.
const postAsked = (
  asked: CallParameters,
  sources: ApprovalSources
): Result.Result<Option.Option<PublishablePost>, string> => {
  if (asked.postId === undefined) {
    return Result.succeed(Option.none());
  }

  return Option.isSome(sources.post) && sources.post.value.id === asked.postId
    ? Result.succeed(sources.post)
    : Result.fail(approvalRefusals.post);
};

// The text the call itself sends: a reply, or a published post's new text.
const sentText = (tool: string, asked: CallParameters): string | null =>
  tool === "reply_to_comment" ||
  tool === "reply_to_location_review" ||
  tool === "edit_published_post"
    ? (asked.text ?? null)
    : null;

/**
 * The change a call asks for, as the person decides on it: all of what
 * it does, from the call's parameters, and from what it names as the
 * workspace holds it (the post whole, on the channels it goes to, sets
 * expanded; the comment or review it answers; the queue; the tags), never
 * from the model's words. Refused, with what the model is told, when any
 * of it cannot be shown: a tool or a parameter the card does not know, a
 * post, a queue, a tag or a channel that could not be read. Its `digest`
 * is left for whoever hashes what it shows (`shownOf`).
 */
export const approvalOf = (
  call: RequestedCall,
  sources: ApprovalSources
): Result.Result<AgentApproval, string> =>
  Result.gen(function* approval() {
    const { callId, tool } = call;
    const asked = yield* shownCall(call);
    const post = yield* postAsked(asked, sources);

    const channelIds = Option.isSome(post)
      ? yield* postChannels(tool, asked, post.value, sources)
      : [];

    const queue =
      tool === "queue_post" ? (yield* queueNamed(asked, sources)).name : null;

    return {
      answered:
        tool === "mark_comment_answered" ? (asked.answered ?? null) : null,
      at: timeOf(tool, asked, post),
      callId,
      channelIds,
      comment: tool === "request_changes" ? (asked.comment ?? null) : null,
      digest: "",
      inReplyTo: Option.getOrNull(
        sources.subject.pipe(Option.map(({ inReplyTo }) => inReplyTo))
      ),
      moderation: tool === "moderate_comment" ? (asked.action ?? null) : null,
      part: tool === "edit_published_post" ? (asked.part ?? 0) : null,
      post: Option.getOrNull(
        post.pipe(Option.map((found) => shownPost(found, channelIds)))
      ),
      postId: asked.postId ?? null,
      queue,
      state: "pending",
      tags: yield* tagsAsked(tool, asked, sources),
      text: sentText(tool, asked),
      threadId: Option.getOrNull(
        sources.subject.pipe(Option.map(({ threadId }) => threadId))
      ),
      tool,
    } satisfies AgentApproval;
  });

const encodeApproval = Schema.encodeSync(
  Schema.toCodecJson(AgentApprovalSchema)
);

const asJson = Schema.decodeUnknownSync(Schema.Json);

// JSON with its keys in order, so the same content reads the same.
const canonical = (value: Schema.Json): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }

  const object = decodeObject(value);

  if (Option.isNone(object)) {
    return JSON.stringify(value);
  }

  return `{${Object.keys(object.value)
    .toSorted()
    .map(
      (key) => `${JSON.stringify(key)}:${canonical(object.value[key] ?? null)}`
    )
    .join(",")}}`;
};

/**
 * What the person is shown of a change, as one text to hash: all of the
 * approval but its call, its state and its digest. The same change, read
 * again, reads the same; any change of what it shows reads otherwise.
 */
export const shownOf = (approval: AgentApproval): string => {
  const encoded = Option.getOrElse(
    decodeObject(asJson(encodeApproval(approval))),
    (): Record<string, Schema.Json> => ({})
  );

  return canonical({ ...encoded, callId: "", digest: "", state: "pending" });
};

/** The approvals of an answer that still wait for the person, as kept. */
export const pendingOf = (message: AgentMessage): readonly AgentApproval[] =>
  message.approvals.filter(({ state }) => state === "pending");

/**
 * Whether an answer's changes waited past `approvalLifetimeHours`, from
 * when it was written: they read as expired, and none can be approved.
 */
export const lapsed = (message: AgentMessage, now: DateTime.Utc): boolean =>
  DateTime.isGreaterThan(
    now,
    DateTime.add(message.createdAt, { hours: approvalLifetimeHours })
  );

/** The approvals of an answer the person may still answer at `now`. */
export const openOf = (
  message: AgentMessage,
  now: DateTime.Utc
): readonly AgentApproval[] => (lapsed(message, now) ? [] : pendingOf(message));

/** The answer as the person reads it at `now`: a lapsed change expired. */
export const shownAt = (
  message: AgentMessage,
  now: DateTime.Utc
): AgentMessage =>
  lapsed(message, now) && pendingOf(message).length > 0
    ? new AgentMessage({
        approvals: message.approvals.map((approval) =>
          approval.state === "pending"
            ? { ...approval, state: "expired" }
            : approval
        ),
        cards: message.cards,
        createdAt: message.createdAt,
        durationMs: message.durationMs,
        id: message.id,
        media: message.media,
        outcome: message.outcome,
        rating: message.rating,
        role: message.role,
        skills: message.skills,
        steps: message.steps,
        text: message.text,
      })
    : message;

/** The answer's approvals, with one of them in a new state. */
export const answered = (
  approvals: readonly AgentApproval[],
  callId: string,
  state: AgentApprovalState
): readonly AgentApproval[] =>
  approvals.map((approval) =>
    approval.callId === callId ? { ...approval, state } : approval
  );
