import { Option } from "effect";
import type { Schema } from "effect";

import type { AgentMessage } from "./agent-message.ts";
import type { AgentApproval, AgentApprovalState } from "./agent-parts.ts";
import { parametersOf } from "./tool-items.ts";
import type { PostItem } from "./tool-items.ts";

/** A call the model made that waits for the person, as the run saw it. */
export interface RequestedCall {
  readonly callId: string;
  /** Its parameters, as JSON. */
  readonly params: Schema.Json;
  readonly tool: string;
}

/**
 * The change a call asks for, as the person decides on it: from the
 * call's own parameters (the text it sends, its channels, its time, the
 * post and the thread it names) and, for a call that names a post and
 * not all of it, from that post as the workspace holds it. Never from
 * the model's words.
 */
export const approvalOf = (
  { callId, params, tool }: RequestedCall,
  post: Option.Option<PostItem>
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
    postId: asked.postId ?? null,
    state: "pending",
    text:
      asked.text ??
      asked.content?.text ??
      Option.getOrNull(post.pipe(Option.map(({ content }) => content.text))),
    threadId: asked.threadId ?? null,
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
