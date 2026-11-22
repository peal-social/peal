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

        const status = yield* client.agent.status({ params });

        assert.deepStrictEqual(status, {
          available: true,
          reason: null,
          source: "server",
        });
      }).pipe(Effect.provide(agentTest()))
    );
  }
);
