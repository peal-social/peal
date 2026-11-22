import { Effect, Option } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import {
  AssistantInputRejected,
  AssistantQuotaExceeded,
  AssistantUnavailable,
  CurrentMember,
  OwnTextLimitReached,
  TextProviderBusy,
} from "peal-contract";
import {
  AgentApi,
  AgentApprovalNotPending,
  AgentBusy,
  AgentChatNotFound,
  AgentMediaRejected,
} from "peal-contract/agent";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import type { RunAsked } from "#agent/application/agent-desk.ts";
import type { DayExhausted } from "#agent/application/day-exhausted.ts";
import type { ExportedChat } from "#agent/application/ports/agent-chats.ts";
import type { AgentChat } from "#agent/domain/agent-chat.ts";
import type { AgentMessage } from "#agent/domain/agent-message.ts";
import { cursorOf } from "#agent/domain/chat-cursor.ts";
import { maxMessageLength } from "#agent/domain/run-limits.ts";
import { actorOf } from "#shared/api/actor.ts";
import { allowanceRefusal } from "#shared/api/allowance-reached.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { UpgradePaths } from "#shared/application/upgrade-paths.ts";
import type { Actor } from "#shared/domain/access.ts";

/** A chat, as the contract answers it. */
export const chatView = (chat: AgentChat) => ({
  createdAt: chat.createdAt,
  id: chat.id,
  starred: chat.starred,
  title: Option.getOrNull(chat.title),
  updatedAt: chat.updatedAt,
});

/** A message, as the contract answers it. */
export const messageView = (message: AgentMessage) => ({
  approvals: message.approvals,
  cards: message.cards,
  createdAt: message.createdAt,
  durationMs: Option.getOrNull(message.durationMs),
  id: message.id,
  outcome: Option.getOrNull(message.outcome),
  media: message.media,
  rating: Option.getOrNull(message.rating),
  role: message.role,
  steps: message.steps,
  text: message.text,
});

const detailView = ({ chat, messages }: ExportedChat) => ({
  chat: chatView(chat),
  messages: messages.map(messageView),
});

const chatNotFound = () => Effect.fail(new AgentChatNotFound());

// Where the request came from, for the connections that change content.
const askedOf = (timeZone: string | undefined) =>
  Effect.service(HttpServerRequest.HttpServerRequest).pipe(
    Effect.map((request): RunAsked => ({
      origin: {
        headers: request.headers,
        remoteAddress: request.remoteAddress,
      },
      timeZone,
    }))
  );

/**
 * The agent's endpoints (`peal-contract/agent`), for a person in their own
 * session. Refusals say what went wrong by kind only: nothing of a
 * message, a tool's answer or a provider's error reaches an answer or a
 * log. A run's events stream once it may start; what refuses it before
 * comes as the request's error.
 */
export const AgentHandlers = HttpApiBuilder.group(
  AgentApi,
  "agent",
  Effect.fn(function* agentHandlers(handlers) {
    const desk = yield* AgentDesk;
    const paths = yield* UpgradePaths;
    const allowanceReached = yield* allowanceRefusal;

    // The day's refusal: the server's model's quota, with the plan that
    // allows more, or the workspace's own provider's day.
    const dayExhausted = (
      actor: Actor,
      { dailyLimit, resetsAt, source }: DayExhausted
    ) =>
      source === "workspace"
        ? Effect.fail(new OwnTextLimitReached({ dailyLimit, resetsAt }))
        : paths
            .from(actor.workspaceId, "assistantRequests", dailyLimit + 1)
            .pipe(
              Effect.flatMap((path) =>
                Effect.fail(
                  new AssistantQuotaExceeded({
                    billingUrl: Option.isSome(path.plan)
                      ? path.billingUrl
                      : null,
                    dailyLimit,
                    plan: Option.getOrNull(path.plan),
                    planWithRoom: Option.getOrNull(path.planWithRoom),
                    resetsAt,
                  })
                )
              )
            );

    const runRefusals = (actor: Actor) =>
      ({
        AgentModelOff: () => Effect.fail(new AssistantUnavailable()),
        AllowanceReached: allowanceReached,
        ChatBusy: () => Effect.fail(new AgentBusy()),
        ChatNotFound: chatNotFound,
        DayExhausted: (exhausted: DayExhausted) =>
          dayExhausted(actor, exhausted),
        MissingPermission: forbidden,
        OwnProviderBusy: () => Effect.fail(new TextProviderBusy()),
        PersonRequired: forbidden,
      }) as const;

    return handlers
      .handle("status", () =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) => desk.availability(actorOf(member))),
          Effect.catchTags({
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("chats", ({ query }) =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) =>
            desk.chats(actorOf(member), Option.fromUndefinedOr(query.cursor))
          ),
          Effect.map((page) => ({
            chats: page.chats.map(chatView),
            nextCursor: Option.getOrNull(page.next.pipe(Option.map(cursorOf))),
          })),
          Effect.catchTags({
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("createChat", () =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) => desk.createChat(actorOf(member))),
          Effect.map(chatView),
          Effect.catchTags({
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("chat", ({ params }) =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) => desk.chat(actorOf(member), params.chatId)),
          Effect.map(detailView),
          Effect.catchTags({
            ChatNotFound: chatNotFound,
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("updateChat", ({ params, payload }) =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) =>
            desk.updateChat(actorOf(member), params.chatId, payload)
          ),
          Effect.map(chatView),
          Effect.catchTags({
            ChatNotFound: chatNotFound,
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("deleteChat", ({ params }) =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) =>
            desk.deleteChat(actorOf(member), params.chatId)
          ),
          Effect.catchTags({
            ChatNotFound: chatNotFound,
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("rate", ({ params, payload }) =>
        Effect.service(CurrentMember).pipe(
          Effect.flatMap((member) =>
            desk.rate(
              actorOf(member),
              params.chatId,
              params.messageId,
              Option.fromNullOr(payload.rating)
            )
          ),
          Effect.catchTags({
            ChatNotFound: chatNotFound,
            MissingPermission: forbidden,
            PersonRequired: forbidden,
          })
        )
      )
      .handle("send", ({ params, payload }) =>
        Effect.gen(function* send() {
          const actor = actorOf(yield* CurrentMember);

          return yield* desk
            .send(
              actor,
              params.chatId,
              payload.text,
              payload.mediaIds ?? [],
              yield* askedOf(payload.timeZone)
            )
            .pipe(
              Effect.catchTags({
                ...runRefusals(actor),
                ApprovalNotPending: () =>
                  Effect.die("A message never answers an approval"),
                MediaRejected: ({ mediaId, reason }) =>
                  Effect.fail(new AgentMediaRejected({ mediaId, reason })),
                MessageRejected: () =>
                  Effect.fail(
                    new AssistantInputRejected({
                      maxLength: maxMessageLength,
                      reason: "empty",
                    })
                  ),
              })
            );
        })
      )
      .handle("answer", ({ params, payload }) =>
        Effect.gen(function* answer() {
          const actor = actorOf(yield* CurrentMember);

          return yield* desk
            .answer(
              actor,
              params.chatId,
              params.callId,
              payload.approved,
              yield* askedOf(payload.timeZone)
            )
            .pipe(
              Effect.catchTags({
                ...runRefusals(actor),
                ApprovalNotPending: () =>
                  Effect.fail(new AgentApprovalNotPending()),
                MediaRejected: () =>
                  Effect.die("An approval's answer attaches no file"),
                MessageRejected: () =>
                  Effect.die("An approval's answer holds no message"),
              })
            );
        })
      );
  })
);
