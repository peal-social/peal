import { DateTime, Effect, Exit, Stream } from "effect";
import { Atom, Reactivity } from "effect/reactivity";
import type { AgentEvent, AgentMedia } from "peal-contract/agent";

import { changedKeysOf } from "#agent/changed-keys.ts";
import { PealAgentApi } from "#agent/client.ts";
import { refusalOf } from "#agent/refusal.ts";
import { emptyChat, foldChat } from "#agent/run-state.ts";
import type { ChatAction, ChatState } from "#agent/run-state.ts";

/** What refreshes the person's chats once one changed. */
export const agentChatsChanged = (workspaceId: string) => [
  `agent-chats:${workspaceId}`,
];

/** Whether the agent answers this person in the workspace, and who. */
export const agentStatus = Atom.family((workspaceId: string) =>
  PealAgentApi.query("agent", "status", { params: { workspaceId } })
);

/** The person's latest chats in the workspace: the history's first page. */
export const agentChats = Atom.family((workspaceId: string) =>
  PealAgentApi.query("agent", "chats", {
    params: { workspaceId },
    query: {},
    reactivityKeys: agentChatsChanged(workspaceId),
  })
);

/** A chat with its messages, as the server saved them. */
export const agentChatDetail = (workspaceId: string, chatId: string) =>
  PealAgentApi.query("agent", "chat", { params: { chatId, workspaceId } });

export const createAgentChat = PealAgentApi.mutation("agent", "createChat");

export const updateAgentChat = PealAgentApi.mutation("agent", "updateChat");

export const deleteAgentChat = PealAgentApi.mutation("agent", "deleteChat");

export const rateAgentAnswer = PealAgentApi.mutation("agent", "rate");

/** The key of a chat not yet sent, one a workspace. */
export const newChatKey = (workspaceId: string): string => `new:${workspaceId}`;

/**
 * One chat as the page and the panel show it, by its id (or `newChatKey`):
 * kept while the tab lives, so a run started in one place goes on in the
 * other, and a draft waits where it was left.
 */
export const agentChat = Atom.family((_key: string) =>
  Atom.make<ChatState>(emptyChat).pipe(Atom.keepAlive)
);

const now = () => DateTime.nowUnsafe();

/** What a run asks: a message, or the answer to a change that waits. */
export interface RunRequest {
  readonly chatId: string;
  readonly ask:
    | {
        readonly _tag: "send";
        readonly media: readonly AgentMedia[];
        readonly text: string;
      }
    | {
        readonly _tag: "answer";
        readonly approved: boolean;
        readonly callId: string;
      };
  readonly workspaceId: string;
}

// The person's clock, so "tomorrow at 9" is read on it; the server falls
// back on UTC for a zone it does not know.
const timeZoneOf = (): { readonly timeZone?: string } => {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

  return timeZone === "" ? {} : { timeZone };
};

/**
 * A chat's run: written a request, it sends it and folds each event the
 * server streams into the chat (`agentChat`); written `Atom.Interrupt`
 * (Stop), it closes the stream, which stops the run on the server, and
 * the chat keeps what was written. Kept while the tab lives, so leaving
 * the page or closing the panel never stops it.
 */
export const agentRun = Atom.family((chatId: string) =>
  PealAgentApi.runtime
    .fn<RunRequest>()(
      Effect.fnUntraced(function* run(request, get) {
        const chat = agentChat(chatId);

        const dispatch = (action: ChatAction) => {
          get.registry.set(chat, foldChat(get.registry.get(chat), action));
        };

        const client = yield* PealAgentApi;
        const { ask, workspaceId } = request;
        const params = { chatId, workspaceId };

        if (ask._tag === "send") {
          dispatch({
            _tag: "sent",
            at: now(),
            media: ask.media,
            text: ask.text,
          });
        } else {
          dispatch({
            _tag: "answered",
            approved: ask.approved,
            at: now(),
            callId: ask.callId,
          });
        }

        // Either request opens the same stream of events.
        const opened: Exit.Exit<
          Stream.Stream<AgentEvent, unknown>,
          unknown
        > = ask._tag === "send"
          ? yield* Effect.exit(
              client.agent.send({
                params,
                payload: {
                  mediaIds: ask.media.map(({ id }) => id),
                  text: ask.text,
                  ...timeZoneOf(),
                },
              })
            )
          : yield* Effect.exit(
              client.agent.answer({
                params: { ...params, callId: ask.callId },
                payload: { approved: ask.approved, ...timeZoneOf() },
              })
            );

        if (Exit.isFailure(opened)) {
          dispatch({
            _tag: "refused",
            refusal: refusalOf(opened),
            text: ask._tag === "send" ? ask.text : null,
          });

          return;
        }

        // What the run changed elsewhere in the app, read again once it ends.
        const changed = new Set<string>();

        yield* opened.value.pipe(
          Stream.runForEach((event) =>
            Effect.sync(() => {
              dispatch({ _tag: "event", at: now(), event });

              if (event._tag === "card") {
                for (const key of changedKeysOf(workspaceId, event.card)) {
                  changed.add(key);
                }
              }
            })
          ),
          // A stream that ends before the run did lost its end; once the
          // run ended, this changes nothing.
          Effect.andThen(
            Effect.sync(() => {
              dispatch({ _tag: "interrupted", at: now(), reason: "lost" });
            })
          ),
          // The answer stopped coming without the server ending it.
          Effect.catch(() =>
            Effect.sync(() => {
              dispatch({ _tag: "interrupted", at: now(), reason: "lost" });
            })
          ),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              dispatch({ _tag: "interrupted", at: now(), reason: "stopped" });
            })
          ),
          Effect.ensuring(
            Effect.sync(() => {
              // The run moved the chat to the top of the history, and may
              // have named it.
              get.registry.refresh(agentChats(workspaceId));
              // The server's copy is the chat as it is: what another tab
              // added to it too.
              dispatch({ _tag: "stale" });
              get.registry.refresh(agentChatDetail(workspaceId, chatId));
            }).pipe(
              Effect.andThen(
                Effect.suspend(() =>
                  changed.size === 0
                    ? Effect.void
                    : Reactivity.invalidate([...changed])
                )
              )
            )
          )
        );
      })
    )
    .pipe(Atom.keepAlive)
);
