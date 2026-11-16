import { DateTime, Effect, Layer, Option } from "effect";

import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { PrivateReplyJobs } from "#engagement/application/ports/private-reply-jobs.ts";
import { PrivateReplySender } from "#engagement/application/ports/private-reply-sender.ts";
import type {
  PrivateReplyOutcome,
  PrivateReplyRequest,
} from "#engagement/application/ports/private-reply-sender.ts";
import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import type { PrivateReplyJournalled } from "#engagement/application/ports/private-reply-store.ts";
import { SendPrivateReply } from "#engagement/application/send-private-reply.ts";
import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import type { InboxPlatforms } from "#shared/domain/inbox-platform.ts";

import { makeMessageWorld } from "./message-world.ts";
import { makeWorld } from "./world.ts";

// The private replies' use cases on memory: the comments' world (its
// comments, channels, meters and ids), the messages' store (which
// channels have their messages on, which applications the owner let), a
// store of private replies that holds what the Postgres one holds, and a
// platform that answers what a test says.

const millis = (at: DateTime.Utc) => DateTime.toEpochMillis(at);

export interface PrivateReplyWorldState {
  readonly cancelled: PrivateReplyId[];
  readonly jobs: PrivateReplyId[];
  /** The private reply each key made, by `<workspace>:<key>`. */
  readonly keys: Map<string, PrivateReplyId>;
  readonly replies: Map<string, PrivateReply>;
  readonly resumed: PrivateReplyRequest[];
  resuming: PrivateReplyOutcome;
  readonly sent: PrivateReplyRequest[];
  sending: PrivateReplyOutcome;
}

/** A world of its own for one test. */
export const makePrivateReplyWorld = (
  options: {
    readonly inbox?: InboxPlatforms;
    readonly messages?: InboxMessagePlatforms;
    readonly meters?: Layer.Layer<MeteredUsage>;
  } = {}
) => {
  const meters = options.meters ?? MeteredUsage.layerUnmetered;
  const messages = options.messages ?? new Set(["facebook", "instagram"]);
  const inbox = options.inbox ?? new Set(["facebook", "instagram"]);
  const comments = makeWorld(meters);
  const boxes = makeMessageWorld(messages, meters);

  const state: PrivateReplyWorldState = {
    cancelled: [],
    jobs: [],
    keys: new Map(),
    replies: new Map(),
    resumed: [],
    resuming: { _tag: "unconfirmed", reason: "interrupted" },
    sent: [],
    sending: { _tag: "sent", platformMessageId: "m-private" },
  };

  const madeUnder = (
    reply: PrivateReply,
    key: string
  ): Option.Option<PrivateReplyJournalled> =>
    Option.fromUndefinedOr(state.keys.get(`${reply.workspaceId}:${key}`)).pipe(
      Option.flatMap((id) => Option.fromUndefinedOr(state.replies.get(id))),
      Option.map((earlier): PrivateReplyJournalled =>
        earlier.commentId === reply.commentId && earlier.text === reply.text
          ? { _tag: "replayed", reply: earlier }
          : { _tag: "keyReused" }
      )
    );

  const store = PrivateReplyStore.of({
    advance: (next, from) =>
      Effect.sync(() => {
        const now = state.replies.get(next.id);

        if (
          now === undefined ||
          JSON.stringify(now.status) !== JSON.stringify(from.status)
        ) {
          return false;
        }

        state.replies.set(next.id, next);

        return true;
      }),
    claimCall: (privateReplyId) =>
      Effect.sync(
        () => state.replies.get(privateReplyId)?.status._tag === "sending"
      ),
    dropUnsent: (channelId) =>
      Effect.sync(() => {
        const unsent = [...state.replies.values()].filter(
          (reply) =>
            reply.channelId === channelId &&
            reply.status._tag === "sending" &&
            Option.isNone(reply.status.attemptedAt)
        );

        for (const reply of unsent) {
          state.replies.delete(reply.id);
        }

        return unsent;
      }),
    journal: (reply, key) =>
      Effect.sync((): PrivateReplyJournalled => {
        if (Option.isSome(key)) {
          const made = madeUnder(reply, key.value.key);

          if (Option.isSome(made)) {
            return made.value;
          }
        }

        const pending = [...state.replies.values()].find(
          (held) =>
            held.commentId === reply.commentId && held.status._tag !== "failed"
        );

        if (pending !== undefined) {
          return { _tag: "pending", privateReplyId: pending.id };
        }

        const comment = comments.state.comments.get(reply.commentId);

        if (
          comment === undefined ||
          comment.workspaceId !== reply.workspaceId ||
          comment.channelId !== reply.channelId ||
          boxes.state.boxes.get(reply.channelId)?.workspaceId !==
            reply.workspaceId
        ) {
          return { _tag: "dropped" };
        }

        state.replies.set(reply.id, reply);

        if (Option.isSome(key)) {
          state.keys.set(`${reply.workspaceId}:${key.value.key}`, reply.id);
        }

        return { _tag: "journalled" };
      }),
    madeWithKey: (reply, key) => Effect.sync(() => madeUnder(reply, key.key)),
    ofComments: (commentIds) =>
      Effect.sync(() =>
        [...state.replies.values()]
          .filter((reply) => commentIds.includes(reply.commentId))
          .toSorted((left, right) => left.id.localeCompare(right.id))
      ),
    privateReply: (privateReplyId) =>
      Effect.sync(() =>
        Option.fromUndefinedOr(state.replies.get(privateReplyId))
      ),
    purge: (keptSince) =>
      Effect.sync(() => {
        const gone = [...state.replies.values()].filter(
          (reply) =>
            reply.status._tag !== "sending" &&
            millis(reply.status.at) < millis(keptSince)
        );

        for (const reply of gone) {
          state.replies.delete(reply.id);
        }

        return gone.length;
      }),
    sentIdsOf: (channelId, except) =>
      Effect.sync(() =>
        [...state.replies.values()].flatMap((reply) =>
          reply.channelId === channelId &&
          reply.id !== except &&
          reply.status._tag === "sent"
            ? Option.toArray(reply.status.platformMessageId)
            : []
        )
      ),
    stranded: (writtenBefore, _calledBefore, limit) =>
      Effect.sync(() =>
        [...state.replies.values()]
          .filter(
            (reply) =>
              reply.status._tag === "sending" &&
              millis(reply.createdAt) <= millis(writtenBefore)
          )
          .slice(0, limit)
      ),
  });

  const ports = Layer.mergeAll(
    Layer.succeed(PrivateReplyStore, store),
    Layer.succeed(MessageStore, boxes.store),
    Layer.succeed(
      PrivateReplyJobs,
      PrivateReplyJobs.of({
        cancel: (privateReplyId) =>
          Effect.sync(() => {
            state.cancelled.push(privateReplyId);
          }),
        start: (privateReplyId) =>
          Effect.sync(() => {
            state.jobs.push(privateReplyId);
          }),
      })
    ),
    Layer.succeed(
      PrivateReplySender,
      PrivateReplySender.of({
        resume: (request) =>
          Effect.sync(() => {
            state.resumed.push(request);

            return state.resuming;
          }),
        send: (request) =>
          Effect.sync(() => {
            state.sent.push(request);

            return state.sending;
          }),
      })
    ),
    Layer.succeed(CurrentInboxPlatforms, inbox),
    Layer.succeed(CurrentInboxMessages, messages)
  ).pipe(Layer.provideMerge(comments.ports));

  const layer = Layer.mergeAll(
    EngagementPrivateReplies.layer,
    SendPrivateReply.layer
  ).pipe(Layer.provideMerge(ports));

  return { boxes, comments, layer, state };
};

export type PrivateReplyWorld = ReturnType<typeof makePrivateReplyWorld>;
