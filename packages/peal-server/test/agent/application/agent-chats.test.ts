// A person's chats with the agent: theirs alone, kept 90 days after their
// last message, erased with the workspace, the membership and the
// account, and in the account's export; and nothing of what they say
// reaches a log or a span.
import { assert, layer } from "@effect/vitest";
import {
  Cause,
  DateTime,
  Effect,
  Exit,
  Logger,
  Option,
  Ref,
  Stream,
  Tracer,
} from "effect";
import { SqlClient } from "effect/sql";
import { CurrentMember } from "peal-contract";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import type { RunAsked } from "#agent/application/agent-desk.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { WritingAssistant } from "#assistant/application/writing-assistant.ts";
import { Actor } from "#shared/domain/access.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  agentTest,
  calls,
  DatabaseTest,
  FakeAgentModel,
  freshPerson,
  personIn,
  says,
} from "#test/agent/support.ts";
import type { Person } from "#test/agent/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

const asked: RunAsked = {
  origin: { headers: {}, remoteAddress: Option.none() },
  timeZone: "Not/AZone",
};

const desk = AgentDesk;

const newChat = (person: Person) =>
  desk.use((agent) => agent.createChat(person.actor));

const send = (person: Person, chatId: string, text: string) =>
  desk
    .use((agent) => agent.send(person.actor, chatId, text, [], asked))
    .pipe(
      Effect.flatMap(Stream.runCollect),
      Effect.provideService(CurrentMember, person.member)
    );

// A chat the person wrote in: one never written in is in no history.
const writtenChat = (person: Person, text = "Hello") =>
  newChat(person).pipe(Effect.tap((chat) => send(person, chat.id, text)));

const chatsOf = (person: Person) =>
  desk.use((agent) => agent.chats(person.actor, Option.none()));

// Someone else in the same workspace.
const colleagueOf = (person: Person) =>
  personIn(
    person.workspaceId,
    UserIdSchema.make("6c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f")
  );

const chatCount = (person: Person) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql<{
        readonly count: string;
      }>`SELECT count(*) AS count FROM agent.chats WHERE workspace_id = ${person.workspaceId}`
  ).pipe(Effect.map((rows) => Number(rows[0]?.count ?? 0)));

layer(DatabaseTest, { timeout: "60 seconds" })(
  "a person's chats with the agent",
  (it) => {
    it.effect("lists, renames, stars, rates and deletes their own chats", () =>
      Effect.gen(function* own() {
        const person = yield* freshPerson;
        const first = yield* writtenChat(person);
        const second = yield* newChat(person);
        const unwritten = yield* newChat(person);

        yield* FakeAgentModel.use((model) => model.script([says("Hello.")]));

        const events = yield* send(person, second.id, "Hi");
        const started = events.find((event) => event._tag === "started");

        const page = yield* chatsOf(person);

        // The latest first: the one just written in. A chat nobody wrote
        // in is in no history.
        assert.notInclude(
          page.chats.map(({ id }) => id),
          unwritten.id
        );
        assert.deepStrictEqual(
          page.chats.map(({ id }) => id),
          [second.id, first.id]
        );

        const renamed = yield* desk.use((agent) =>
          agent.updateChat(person.actor, first.id, {
            starred: true,
            title: "  Launch plan \n",
          })
        );

        assert.deepStrictEqual(renamed.title, Option.some("Launch plan"));
        assert.isTrue(renamed.starred);

        yield* desk.use((agent) =>
          agent.rate(
            person.actor,
            second.id,
            started?._tag === "started" ? started.messageId : "",
            Option.some("up")
          )
        );

        const rated = yield* desk.use((agent) =>
          agent.chat(person.actor, second.id)
        );

        assert.deepStrictEqual(
          rated.messages.map(({ rating }) => Option.getOrNull(rating)),
          [null, "up"]
        );

        // The person's own message takes no rating.
        const userMessage = rated.messages[0]?.id ?? "";

        const refused = yield* desk
          .use((agent) =>
            agent.rate(
              person.actor,
              second.id,
              userMessage,
              Option.some("down")
            )
          )
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "ChatNotFound");

        yield* desk.use((agent) => agent.deleteChat(person.actor, first.id));

        assert.deepStrictEqual(
          (yield* chatsOf(person)).chats.map(({ id }) => id),
          [second.id]
        );
      }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "answers another person's chat as none, whatever is asked of it",
      () =>
        Effect.gen(function* others() {
          const person = yield* freshPerson;
          const chat = yield* writtenChat(person);
          const colleague = colleagueOf(person);

          const refusals = yield* Effect.all([
            desk
              .use((agent) => agent.chat(colleague.actor, chat.id))
              .pipe(Effect.flip),
            desk
              .use((agent) =>
                agent.updateChat(colleague.actor, chat.id, { starred: true })
              )
              .pipe(Effect.flip),
            desk
              .use((agent) => agent.deleteChat(colleague.actor, chat.id))
              .pipe(Effect.flip),
            desk
              .use((agent) =>
                agent.send(colleague.actor, chat.id, "Hello", [], asked)
              )
              .pipe(Effect.flip),
            desk
              .use((agent) => agent.chat(person.actor, "not-a-chat"))
              .pipe(Effect.flip),
          ]);

          assert.deepStrictEqual(
            refusals.map(({ _tag }) => _tag),
            [
              "ChatNotFound",
              "ChatNotFound",
              "ChatNotFound",
              "ChatNotFound",
              "ChatNotFound",
            ]
          );
          assert.lengthOf((yield* chatsOf(colleague)).chats, 0);
          assert.lengthOf((yield* chatsOf(person)).chats, 1);
        }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "answers only a person in their own session, with assistant:use",
      () =>
        Effect.gen(function* personOnly() {
          const person = yield* freshPerson;
          const { userId, workspaceId } = person;
          const permissions = permissionsFor("editor");

          const actors = [
            // An OAuth client acting for them (an MCP client, the CLI).
            new Actor({
              permissions,
              subject: {
                _tag: "user",
                clientId: "synthetic-client",
                impersonatedBy: Option.none(),
                userId,
              },
              workspaceId,
            }),
            // Staff acting as them.
            new Actor({
              permissions,
              subject: {
                _tag: "user",
                impersonatedBy: Option.some(
                  UserIdSchema.make("7d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a")
                ),
                userId,
              },
              workspaceId,
            }),
            // An API key.
            new Actor({
              permissions,
              subject: { _tag: "apiKey", apiKeyId: "synthetic-key" },
              workspaceId,
            }),
          ];

          for (const actor of actors) {
            const refusal = yield* desk
              .use((agent) => agent.createChat(actor))
              .pipe(Effect.flip);

            assert.strictEqual(refusal._tag, "PersonRequired");
          }

          // A viewer has no assistant:use.
          const viewer = personIn(
            workspaceId,
            userId,
            permissionsFor("viewer")
          );

          const refusal = yield* desk
            .use((agent) => agent.availability(viewer.actor))
            .pipe(Effect.flip);

          assert.deepInclude(refusal, {
            _tag: "MissingPermission",
            permission: "assistant:use",
          });
        }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "deletes a chat 90 days after its last message, and keeps a newer one",
      () =>
        Effect.gen(function* retention() {
          const person = yield* freshPerson;
          const old = yield* writtenChat(person);
          const recent = yield* writtenChat(person);
          const unwrittenOld = yield* newChat(person);
          const unwrittenNew = yield* newChat(person);
          const sql = yield* SqlClient.SqlClient;
          const now = yield* DateTime.now;

          // Made two days ago, and never written in.
          yield* sql`UPDATE agent.chats SET updated_at = ${DateTime.toDateUtc(
            DateTime.subtract(now, { days: 2 })
          )} WHERE id = ${unwrittenOld.id}`;

          yield* sql`UPDATE agent.chats SET updated_at = ${DateTime.toDateUtc(
            DateTime.subtract(now, { days: 91 })
          )} WHERE id = ${old.id}`;
          yield* sql`UPDATE agent.chats SET updated_at = ${DateTime.toDateUtc(
            DateTime.subtract(now, { days: 89 })
          )} WHERE id = ${recent.id}`;

          const purged = yield* AgentRecords.use((records) => records.purge);

          assert.isAtLeast(purged, 2);
          assert.deepStrictEqual(
            (yield* chatsOf(person)).chats.map(({ id }) => id),
            [recent.id]
          );

          // A chat never written in goes a day after it was made.
          const left = yield* sql<{
            readonly id: string;
          }>`SELECT id FROM agent.chats WHERE workspace_id = ${person.workspaceId} ORDER BY id`;

          assert.deepStrictEqual(
            left.map(({ id }) => id),
            [recent.id, unwrittenNew.id]
          );
        }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "erases chats with the membership, the account and the workspace, and exports the person's",
      () =>
        Effect.gen(function* erasure() {
          const person = yield* freshPerson;
          const colleague = colleagueOf(person);

          yield* FakeAgentModel.use((model) =>
            model.script([says("Hello."), says("Hi.")])
          );

          const mine = yield* newChat(person);

          yield* send(person, mine.id, "Hello");

          const theirs = yield* writtenChat(colleague);

          const exported = yield* AgentRecords.use((records) =>
            records.exportUser(person.userId)
          );

          assert.deepStrictEqual(
            exported.map(({ chat, messages }) => [
              chat.id,
              messages.map(({ text }) => text),
            ]),
            [[mine.id, ["Hello", "Hello."]]]
          );

          yield* AgentRecords.use((records) =>
            records.eraseMember(person.workspaceId, person.userId)
          );

          assert.lengthOf((yield* chatsOf(person)).chats, 0);
          assert.deepStrictEqual(
            (yield* chatsOf(colleague)).chats.map(({ id }) => id),
            [theirs.id]
          );

          yield* AgentRecords.use((records) =>
            records.eraseUser(colleague.userId)
          );

          assert.strictEqual(yield* chatCount(person), 0);

          yield* newChat(person);
          yield* AgentRecords.use((records) =>
            records.eraseWorkspace(person.workspaceId)
          );

          assert.strictEqual(yield* chatCount(person), 0);
        }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "answers with the workspace's own provider, counting its day and none of Peal's meters",
      () =>
        Effect.gen(function* own() {
          const person = yield* freshPerson;

          const admin = personIn(
            person.workspaceId,
            person.userId,
            permissionsFor("admin")
          );

          yield* WritingAssistant.use((assistant) =>
            assistant.saveTextProvider(admin.actor, {
              apiKey: "synthetic-workspace-text-key",
              baseUrl: "https://images.example.com/v1/",
              kind: "openai-compatible",
              model: "synthetic-text-model",
            })
          );

          const status = yield* desk.use((agent) =>
            agent.availability(person.actor)
          );

          assert.deepStrictEqual(status, {
            available: true,
            reason: null,
            source: "workspace",
          });

          const chat = yield* newChat(person);

          yield* FakeAgentModel.use((model) =>
            model.script([calls("list_posts", {}), says("None.")])
          );
          yield* send(person, chat.id, "Any posts?");

          const sql = yield* SqlClient.SqlClient;

          const rows = yield* sql<{
            readonly requests: number;
          }>`SELECT requests FROM assistant.own_text_days WHERE workspace_id = ${person.workspaceId}`;

          assert.deepStrictEqual(
            rows.map(({ requests }) => requests),
            [2]
          );

          const { claims } = yield* FakeMetersLedger.use(Ref.get);

          assert.lengthOf(claims, 0);
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
      "keeps the person's words, the tools' answers and the model's out of logs and spans",
      () =>
        Effect.gen(function* privacy() {
          const person = yield* freshPerson;
          const chat = yield* newChat(person);
          const inMessage = "synthetic-message-marker-5e2f";
          const inAnswer = "synthetic-answer-marker-8a1c";
          const lines: string[] = [];
          const spans: Tracer.NativeSpan[] = [];

          const tracer = Tracer.make({
            span: (options) => {
              const span = new Tracer.NativeSpan(options);

              spans.push(span);

              return span;
            },
          });

          const logs = Logger.layer([
            Logger.make(({ cause, message }) => {
              lines.push(JSON.stringify(message), Cause.pretty(cause));
            }),
          ]);

          yield* FakeAgentModel.use((model) =>
            model.script([
              calls("create_draft", { content: { text: inMessage } }),
              says(inAnswer),
            ])
          );

          yield* send(person, chat.id, `Write ${inMessage}`).pipe(
            Effect.withSpan("test.run"),
            Effect.withTracer(tracer),
            Effect.provide(logs)
          );

          const recorded = [
            ...lines,
            ...spans.map((span) =>
              [
                span.name,
                JSON.stringify([...span.attributes]),
                JSON.stringify(span.events),
                span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
                  ? Cause.pretty(span.status.exit.cause)
                  : "",
              ].join("\n")
            ),
          ].join("\n");

          assert.include(recorded, "The agent ran");
          assert.notInclude(recorded, inMessage);
          assert.notInclude(recorded, inAnswer);
          assert.notInclude(recorded, "spring launch");
        }).pipe(Effect.provide(agentTest()))
    );
  }
);
