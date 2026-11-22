// The agent's runs on the fake model and tools, with the assistant's real
// allowances and the agent's tables: what a run sends, what it keeps, and
// what it asks the person first.
import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Option, Ref, Stream } from "effect";
import { AiError } from "effect/ai";
import { SqlClient } from "effect/sql";
import { CurrentMember } from "peal-contract";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import type { RunAsked } from "#agent/application/agent-desk.ts";
import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import type { AgentEvent } from "#agent/domain/agent-event.ts";
import { maxRounds } from "#agent/domain/run-limits.ts";
import { Ids } from "#shared/application/ids.ts";
import {
  agentTest,
  calls,
  DatabaseTest,
  FakeAgentModel,
  FakeTools,
  fails,
  freshPerson,
  postId,
  says,
  saysThenCalls,
  silence,
} from "#test/agent/support.ts";
import type { Person, Round } from "#test/agent/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

const asked: RunAsked = {
  origin: { headers: {}, remoteAddress: Option.none() },
  timeZone: "Europe/Paris",
};

const script = (rounds: readonly Round[]) =>
  FakeAgentModel.use((model) => model.script(rounds));

const prompts = FakeAgentModel.use((model) => model.prompts);

const newChat = (person: Person) =>
  AgentDesk.use((desk) => desk.createChat(person.actor));

const send = (person: Person, chatId: string, text: string) =>
  AgentDesk.use((desk) => desk.send(person.actor, chatId, text, asked)).pipe(
    Effect.flatMap(Stream.runCollect),
    Effect.provideService(CurrentMember, person.member)
  );

const answer = (
  person: Person,
  chatId: string,
  callId: string,
  approved: boolean
) =>
  AgentDesk.use((desk) =>
    desk.answer(person.actor, chatId, callId, approved, asked)
  ).pipe(
    Effect.flatMap(Stream.runCollect),
    Effect.provideService(CurrentMember, person.member)
  );

const detail = (person: Person, chatId: string) =>
  AgentDesk.use((desk) => desk.chat(person.actor, chatId));

const tags = (events: readonly AgentEvent[]) =>
  events.map((event) => event._tag);

const ended = (events: readonly AgentEvent[]) => events.at(-1);

const text = (events: readonly AgentEvent[]) =>
  events
    .flatMap((event) => (event._tag === "text" ? [event.delta] : []))
    .join("");

layer(DatabaseTest, { timeout: "60 seconds" })("the agent's runs", (it) => {
  it.effect(
    "streams an answer, keeps both messages and names the chat after its first answer",
    () =>
      Effect.gen(function* answers() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([says("You have two drafts.")]);
        yield* FakeAgentModel.use((model) => model.titled("Drafts this week"));

        const events = yield* send(person, chat.id, "What drafts do I have?");

        assert.deepStrictEqual(tags(events), [
          "started",
          "text",
          "title",
          "finished",
        ]);
        assert.strictEqual(text(events), "You have two drafts.");
        assert.deepInclude(ended(events), { outcome: "answered" });

        const kept = yield* detail(person, chat.id);

        assert.deepStrictEqual(
          kept.messages.map(({ role, text: said }) => [role, said]),
          [
            ["user", "What drafts do I have?"],
            ["assistant", "You have two drafts."],
          ]
        );
        assert.deepStrictEqual(
          kept.chat.title,
          Option.some("Drafts this week")
        );

        // The model read the rules, then the person's message, as data.
        const [first] = yield* prompts;
        const roles = first?.content.map(({ role }) => role);

        assert.deepStrictEqual(roles, ["system", "user"]);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "names the chat after the person's first words when the model gives no title",
    () =>
      Effect.gen(function* fallsBack() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* FakeAgentModel.use((model) => model.titled(null));

        const events = yield* send(
          person,
          chat.id,
          "Plan the posts of our spring launch across every channel we have connected"
        );

        const title = events.find((event) => event._tag === "title");

        assert.deepStrictEqual(title, {
          _tag: "title",
          title: "Plan the posts of our spring launch across every channel we",
        });
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "places each step where the answer stood when the tool was called, and keeps it there",
    () =>
      Effect.gen(function* placesSteps() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([
          saysThenCalls("Let me look. ", "list_posts", {}),
          says("You have two posts."),
        ]);

        const events = yield* send(person, chat.id, "What's scheduled?");

        const steps = events.flatMap((event) =>
          event._tag === "step" ? [[event.step.state, event.step.at]] : []
        );

        assert.deepStrictEqual(steps, [
          ["running", 13],
          ["done", 13],
        ]);

        const kept = yield* detail(person, chat.id);

        assert.deepStrictEqual(
          kept.messages.at(-1)?.steps.map(({ at }) => at),
          [13]
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "runs a reading tool and a draft at once, with their steps and the draft's card",
    () =>
      Effect.gen(function* readsAndDrafts() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([
          calls("list_posts", {}),
          calls("create_draft", { content: { text: "Spring is here." } }),
          says("I wrote a draft."),
        ]);

        const events = yield* send(person, chat.id, "Write a draft");

        const steps = events.flatMap((event) =>
          event._tag === "step" ? [[event.step.tool, event.step.state]] : []
        );

        assert.deepStrictEqual(steps, [
          ["list_posts", "running"],
          ["list_posts", "done"],
          ["create_draft", "running"],
          ["create_draft", "done"],
        ]);

        const card = events.find((event) => event._tag === "card");

        assert.deepInclude(card, {
          card: {
            _tag: "post",
            action: "created",
            channelIds: ["0190f0e0-0000-7000-8000-00000000c001"],
            excerpt: "Our spring launch is here.",
            postId,
            scheduledAt: null,
          },
        });
        assert.deepInclude(ended(events), { outcome: "answered" });

        // The draft's call is kept as a change; reading is not.
        const records = yield* FakeTools.use((tools) => tools.records);

        assert.deepStrictEqual(
          records.map(({ refused, tool }) => [tool, refused]),
          [["create_draft", false]]
        );

        // The second round read the first's answer.
        const all = yield* prompts;

        assert.lengthOf(all, 3);
        assert.isTrue(
          all[1]?.content.some((message) => message.role === "tool") ?? false
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect("returns a tool's refusal to the model, which goes on", () =>
    Effect.gen(function* refuses() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);

      yield* script([
        calls("get_post", { postId: "nope" }),
        says("That post does not exist."),
      ]);

      const events = yield* send(person, chat.id, "Show me post nope");

      const states = events.flatMap((event) =>
        event._tag === "step" ? [event.step.state] : []
      );

      assert.deepStrictEqual(states, ["running", "refused"]);
      assert.deepInclude(ended(events), { outcome: "answered" });
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "asks before scheduling, from the call's parameters and the post, and runs nothing until approved",
    () =>
      Effect.gen(function* asks() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([
          calls(
            "schedule_post",
            { at: "2026-12-01T08:00:00.000Z", postId },
            "call-schedule"
          ),
        ]);

        const events = yield* send(person, chat.id, "Schedule it for Monday");

        const approval = events.find((event) => event._tag === "approval");

        assert.deepStrictEqual(approval, {
          _tag: "approval",
          approval: {
            at: approval?._tag === "approval" ? approval.approval.at : null,
            callId: "call-schedule",
            channelIds: ["0190f0e0-0000-7000-8000-00000000c001"],
            postId,
            state: "pending",
            text: "Our spring launch is here.",
            threadId: null,
            tool: "schedule_post",
          },
        });
        assert.isNotNull(
          approval?._tag === "approval" ? approval.approval.at : null
        );
        assert.deepInclude(ended(events), { outcome: "awaitingApproval" });
        assert.notInclude(
          yield* FakeTools.use((tools) => tools.ran),
          "schedule_post"
        );

        // Approved: the same answer goes on, the change is made and kept.
        yield* script([says("Scheduled.")]);

        const after = yield* answer(person, chat.id, "call-schedule", true);
        const [started] = after;
        const [before] = events;

        assert.deepStrictEqual(started, {
          _tag: "started",
          messageId: before?._tag === "started" ? before.messageId : "",
          userMessageId: null,
        });
        assert.deepStrictEqual(tags(after), [
          "started",
          "approval",
          "step",
          "step",
          "card",
          "text",
          "finished",
        ]);
        const [, decided] = after;

        assert.isTrue(
          decided?._tag === "approval" &&
            decided.approval.callId === "call-schedule" &&
            decided.approval.state === "approved"
        );

        const card = after.at(4);

        assert.isTrue(
          card?._tag === "card" &&
            card.card._tag === "post" &&
            card.card.action === "scheduled" &&
            card.card.postId === postId &&
            card.card.scheduledAt !== null
        );
        assert.include(
          yield* FakeTools.use((tools) => tools.ran),
          "schedule_post"
        );

        const kept = yield* detail(person, chat.id);

        const assistant = kept.messages.filter(
          ({ role }) => role === "assistant"
        );

        assert.lengthOf(assistant, 1);
        assert.deepStrictEqual(
          assistant[0]?.approvals.map(({ state }) => state),
          ["approved"]
        );
        assert.deepStrictEqual(assistant[0]?.outcome, Option.some("answered"));

        // A change answered once is not answered again.
        const again = yield* AgentDesk.use((desk) =>
          desk.answer(person.actor, chat.id, "call-schedule", true, asked)
        ).pipe(Effect.flip);

        assert.strictEqual(again._tag, "ApprovalNotPending");
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect("tells the model a declined change was not made", () =>
    Effect.gen(function* declines() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);

      yield* script([
        calls(
          "reply_to_comment",
          { commentId: "c1", text: "Thank you!" },
          "call-reply"
        ),
      ]);

      const events = yield* send(person, chat.id, "Thank them");
      const approval = events.find((event) => event._tag === "approval");

      assert.deepInclude(approval, {
        approval: {
          at: null,
          callId: "call-reply",
          channelIds: [],
          postId: null,
          state: "pending",
          text: "Thank you!",
          threadId: null,
          tool: "reply_to_comment",
        },
      });

      yield* script([says("I did not reply.")]);

      const after = yield* answer(person, chat.id, "call-reply", false);

      assert.deepStrictEqual(tags(after), [
        "started",
        "approval",
        "text",
        "finished",
      ]);
      assert.notInclude(
        yield* FakeTools.use((tools) => tools.ran),
        "reply_to_comment"
      );

      const last = (yield* prompts).at(-1);

      const results = (last?.content ?? []).flatMap((message) =>
        message.role === "tool"
          ? message.content.flatMap((part) =>
              part.type === "tool-result" ? [String(part.result)] : []
            )
          : []
      );

      assert.isTrue(results.some((result) => result.includes("declined")));
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "lets a change expire when the person writes again instead of answering",
    () =>
      Effect.gen(function* expires() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([
          calls(
            "schedule_post",
            { at: "2026-12-01T08:00:00.000Z", postId },
            "call-expiring"
          ),
        ]);

        yield* send(person, chat.id, "Schedule it");
        yield* script([says("Fine, I left it.")]);

        const events = yield* send(person, chat.id, "Actually, leave it");

        assert.deepStrictEqual(tags(events).slice(0, 2), [
          "started",
          "approval",
        ]);
        assert.isTrue(
          events[1]?._tag === "approval" &&
            events[1].approval.callId === "call-expiring" &&
            events[1].approval.state === "expired"
        );

        const kept = yield* detail(person, chat.id);

        assert.deepStrictEqual(
          kept.messages.flatMap(({ approvals }) =>
            approvals.map(({ state }) => state)
          ),
          ["expired"]
        );

        const expired = yield* AgentDesk.use((desk) =>
          desk.answer(person.actor, chat.id, "call-expiring", true, asked)
        ).pipe(Effect.flip);

        assert.strictEqual(expired._tag, "ApprovalNotPending");
        assert.notInclude(
          yield* FakeTools.use((tools) => tools.ran),
          "schedule_post"
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect("stops at the most rounds a run takes", () =>
    Effect.gen(function* limited() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);

      yield* script(
        Array.from({ length: maxRounds + 2 }, (_, index) =>
          calls("list_posts", {}, `call-${String(index)}`)
        )
      );

      const events = yield* send(person, chat.id, "Keep looking");

      assert.deepInclude(ended(events), { outcome: "stepLimit" });
      assert.lengthOf(yield* prompts, maxRounds);
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "keeps what was written as stopped when the person closes the stream",
    () =>
      Effect.gen(function* stops() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([silence]);

        const first = yield* AgentDesk.use((desk) =>
          desk.send(person.actor, chat.id, "Think hard", asked)
        ).pipe(
          Effect.flatMap((events) => Stream.runCollect(Stream.take(events, 1))),
          Effect.provideService(CurrentMember, person.member)
        );

        assert.deepStrictEqual(tags(first), ["started"]);

        const kept = yield* detail(person, chat.id);

        assert.deepStrictEqual(
          kept.messages.map(({ outcome, role }) => [
            role,
            Option.getOrNull(outcome),
          ]),
          [
            ["user", null],
            ["assistant", "stopped"],
          ]
        );

        // The chat is free again.
        yield* script([says("Here.")]);

        const next = yield* send(person, chat.id, "Again");

        assert.deepInclude(ended(next), { outcome: "answered" });
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "fails the run on the provider's failure, by its kind, keeping what came before",
    () =>
      Effect.gen(function* failsRun() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([
          calls("list_posts", {}),
          fails(new AiError.AuthenticationError({ kind: "InvalidKey" })),
        ]);

        const events = yield* send(person, chat.id, "Look");

        assert.deepStrictEqual(ended(events), {
          _tag: "failed",
          reason: "providerRefused",
        });

        const kept = yield* detail(person, chat.id);

        assert.deepStrictEqual(
          kept.messages.at(-1)?.outcome,
          Option.some("failed")
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect("refuses a second run while one holds the chat", () =>
    Effect.gen(function* busy() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);
      const runId = yield* Ids.use((ids) => ids.next);
      const owner = { userId: person.userId, workspaceId: person.workspaceId };

      // Another server's run, whose claim holds for an hour.
      yield* AgentChats.use((chats) =>
        chats.claim(
          owner,
          chat.id,
          runId,
          chat.createdAt,
          DateTime.add(chat.createdAt, { hours: 1 })
        )
      );

      const refusal = yield* AgentDesk.use((desk) =>
        desk.send(person.actor, chat.id, "Hello", asked)
      ).pipe(Effect.flip);

      assert.strictEqual(refusal._tag, "ChatBusy");

      // Once it lapses, the chat is free again.
      yield* AgentChats.use((chats) =>
        chats.claim(
          owner,
          chat.id,
          runId,
          DateTime.add(chat.createdAt, { hours: 2 }),
          DateTime.subtract(chat.createdAt, { hours: 1 })
        )
      );

      const events = yield* send(person, chat.id, "Hello");

      assert.deepInclude(ended(events), { outcome: "answered" });
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect("refuses a blank message before anything runs", () =>
    Effect.gen(function* blank() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);

      const refusal = yield* AgentDesk.use((desk) =>
        desk.send(person.actor, chat.id, "   \n ", asked)
      ).pipe(Effect.flip);

      assert.deepInclude(refusal, { _tag: "MessageRejected", reason: "empty" });
      assert.lengthOf(yield* prompts, 0);
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "claims one of the month's requests a round on a server that bills",
    () =>
      Effect.gen(function* metered() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([calls("list_posts", {}), says("None.")]);
        yield* send(person, chat.id, "Any posts?");

        const { claims } = yield* FakeMetersLedger.use(Ref.get);

        assert.deepStrictEqual(
          claims.map(({ meter, units }) => [meter, units]),
          [
            ["assistantRequests", 1],
            ["assistantRequests", 1],
          ]
        );
      }).pipe(
        Effect.provide(
          agentTest({
            meters: fakeMeters({ allowed: Option.some(10) }),
            metered: true,
          })
        )
      )
  );

  it.effect(
    "refuses a billing account without a payment method before the model is asked",
    () =>
      Effect.gen(function* unpaid() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        const refusal = yield* AgentDesk.use((desk) =>
          desk.send(person.actor, chat.id, "Hello", asked)
        ).pipe(
          Effect.provideService(CurrentMember, person.member),
          Effect.flip
        );

        assert.deepInclude(refusal, {
          _tag: "AllowanceReached",
          meter: "assistantRequests",
        });
        assert.lengthOf(yield* prompts, 0);

        const status = yield* AgentDesk.use((desk) =>
          desk.availability(person.actor)
        );

        assert.deepStrictEqual(status, {
          available: false,
          reason: "paymentMethod",
          source: null,
        });

        // The chat is free: the refusal let go of it.
        const chats = yield* AgentDesk.use((desk) =>
          desk.chats(person.actor, Option.none())
        );

        assert.lengthOf(chats.chats, 1);
      }).pipe(
        Effect.provide(
          agentTest({
            meters: fakeMeters({
              allowed: Option.some(0),
              paymentMethod: false,
            }),
            metered: true,
          })
        )
      )
  );

  it.effect(
    "counts one of the day's requests a round off billing, and refuses past them",
    () =>
      Effect.gen(function* daily() {
        const person = yield* freshPerson;
        const chat = yield* newChat(person);

        yield* script([calls("list_posts", {}), says("None.")]);
        yield* send(person, chat.id, "Any posts?");

        const sql = yield* SqlClient.SqlClient;

        const rows = yield* sql<{
          readonly requests: number;
        }>`SELECT requests FROM assistant.daily_usage WHERE workspace_id = ${person.workspaceId}`;

        assert.deepStrictEqual(
          rows.map(({ requests }) => requests),
          [2]
        );

        const refusal = yield* AgentDesk.use((desk) =>
          desk.send(person.actor, chat.id, "More", asked)
        ).pipe(
          Effect.provideService(CurrentMember, person.member),
          Effect.flip
        );

        assert.deepInclude(refusal, {
          _tag: "DayExhausted",
          dailyLimit: 2,
          source: "server",
        });
      }).pipe(Effect.provide(agentTest({ dailyRequests: 2 })))
  );

  it.effect("is off without a model, and says why", () =>
    Effect.gen(function* off() {
      const person = yield* freshPerson;
      const chat = yield* newChat(person);

      const status = yield* AgentDesk.use((desk) =>
        desk.availability(person.actor)
      );

      assert.deepStrictEqual(status, {
        available: false,
        reason: "noModel",
        source: null,
      });

      const refusal = yield* AgentDesk.use((desk) =>
        desk.send(person.actor, chat.id, "Hello", asked)
      ).pipe(Effect.provideService(CurrentMember, person.member), Effect.flip);

      assert.strictEqual(refusal._tag, "AgentModelOff");
    }).pipe(Effect.provide(agentTest({ model: "off" })))
  );
});
