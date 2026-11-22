import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { AgentApi } from "peal-contract/agent";

import { AgentHandlers } from "#app/agent/handlers.ts";
import {
  agentTest,
  calls,
  DatabaseTest,
  FakeAgentModel,
  freshPerson,
  postId,
  says,
} from "#test/agent/support.ts";
import type { Person } from "#test/agent/support.ts";
import { securityTest } from "#workspace/api/security.ts";

// The agent's endpoints on its use cases, the fake model and tools and
// Postgres: a run's events as Server-Sent Events, as the web app reads
// them. Each request acts as the person, as WorkspaceAccess would.
const clientAs = (person: Person) =>
  HttpApiTest.groups(AgentApi, ["agent"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        AgentHandlers.pipe(Layer.provideMerge(securityTest(person.member))),
        HttpServer.layerServices
      )
    )
  );

layer(DatabaseTest, { timeout: "60 seconds" })(
  "the agent's endpoints",
  (it) => {
    it.effect(
      "streams a run's events, then answers an approval in an answer of its own",
      () =>
        Effect.gen(function* streams() {
          const person = yield* freshPerson;
          const client = yield* clientAs(person);
          const params = { workspaceId: person.workspaceId };

          const chat = yield* client.agent.createChat({ params });

          yield* FakeAgentModel.use((model) =>
            model.script([
              calls(
                "schedule_post",
                { at: "2026-12-01T08:00:00.000Z", postId },
                "call-http"
              ),
            ])
          );

          const events = yield* client.agent
            .send({
              params: { ...params, chatId: chat.id },
              payload: { text: "Schedule it", timeZone: "Europe/Paris" },
            })
            .pipe(Effect.flatMap(Stream.runCollect));

          assert.deepStrictEqual(
            events.map(({ _tag }) => _tag),
            ["started", "approval", "title", "finished"]
          );

          yield* FakeAgentModel.use((model) => model.script([says("Done.")]));

          const answered = yield* client.agent
            .answer({
              params: { ...params, callId: "call-http", chatId: chat.id },
              payload: { approved: true },
            })
            .pipe(Effect.flatMap(Stream.runCollect));

          assert.deepInclude(answered.at(-1), {
            _tag: "finished",
            outcome: "answered",
          });

          const detail = yield* client.agent.chat({
            params: { ...params, chatId: chat.id },
          });

          assert.deepStrictEqual(
            detail.messages.map(({ approvals, outcome, role }) => [
              role,
              outcome,
              approvals.map(({ state }) => state),
            ]),
            [
              ["user", null, []],
              ["assistant", "awaitingApproval", ["approved"]],
              ["assistant", "answered", []],
            ]
          );
          assert.strictEqual(detail.chat.title, "A chat");

          // A change answered once answers the contract's refusal.
          const again = yield* client.agent
            .answer({
              params: { ...params, callId: "call-http", chatId: chat.id },
              payload: { approved: true },
            })
            .pipe(Effect.flip);

          assert.strictEqual(again._tag, "AgentApprovalNotPending");
        }).pipe(Effect.provide(agentTest()))
    );

    it.effect("answers the contract's refusals before anything streams", () =>
      Effect.gen(function* refusals() {
        const person = yield* freshPerson;
        const client = yield* clientAs(person);
        const params = { workspaceId: person.workspaceId };

        const missing = yield* client.agent
          .send({
            params: {
              ...params,
              chatId: "0190f0e0-0000-7000-8000-00000000ffff",
            },
            payload: { text: "Hello" },
          })
          .pipe(Effect.flip);

        assert.strictEqual(missing._tag, "AgentChatNotFound");

        const chat = yield* client.agent.createChat({ params });

        const blank = yield* client.agent
          .send({
            params: { ...params, chatId: chat.id },
            payload: { text: " " },
          })
          .pipe(Effect.flip);

        assert.deepInclude(blank, {
          _tag: "AssistantInputRejected",
          reason: "empty",
        });

        // A skill the person may not use: 404, before anything streams.
        const unknownSkill = yield* client.agent
          .send({
            params: { ...params, chatId: chat.id },
            payload: {
              skillIds: ["0190f0e0-0000-7000-8000-00000000eeee"],
              text: "Plan it",
            },
          })
          .pipe(Effect.flip);

        assert.deepInclude(unknownSkill, {
          _tag: "AgentSkillNotFound",
          skillId: "0190f0e0-0000-7000-8000-00000000eeee",
        });

        const kept = yield* client.agent.chat({
          params: { ...params, chatId: chat.id },
        });

        assert.lengthOf(kept.messages, 0);

        const status = yield* client.agent.status({ params });

        assert.deepStrictEqual(status, {
          available: true,
          reason: null,
          source: "server",
        });
      }).pipe(Effect.provide(agentTest()))
    );

    it.effect(
      "makes, lists, changes and deletes skills, with the contract's refusals, and keeps a picked one on the message",
      () =>
        Effect.gen(function* skills() {
          const person = yield* freshPerson;
          const client = yield* clientAs(person);
          const params = { workspaceId: person.workspaceId };

          const made = yield* client.agent.createSkill({
            params,
            payload: {
              instructions: "List next week's drafts by day.",
              name: "Weekly plan",
              scope: "personal",
            },
          });

          assert.deepInclude(made, {
            editable: true,
            name: "Weekly plan",
            scope: "personal",
          });

          const taken = yield* client.agent
            .createSkill({
              params,
              payload: {
                instructions: "Again.",
                name: "WEEKLY PLAN",
                scope: "personal",
              },
            })
            .pipe(Effect.flip);

          assert.deepInclude(taken, {
            _tag: "AgentSkillRefused",
            reason: "nameTaken",
          });

          // An editor makes no workspace skill, nor shares their own: every
          // member's agent is offered it.
          for (const refused of [
            client.agent.createSkill({
              params,
              payload: {
                instructions: "Follow me.",
                name: "Team voice",
                scope: "workspace",
              },
            }),
            client.agent.updateSkill({
              params: { ...params, skillId: made.id },
              payload: { scope: "workspace" },
            }),
          ]) {
            assert.strictEqual(
              (yield* refused.pipe(Effect.flip))._tag,
              "Forbidden"
            );
          }

          const listed = yield* client.agent.skills({ params });

          assert.deepStrictEqual(
            listed.skills.map(({ id, name }) => [id, name]),
            [[made.id, "Weekly plan"]]
          );

          const chat = yield* client.agent.createChat({ params });

          yield* FakeAgentModel.use((model) =>
            model.script([says("Planned.")])
          );
          yield* client.agent
            .send({
              params: { ...params, chatId: chat.id },
              payload: { skillIds: [made.id], text: "Plan it" },
            })
            .pipe(Effect.flatMap(Stream.runCollect));

          yield* client.agent.deleteSkill({
            params: { ...params, skillId: made.id },
          });

          const gone = yield* client.agent
            .updateSkill({
              params: { ...params, skillId: made.id },
              payload: { name: "Week ahead" },
            })
            .pipe(Effect.flip);

          assert.deepInclude(gone, {
            _tag: "AgentSkillNotFound",
            skillId: made.id,
          });

          // The message still names the skill it picked.
          const detail = yield* client.agent.chat({
            params: { ...params, chatId: chat.id },
          });

          assert.deepStrictEqual(
            detail.messages.map(({ role, skills: picked }) => [role, picked]),
            [
              ["user", [{ id: made.id, name: "Weekly plan" }]],
              ["assistant", []],
            ]
          );
        }).pipe(Effect.provide(agentTest()))
    );
  }
);
