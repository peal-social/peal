import { DateTime } from "effect";
import type {
  AgentApproval,
  AgentChatDetail,
  AgentEvent,
  AgentFailure,
  AgentMedia,
  AgentMessage,
  AgentRating,
  AgentStep,
} from "peal-contract/agent";

import type { RunRefusal } from "#agent/refusal.ts";

// One chat as the page and the panel show it: what the server holds, the
// run under way folded in event by event, and the person's draft, so both
// places show the same chat and a run started in one goes on in the other.

/** A run under way: its answer's id once the server named it. */
export interface Run {
  readonly messageId: string | null;
  readonly startedAt: DateTime.Utc;
}

/** Why the last run did not answer, as the chat says under it. */
export type RunProblem =
  | { readonly _tag: "failed"; readonly reason: AgentFailure }
  // The answer stopped coming without the server saying why: the network.
  | { readonly _tag: "lost" }
  | { readonly _tag: "refused"; readonly refusal: RunRefusal };

export interface ChatState {
  readonly draft: string;
  /** Whether the server's messages were read in. */
  readonly loaded: boolean;
  readonly messages: readonly AgentMessage[];
  readonly problem: RunProblem | null;
  readonly run: Run | null;
  readonly starred: boolean;
  readonly title: string | null;
}

export const emptyChat: ChatState = {
  draft: "",
  loaded: false,
  messages: [],
  problem: null,
  run: null,
  starred: false,
  title: null,
};

/** What happens to a chat: the server's answers, and the person's acts. */
export type ChatAction =
  | { readonly _tag: "loaded"; readonly detail: AgentChatDetail }
  // The chat moved on elsewhere: it is read again.
  | { readonly _tag: "stale" }
  | { readonly _tag: "typed"; readonly text: string }
  | {
      readonly _tag: "sent";
      readonly at: DateTime.Utc;
      /** The files the message attaches, shown with it at once. */
      readonly media: readonly AgentMedia[];
      readonly text: string;
    }
  | {
      readonly _tag: "answered";
      readonly approved: boolean;
      readonly at: DateTime.Utc;
      readonly callId: string;
    }
  | {
      readonly _tag: "event";
      readonly at: DateTime.Utc;
      readonly event: AgentEvent;
    }
  | {
      readonly _tag: "refused";
      readonly refusal: RunRefusal;
      /** The message's text, back in the composer; null for an answer. */
      readonly text: string | null;
    }
  | {
      readonly _tag: "interrupted";
      readonly at: DateTime.Utc;
      /** `stopped` by the person, or `lost` on the way. */
      readonly reason: "lost" | "stopped";
    }
  | {
      readonly _tag: "rated";
      readonly messageId: string;
      readonly rating: AgentRating | null;
    }
  | { readonly _tag: "renamed"; readonly title: string }
  | { readonly _tag: "starred"; readonly starred: boolean };

/** The id the person's message has until the server names it. */
export const localUserMessageId = "local:user";

/** The id of an answer stopped before the server named it. */
export const localAnswerId = "local:answer";

const elapsed = (from: DateTime.Utc, to: DateTime.Utc): number =>
  Math.max(0, DateTime.toEpochMillis(to) - DateTime.toEpochMillis(from));

const withMessage = (
  state: ChatState,
  id: string | null,
  change: (message: AgentMessage) => AgentMessage
): ChatState =>
  id === null
    ? state
    : {
        ...state,
        messages: state.messages.map((message) =>
          message.id === id ? change(message) : message
        ),
      };

// A step stays where it was called in the answer, however it ends.
const upsertStep = (
  steps: readonly AgentStep[],
  step: AgentStep
): readonly AgentStep[] =>
  steps.some(({ callId }) => callId === step.callId)
    ? steps.map((each) =>
        each.callId === step.callId ? { ...step, at: each.at } : each
      )
    : [...steps, step];

const upsertApproval = (
  approvals: readonly AgentApproval[],
  approval: AgentApproval
): readonly AgentApproval[] =>
  approvals.some(({ callId }) => callId === approval.callId)
    ? approvals.map((each) =>
        each.callId === approval.callId ? approval : each
      )
    : [...approvals, approval];

// A message sent while a change waits replaces the request: the server
// marks it expired, and so does the chat at once.
const expirePending = (message: AgentMessage): AgentMessage =>
  message.approvals.some(({ state }) => state === "pending")
    ? {
        ...message,
        approvals: message.approvals.map((approval) =>
          approval.state === "pending"
            ? { ...approval, state: "expired" }
            : approval
        ),
      }
    : message;

// Steps still running when a run ends never finished.
const settleSteps = (message: AgentMessage): AgentMessage => ({
  ...message,
  steps: message.steps.map((step) =>
    step.state === "running" ? { ...step, state: "failed" } : step
  ),
});

const answerOf = (id: string, at: DateTime.Utc): AgentMessage => ({
  approvals: [],
  cards: [],
  createdAt: at,
  durationMs: null,
  id,
  media: [],
  outcome: null,
  rating: null,
  role: "assistant",
  steps: [],
  text: "",
});

const started = (
  state: ChatState,
  run: Run,
  event: Extract<AgentEvent, { readonly _tag: "started" }>,
  at: DateTime.Utc
): ChatState => {
  const { messageId, userMessageId } = event;

  const named = state.messages.map((message) =>
    userMessageId !== null && message.id === localUserMessageId
      ? { ...message, id: userMessageId }
      : message
  );

  // A run that goes on after an approval may write on in the same answer.
  const messages = named.some(({ id }) => id === messageId)
    ? named.map((message) =>
        message.id === messageId ? { ...message, outcome: null } : message
      )
    : [...named, answerOf(messageId, at)];

  return { ...state, messages, run: { ...run, messageId } };
};

const ended = (
  state: ChatState,
  run: Run,
  at: DateTime.Utc,
  outcome: AgentMessage["outcome"],
  durationMs: number | null
): ChatState => ({
  ...withMessage(state, run.messageId, (message) => ({
    ...settleSteps(message),
    durationMs: durationMs ?? elapsed(run.startedAt, at),
    outcome,
  })),
  run: null,
});

const onEvent = (
  state: ChatState,
  event: AgentEvent,
  at: DateTime.Utc
): ChatState => {
  // A title can come whenever; anything else belongs to a run.
  if (event._tag === "title") {
    return { ...state, title: event.title };
  }

  const { run } = state;

  if (run === null) {
    return state;
  }

  switch (event._tag) {
    case "started": {
      return started(state, run, event, at);
    }

    case "text": {
      return withMessage(state, run.messageId, (message) => ({
        ...message,
        text: message.text + event.delta,
      }));
    }

    case "step": {
      return withMessage(state, run.messageId, (message) => ({
        ...message,
        steps: upsertStep(message.steps, event.step),
      }));
    }

    case "card": {
      return withMessage(state, run.messageId, (message) => ({
        ...message,
        cards: [...message.cards, event.card],
      }));
    }

    case "approval": {
      const { callId } = event.approval;

      // An answer to a change the chat shows updates its card, on whichever
      // message holds it; a new request joins the answer being written.
      const held = state.messages.find(({ approvals }) =>
        approvals.some((approval) => approval.callId === callId)
      );

      return withMessage(state, held?.id ?? run.messageId, (message) => ({
        ...message,
        approvals: upsertApproval(message.approvals, event.approval),
      }));
    }

    case "finished": {
      return ended(state, run, at, event.outcome, event.durationMs);
    }

    case "failed": {
      return {
        ...ended(state, run, at, "failed", null),
        problem: { _tag: "failed", reason: event.reason },
      };
    }

    default: {
      return state;
    }
  }
};

/**
 * The chat once something happened to it. Pure: the page and the panel
 * fold the same actions into the same atom.
 */
export const foldChat = (state: ChatState, action: ChatAction): ChatState => {
  switch (action._tag) {
    case "loaded": {
      // A run under way holds more than the server has saved yet.
      if (state.run !== null) {
        return state;
      }

      const { chat, messages } = action.detail;

      return {
        ...state,
        loaded: true,
        messages,
        starred: chat.starred,
        title: chat.title,
      };
    }

    case "stale": {
      return state.run === null ? { ...state, loaded: false } : state;
    }

    case "typed": {
      return { ...state, draft: action.text };
    }

    case "sent": {
      const mine: AgentMessage = {
        ...answerOf(localUserMessageId, action.at),
        role: "user",
        media: action.media,
        text: action.text,
      };

      return {
        ...state,
        draft: "",
        messages: [...state.messages.map(expirePending), mine],
        problem: null,
        run: { messageId: null, startedAt: action.at },
      };
    }

    case "answered": {
      const decided = action.approved ? "approved" : "declined";

      return {
        ...state,
        messages: state.messages.map((message) => ({
          ...message,
          approvals: message.approvals.map((approval) =>
            approval.callId === action.callId && approval.state === "pending"
              ? { ...approval, state: decided }
              : approval
          ),
        })),
        problem: null,
        run: { messageId: null, startedAt: action.at },
      };
    }

    case "event": {
      return onEvent(state, action.event, action.at);
    }

    case "refused": {
      // Nothing was saved: the message goes back to the composer.
      return {
        ...state,
        draft: action.text ?? state.draft,
        messages: state.messages.filter(({ id }) => id !== localUserMessageId),
        problem: { _tag: "refused", refusal: action.refusal },
        run: null,
      };
    }

    case "interrupted": {
      if (state.run === null) {
        return state;
      }

      // Stopped before the server named the answer: one is shown anyway,
      // so the person sees where it stopped.
      const run =
        state.run.messageId === null
          ? { ...state.run, messageId: localAnswerId }
          : state.run;

      const opened =
        state.run.messageId === null
          ? {
              ...state,
              messages: [
                ...state.messages,
                answerOf(localAnswerId, state.run.startedAt),
              ],
              run,
            }
          : state;

      const stopped = ended(opened, run, action.at, "stopped", null);

      return action.reason === "lost"
        ? { ...stopped, problem: { _tag: "lost" } }
        : stopped;
    }

    case "rated": {
      return withMessage(state, action.messageId, (message) => ({
        ...message,
        rating: action.rating,
      }));
    }

    case "renamed": {
      return { ...state, title: action.title };
    }

    case "starred": {
      return { ...state, starred: action.starred };
    }

    default: {
      return state;
    }
  }
};

/** Whether the chat waits for the person to answer a change. */
export const pendingApprovalOf = (
  state: ChatState
): AgentApproval | undefined =>
  state.messages
    .flatMap(({ approvals }) => approvals)
    .find(({ state: standing }) => standing === "pending");

/** The answer being written now, if a run has named it. */
export const runningMessageId = (state: ChatState): string | null =>
  state.run?.messageId ?? null;
