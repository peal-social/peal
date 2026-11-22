// The agent's endpoints through the whole server, without a model (the
// test server has no PEAL_AI_PROVIDER): served beside the API, a person's
// alone, refused to an API key, and a member's chats gone with their
// membership, whether they leave or are removed.
import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import {
  apiKeyOf,
  IntegrationLive,
  signedUp,
  TestApp,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";
import type { Person } from "#test/workspace/integration/harness.ts";

const ChatSchema = Schema.Struct({ id: Schema.String });

const decodeChat = Schema.decodeUnknownEffect(ChatSchema);

const agentOf = (workspaceId: string) => `/api/workspaces/${workspaceId}/agent`;

const newChat = (person: Person, workspaceId: string) =>
  TestApp.use((app) =>
    app.request(`${agentOf(workspaceId)}/chats`, {
      headers: { cookie: person.cookies },
      method: "POST",
    })
  ).pipe(Effect.flatMap((reply) => decodeChat(reply.body)));

const chatsIn = (workspaceId: string, userId: string) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql<{
        readonly id: string;
      }>`SELECT id FROM agent.chats WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  );

// Someone else, who signs up and is made a member of the workspace.
const memberOf = Effect.fn("memberOf")(function* memberOf(
  workspaceId: string,
  label: string
) {
  const person = yield* signedUp(label);
  const sql = yield* SqlClient.SqlClient;

  yield* sql`INSERT INTO auth.member (organization_id, user_id, role, created_at) VALUES (${workspaceId}, ${person.id}, 'editor', now())`;

  return person;
});

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the agent's endpoints",
  (it) => {
    it.effect(
      "keeps a person's chats, tells them the agent is off, and refuses an API key",
      () =>
        Effect.gen(function* endpoints() {
          const owner = yield* signedUp("agent-owner");
          const workspaceId = yield* workspaceOf(owner, "Agent test");
          const app = yield* TestApp;
          const asOwner = { cookie: owner.cookies };

          const status = yield* app.request(agentOf(workspaceId), {
            headers: asOwner,
          });

          assert.strictEqual(status.status, 200);
          assert.deepStrictEqual(status.body, {
            available: false,
            reason: "noModel",
            source: null,
          });

          const chat = yield* newChat(owner, workspaceId);

          const renamed = yield* app.request(
            `${agentOf(workspaceId)}/chats/${chat.id}`,
            {
              body: { starred: true, title: "Launch" },
              headers: asOwner,
              method: "PATCH",
            }
          );

          assert.strictEqual(renamed.status, 200);
          assert.deepInclude(renamed.body, { starred: true, title: "Launch" });

          const listed = yield* app.request(`${agentOf(workspaceId)}/chats`, {
            headers: asOwner,
          });

          assert.deepInclude(listed.body, { nextCursor: null });

          // Without a model, a message is refused before anything streams.
          const sent = yield* app.request(
            `${agentOf(workspaceId)}/chats/${chat.id}/messages`,
            { body: { text: "Hello" }, headers: asOwner }
          );

          assert.strictEqual(sent.status, 503);
          assert.deepInclude(sent.body, { code: "assistant_unavailable" });

          // Someone else's chat, or one that never was, is not found.
          const missing = yield* app.request(
            `${agentOf(workspaceId)}/chats/0190f0e0-0000-7000-8000-00000000ffff`,
            { headers: asOwner }
          );

          assert.strictEqual(missing.status, 404);
          assert.deepInclude(missing.body, { code: "agent_chat_not_found" });

          // An API key is nobody: only a person in their own session.
          const { key } = yield* apiKeyOf(owner, workspaceId, [
            "assistant:use",
            "post:read",
          ]);

          const byKey = yield* app.request(`${agentOf(workspaceId)}/chats`, {
            headers: { authorization: `Bearer ${key}` },
          });

          assert.strictEqual(byKey.status, 403);
          assert.deepInclude(byKey.body, { reason: "personRequired" });

          const deleted = yield* app.request(
            `${agentOf(workspaceId)}/chats/${chat.id}`,
            { headers: asOwner, method: "DELETE" }
          );

          assert.strictEqual(deleted.status, 204);
          assert.lengthOf(yield* chatsIn(workspaceId, owner.id), 0);
        })
    );

    it.effect(
      "erases a member's chats when they leave, and when they are removed",
      () =>
        Effect.gen(function* membership() {
          const owner = yield* signedUp("agent-team-owner");
          const workspaceId = yield* workspaceOf(owner, "Agent team");
          const app = yield* TestApp;

          const leaving = yield* memberOf(workspaceId, "agent-leaver");
          const removed = yield* memberOf(workspaceId, "agent-removed");

          yield* newChat(leaving, workspaceId);
          yield* newChat(removed, workspaceId);
          yield* newChat(owner, workspaceId);

          const left = yield* app.request("/api/auth/organization/leave", {
            body: { organizationId: workspaceId },
            headers: { cookie: leaving.cookies },
          });

          assert.strictEqual(left.status, 200, JSON.stringify(left.body));
          assert.lengthOf(yield* chatsIn(workspaceId, leaving.id), 0);

          const gone = yield* app.request(
            "/api/auth/organization/remove-member",
            {
              body: {
                memberIdOrEmail: removed.email,
                organizationId: workspaceId,
              },
              headers: { cookie: owner.cookies },
            }
          );

          assert.strictEqual(gone.status, 200, JSON.stringify(gone.body));
          assert.lengthOf(yield* chatsIn(workspaceId, removed.id), 0);

          // The owner's stay.
          assert.lengthOf(yield* chatsIn(workspaceId, owner.id), 1);
        })
    );
  }
);
