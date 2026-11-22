import {
  Context,
  DateTime,
  Effect,
  Exit,
  Fiber,
  FiberSet,
  Layer,
  Option,
  Schema,
  Scope,
  Stream,
} from "effect";

import { ApprovalNotPending } from "#agent/application/approval-not-pending.ts";
import { ChatBusy } from "#agent/application/chat-busy.ts";
import { ChatNotFound } from "#agent/application/chat-not-found.ts";
import type { MediaRejected } from "#agent/application/media-rejected.ts";
import { MessageRejected } from "#agent/application/message-rejected.ts";
import { ownerOf } from "#agent/application/owner-of.ts";
import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import type {
  ChatChange,
  ChatOwner,
  ChatPage,
  ExportedChat,
} from "#agent/application/ports/agent-chats.ts";
import { AgentRuns } from "#agent/application/ports/agent-runs.ts";
import type {
  RequestOrigin,
  RunInput,
  RunRefusal,
} from "#agent/application/ports/agent-runs.ts";
import { AgentSkills } from "#agent/application/ports/agent-skills.ts";
import { AttachedFiles } from "#agent/application/ports/attached-files.ts";
import { SkillNotFound } from "#agent/application/skill-not-found.ts";
import { pendingOf } from "#agent/domain/agent-approvals.ts";
import { AgentChat } from "#agent/domain/agent-chat.ts";
import type { AgentEvent } from "#agent/domain/agent-event.ts";
import { personTimeZone } from "#agent/domain/agent-instructions.ts";
import type {
  AgentAvailability,
  AgentRating,
} from "#agent/domain/agent-parts.ts";
import { byName, maxSkills } from "#agent/domain/agent-skill.ts";
import type { AgentSkill } from "#agent/domain/agent-skill.ts";
import { positionOf } from "#agent/domain/chat-cursor.ts";
import { AgentChatIdSchema, AgentMessageIdSchema } from "#agent/domain/ids.ts";
import type { PersonRequired } from "#agent/domain/person-required.ts";
import { chatPageSize, runLease } from "#agent/domain/run-limits.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";

const decodeChatId = Schema.decodeUnknownOption(AgentChatIdSchema);

const decodeMessageId = Schema.decodeUnknownOption(AgentMessageIdSchema);

/** What a person's message to the agent, or their answer to a change, says. */
export interface RunAsked {
  readonly origin: RequestOrigin;
  /** The person's IANA time zone, as their browser names it. */
  readonly timeZone: string | undefined;
}

type Refused = MissingPermission | PersonRequired;

type RunFailure =
  | ApprovalNotPending
  | ChatBusy
  | ChatNotFound
  | MediaRejected
  | MessageRejected
  | RunRefusal
  | SkillNotFound;

/**
 * A person's message: its text, the files it attaches and the skills it
 * picks, each by its id.
 */
export interface SentMessage {
  readonly mediaIds?: readonly string[];
  readonly skillIds?: readonly string[];
  readonly text: string;
}

/** What the person sent: a message with the files it names, or an answer. */
type Asked =
  | {
      readonly _tag: "message";
      readonly mediaIds: readonly string[];
      readonly skillIds: readonly string[];
      readonly text: string;
    }
  | Extract<RunInput, { readonly _tag: "answer" }>;

// The chat, or the refusal that tells nobody whether it is someone else's.
const orNotFound = <A>(
  found: Option.Option<A>
): Effect.Effect<A, ChatNotFound> =>
  Option.isSome(found)
    ? Effect.succeed(found.value)
    : Effect.fail(new ChatNotFound());

/**
 * The agent, for a person in their own session: their chats in the
 * workspace, which nobody else reads, and its runs, one at a time per
 * chat. Every use case needs `assistant:use`.
 */
export class AgentDesk extends Context.Service<
  AgentDesk,
  {
    readonly availability: (
      actor: Actor
    ) => Effect.Effect<AgentAvailability, Refused>;
    readonly chats: (
      actor: Actor,
      cursor: Option.Option<string>
    ) => Effect.Effect<ChatPage, Refused>;
    readonly createChat: (actor: Actor) => Effect.Effect<AgentChat, Refused>;
    readonly chat: (
      actor: Actor,
      chatId: string
    ) => Effect.Effect<ExportedChat, ChatNotFound | Refused>;
    readonly updateChat: (
      actor: Actor,
      chatId: string,
      change: ChatChange
    ) => Effect.Effect<AgentChat, ChatNotFound | Refused>;
    readonly deleteChat: (
      actor: Actor,
      chatId: string
    ) => Effect.Effect<void, ChatNotFound | Refused>;
    readonly rate: (
      actor: Actor,
      chatId: string,
      messageId: string,
      rating: Option.Option<AgentRating>
    ) => Effect.Effect<void, ChatNotFound | Refused>;
    /** A message to the agent: the run's events, once it may start. */
    readonly send: (
      actor: Actor,
      chatId: string,
      message: SentMessage,
      asked: RunAsked
    ) => Effect.Effect<Stream.Stream<AgentEvent>, RunFailure>;
    /** The person's answer to a change the agent asked to make. */
    readonly answer: (
      actor: Actor,
      chatId: string,
      callId: string,
      approved: boolean,
      asked: RunAsked
    ) => Effect.Effect<Stream.Stream<AgentEvent>, RunFailure>;
  }
>()("peal-server/agent/application/AgentDesk") {
  static readonly layer = Layer.effect(
    AgentDesk,
    Effect.gen(function* AgentDeskLive() {
      const chats = yield* AgentChats;
      const runs = yield* AgentRuns;
      const files = yield* AttachedFiles;
      const skills = yield* AgentSkills;
      const ids = yield* Ids;
      // A run whose stream is never read (its request gone before its
      // answer started) still lets go of what it holds, after its lease.
      const watchdogs = yield* FiberSet.make();

      const found = (owner: ChatOwner, chatId: string) =>
        orNotFound(decodeChatId(chatId)).pipe(
          Effect.flatMap((id) => chats.chat(owner, id)),
          Effect.flatMap(orNotFound)
        );

      // The skills a message picks, each once, in the order given, each
      // one the person may use; and the others they may use, by name, as
      // many as they may see.
      const pickedSkills = (owner: ChatOwner, skillIds: readonly string[]) =>
        Effect.gen(function* picking() {
          const usable = yield* skills.usable(owner);
          const picked: AgentSkill[] = [];

          for (const skillId of new Set(skillIds)) {
            const skill = usable.find(({ id }) => id === skillId);

            if (skill === undefined) {
              return yield* new SkillNotFound({ skillId });
            }

            picked.push(skill);
          }

          const offeredSkills = usable
            .filter((skill) => !picked.includes(skill))
            .toSorted(byName)
            .slice(0, maxSkills);

          return { offeredSkills, skills: picked };
        });

      // A run on a chat of the owner's: claimed for it alone, refused while
      // another holds it; then the run's events, which let go of the chat
      // and of what the run holds once they end, however they end.
      const run = (
        actor: Actor,
        chatId: string,
        given: Asked,
        { origin, timeZone }: RunAsked
      ) =>
        Effect.gen(function* running() {
          const owner = yield* ownerOf(actor);

          if (given._tag === "message" && given.text.trim().length === 0) {
            return yield* new MessageRejected({ reason: "empty" });
          }

          const chat = yield* found(owner, chatId);

          // The files a message attaches and the skills it picks, before
          // anything is claimed or counted: a file it cannot use, or a
          // skill the person may not, refuses it whole.
          const input: RunInput =
            given._tag === "message"
              ? {
                  _tag: "message",
                  media: yield* files.read(actor, given.mediaIds),
                  ...(yield* pickedSkills(owner, given.skillIds)),
                  text: given.text,
                }
              : given;

          const runId = yield* ids.next;
          const now = yield* DateTime.now;

          const claimed = yield* chats.claim(
            owner,
            chat.id,
            runId,
            now,
            DateTime.addDuration(now, runLease)
          );

          if (Option.isNone(claimed)) {
            return yield* new ChatBusy();
          }

          const release = chats.release(chat.id, runId);

          const pending =
            input._tag === "answer" &&
            Option.exists(claimed.value.asking, (answer) =>
              pendingOf(answer).some(({ callId }) => callId === input.callId)
            );

          if (input._tag === "answer" && !pending) {
            return yield* release.pipe(
              Effect.andThen(Effect.fail(new ApprovalNotPending()))
            );
          }

          const scope = yield* Scope.make();

          const ended = Scope.close(scope, Exit.void).pipe(
            Effect.andThen(release)
          );

          const events = yield* runs
            .start({
              actor,
              chat: claimed.value,
              input,
              origin,
              timeZone: personTimeZone(timeZone),
            })
            .pipe(
              Scope.provide(scope),
              Effect.onError(() => ended)
            );

          const watchdog = yield* FiberSet.run(
            watchdogs,
            Effect.sleep(runLease).pipe(Effect.andThen(ended))
          );

          return events.pipe(
            Stream.ensuring(
              Fiber.interrupt(watchdog).pipe(Effect.andThen(ended))
            )
          );
        });

      return AgentDesk.of({
        answer: (actor, chatId, callId, approved, asked) =>
          run(actor, chatId, { _tag: "answer", approved, callId }, asked).pipe(
            Effect.withSpan("AgentDesk.answer")
          ),
        availability: (actor) =>
          ownerOf(actor).pipe(
            Effect.andThen(runs.availability(actor)),
            Effect.withSpan("AgentDesk.availability")
          ),
        chat: (actor, chatId) =>
          ownerOf(actor).pipe(
            Effect.flatMap((owner) =>
              orNotFound(decodeChatId(chatId)).pipe(
                Effect.flatMap((id) => chats.detail(owner, id)),
                Effect.flatMap(orNotFound)
              )
            ),
            Effect.withSpan("AgentDesk.chat")
          ),
        chats: (actor, cursor) =>
          ownerOf(actor).pipe(
            Effect.flatMap((owner) =>
              chats.page(
                owner,
                cursor.pipe(Option.flatMap(positionOf)),
                chatPageSize
              )
            ),
            Effect.withSpan("AgentDesk.chats")
          ),
        createChat: (actor) =>
          Effect.gen(function* createChat() {
            const owner = yield* ownerOf(actor);
            const now = yield* DateTime.now;

            const chat = new AgentChat({
              createdAt: now,
              id: yield* newId(AgentChatIdSchema).pipe(
                Effect.provideService(Ids, ids)
              ),
              starred: false,
              title: Option.none(),
              updatedAt: now,
              userId: owner.userId,
              workspaceId: owner.workspaceId,
            });

            yield* chats.create(chat);

            return chat;
          }).pipe(Effect.withSpan("AgentDesk.createChat")),
        deleteChat: (actor, chatId) =>
          Effect.gen(function* deleteChat() {
            const owner = yield* ownerOf(actor);
            const chat = yield* found(owner, chatId);

            const removed = yield* chats.remove(owner, chat.id);

            yield* removed ? Effect.void : Effect.fail(new ChatNotFound());
          }).pipe(Effect.withSpan("AgentDesk.deleteChat")),
        rate: (actor, chatId, messageId, rating) =>
          Effect.gen(function* rate() {
            const owner = yield* ownerOf(actor);
            const chat = yield* found(owner, chatId);

            const message = decodeMessageId(messageId);

            const rated =
              Option.isSome(message) &&
              (yield* chats.rate(owner, chat.id, message.value, rating));

            yield* rated ? Effect.void : Effect.fail(new ChatNotFound());
          }).pipe(Effect.withSpan("AgentDesk.rate")),
        send: (actor, chatId, { mediaIds = [], skillIds = [], text }, asked) =>
          run(
            actor,
            chatId,
            { _tag: "message", mediaIds, skillIds, text },
            asked
          ).pipe(Effect.withSpan("AgentDesk.send")),
        updateChat: (actor, chatId, change) =>
          Effect.gen(function* updateChat() {
            const owner = yield* ownerOf(actor);
            const chat = yield* found(owner, chatId);

            return yield* chats
              .update(owner, chat.id, change)
              .pipe(Effect.flatMap(orNotFound));
          }).pipe(Effect.withSpan("AgentDesk.updateChat")),
      });
    })
  );
}
