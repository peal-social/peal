import { Option } from "effect";
import type { Schema } from "effect";

import { storableText } from "#shared/domain/platform-text.ts";

import type { AgentMessage } from "./agent-message.ts";
import type {
  AgentApproval,
  AgentApprovalState,
  InReplyTo,
} from "./agent-parts.ts";
import { maxQuotedLength } from "./run-limits.ts";
import { parametersOf } from "./tool-items.ts";
import type { PostItem } from "./tool-items.ts";

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
 * The change a call asks for, as the person decides on it: from the
 * call's own parameters (the text it sends, its channels, its time, the
 * post and the thread it names), for a call that names a post and not
 * all of it from that post as the workspace holds it, and for one that
 * names a comment or a review from it (its thread, its author and text).
 * Never from the model's words.
 */
export const approvalOf = (
  { callId, params, tool }: RequestedCall,
  post: Option.Option<PostItem>,
  subject: Option.Option<CallSubject> = Option.none()
): AgentApproval => {
  const asked = parametersOf(params);

  const at =
    asked.at ??
    (asked.when?._tag === "at" ? asked.when.at : undefined) ??
    // A post moved, unscheduled or cancelled keeps the time it had, as
    // the workspace holds it; one published now has none.
    (tool === "publish_post"
      ? undefined
      : Option.getOrUndefined(
          post.pipe(
            Option.flatMap(({ schedule }) => Option.fromNullOr(schedule)),
            Option.map((schedule) => schedule.at)
          )
        ));

  return {
    at: at ?? null,
    callId,
    channelIds:
      asked.channelIds ??
      Option.match(post, {
        onNone: () => [],
        onSome: ({ targets }) => targets.map(({ channelId }) => channelId),
      }),
    inReplyTo: Option.getOrNull(
      subject.pipe(Option.map(({ inReplyTo }) => inReplyTo))
    ),
    postId: asked.postId ?? null,
    state: "pending",
    text:
      asked.text ??
      asked.content?.text ??
      Option.getOrNull(post.pipe(Option.map(({ content }) => content.text))),
    threadId:
      asked.threadId ??
      Option.getOrNull(subject.pipe(Option.map(({ threadId }) => threadId))),
    tool,
  };
};

/** The approvals of an answer that still wait for the person. */
export const pendingOf = (message: AgentMessage): readonly AgentApproval[] =>
  message.approvals.filter(({ state }) => state === "pending");

/** The answer's approvals, with one of them in a new state. */
export const answered = (
  approvals: readonly AgentApproval[],
  callId: string,
  state: AgentApprovalState
): readonly AgentApproval[] =>
  approvals.map((approval) =>
    approval.callId === callId ? { ...approval, state } : approval
  );
