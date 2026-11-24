import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import {
  ActivityPageSchema,
  ApiKeySchema,
  WorkspaceMemberSchema,
  forWorkspace,
} from "peal-contract";

import {
  apiKeyOf,
  bodyOf,
  IntegrationLive,
  password,
  signedUp,
  TestApp,
  workspaceOf,
} from "./harness.ts";
import type { Person } from "./harness.ts";

// A workspace's API keys follow the members who made them: removed,
// leaving or closing their account, their keys stop working; given a
// lower role, the keys that role could not give stop working. Keys made
// before Peal recorded makers, and other members' keys, stay.

const KeysSchema = Schema.toCodecJson(Schema.Array(ApiKeySchema));

const MembersSchema = Schema.toCodecJson(Schema.Array(WorkspaceMemberSchema));

const PageSchema = Schema.toCodecJson(ActivityPageSchema);

const BetterAuthMembersSchema = Schema.Struct({
  members: Schema.Array(
    Schema.Struct({ id: Schema.String, userId: Schema.String })
  ),
});

const asPerson = (person: Person) => ({ cookie: person.cookies });

/** Invites `guest` to the workspace with `role`; they accept. */
const join = Effect.fn("join")(function* join(
  owner: Person,
  workspaceId: string,
  guest: Person,
  role: string
) {
  const app = yield* TestApp;

  const invited = yield* app.request("/api/auth/organization/invite-member", {
    body: { email: guest.email, organizationId: workspaceId, role },
    headers: asPerson(owner),
  });

  const accepted = yield* app.request(
    "/api/auth/organization/accept-invitation",
    {
      body: {
        invitationId: (yield* bodyOf(
          Schema.Struct({ id: Schema.String }),
          invited
        )).id,
      },
      headers: asPerson(guest),
    }
  );

  assert.strictEqual(accepted.status, 200);
});

// Whether the key still authenticates.
const works = Effect.fn("works")(function* works(key: string) {
  const app = yield* TestApp;

  const reply = yield* app.request("/api/v1/credential", {
    headers: { authorization: `Bearer ${key}` },
  });

  return reply.status === 200;
});

// Better Auth's id of the user's membership, which its routes take.
const memberIdOf = Effect.fn("memberIdOf")(function* memberIdOf(
  owner: Person,
  workspaceId: string,
  userId: string
) {
  const app = yield* TestApp;

  const listed = yield* bodyOf(
    BetterAuthMembersSchema,
    yield* app.request(
      `/api/auth/organization/list-members?organizationId=${workspaceId}`,
      { headers: asPerson(owner) }
    )
  );

  const found = listed.members.find((member) => member.userId === userId);

  assert.isDefined(found);

  return found?.id ?? "";
});

// A key as made before Peal recorded who made it.
const unrecorded = Effect.fn("unrecorded")(function* unrecorded(
  apiKeyId: string
) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`UPDATE auth.apikey SET metadata = NULL WHERE id = ${apiKeyId}`;
});

const keysOf = Effect.fn("keysOf")(function* keysOf(
  person: Person,
  workspaceId: string
) {
  const app = yield* TestApp;

  return yield* bodyOf(
    KeysSchema,
    yield* app.request(`/api/v1/api-keys`, {
      headers: { ...asPerson(person), ...forWorkspace(workspaceId) },
    })
  );
});

const revocationsIn = Effect.fn("revocationsIn")(function* revocationsIn(
  owner: Person,
  workspaceId: string
) {
  const app = yield* TestApp;

  const page = yield* bodyOf(
    PageSchema,
    yield* app.request(`/api/v1/activity?operation=apiKeys.revoke`, {
      headers: { ...asPerson(owner), ...forWorkspace(workspaceId) },
    })
  );

  return page.items.map(({ actor, objectIds }) => ({ actor, objectIds }));
});

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the API keys of a member whose standing changes",
  (it) => {
    it.effect(
      "list each key with the member who made it, and nobody for a key made before",
      () =>
        Effect.gen(function* lists() {
          const owner = yield* signedUp("keys-lister");
          const admin = yield* signedUp("keys-maker");
          const workspaceId = yield* workspaceOf(owner, "Makers");

          yield* join(owner, workspaceId, admin, "admin");

          const ownKey = yield* apiKeyOf(owner, workspaceId, ["post:read"]);
          const adminKey = yield* apiKeyOf(admin, workspaceId, ["post:read"]);
          const older = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

          assert.deepStrictEqual(adminKey.apiKey.createdBy, {
            id: admin.id,
            name: "keys-maker",
          });

          yield* unrecorded(older.apiKey.id);

          const listed = yield* keysOf(owner, workspaceId);

          assert.deepStrictEqual(
            listed.map(({ createdBy, id }) => [id, createdBy?.id ?? null]),
            [
              [ownKey.apiKey.id, owner.id],
              [adminKey.apiKey.id, admin.id],
              [older.apiKey.id, null],
            ]
          );
        })
    );

    it.effect(
      "revoke a removed member's keys, record it, tell the owner beforehand, and leave the others' and the older keys",
      () =>
        Effect.gen(function* removal() {
          const app = yield* TestApp;
          const owner = yield* signedUp("removing-owner");
          const admin = yield* signedUp("removed-admin");
          const colleague = yield* signedUp("staying-admin");
          const editor = yield* signedUp("staying-editor");
          const workspaceId = yield* workspaceOf(owner, "Removal");

          yield* join(owner, workspaceId, admin, "admin");
          yield* join(owner, workspaceId, colleague, "admin");
          yield* join(owner, workspaceId, editor, "editor");

          const billing = yield* apiKeyOf(admin, workspaceId, [
            "billing:manage",
          ]);

          const reader = yield* apiKeyOf(admin, workspaceId, ["post:read"]);
          const older = yield* apiKeyOf(admin, workspaceId, ["post:read"]);

          const colleagueKey = yield* apiKeyOf(colleague, workspaceId, [
            "post:read",
          ]);

          const ownerKey = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

          yield* unrecorded(older.apiKey.id);

          // The owner reads, before confirming, what removing the admin
          // would revoke: the two keys they made that are recorded.
          const members = yield* bodyOf(
            MembersSchema,
            yield* app.request(`/api/v1/members`, {
              headers: { ...asPerson(owner), ...forWorkspace(workspaceId) },
            })
          );

          const atStake = members.find(({ userId }) => userId === admin.id);

          assert.deepStrictEqual(atStake?.apiKeysAtStake, {
            removal: 2,
            roles: { admin: 0, contributor: 1, editor: 1, owner: 0, viewer: 1 },
          });

          // An editor, who may not manage members, reads none of it.
          const byEditor = yield* bodyOf(
            MembersSchema,
            yield* app.request(`/api/v1/members`, {
              headers: { ...asPerson(editor), ...forWorkspace(workspaceId) },
            })
          );

          assert.isTrue(
            byEditor.every((member) => member.apiKeysAtStake === undefined)
          );

          const removed = yield* app.request(
            "/api/auth/organization/remove-member",
            {
              body: {
                memberIdOrEmail: admin.email,
                organizationId: workspaceId,
              },
              headers: asPerson(owner),
            }
          );

          assert.strictEqual(removed.status, 200);
          assert.isFalse(yield* works(billing.key));
          assert.isFalse(yield* works(reader.key));
          assert.isTrue(yield* works(older.key));
          assert.isTrue(yield* works(colleagueKey.key));
          assert.isTrue(yield* works(ownerKey.key));

          // Each revoked key is in the log, as the owner's doing.
          const revocations = yield* revocationsIn(owner, workspaceId);

          assert.sameDeepMembers(
            revocations.map(({ objectIds }) => objectIds["apiKeyId"]),
            [billing.apiKey.id, reader.apiKey.id]
          );
          assert.isTrue(
            revocations.every(
              ({ actor }) => actor._tag === "user" && actor.userId === owner.id
            )
          );
        })
    );

    it.effect(
      "revoke a demoted member's keys the new role could not give, and keep those within it",
      () =>
        Effect.gen(function* demotion() {
          const app = yield* TestApp;
          const owner = yield* signedUp("demoting-owner");
          const admin = yield* signedUp("demoted-admin");
          const colleague = yield* signedUp("other-admin");
          const workspaceId = yield* workspaceOf(owner, "Demotion");

          yield* join(owner, workspaceId, admin, "admin");
          yield* join(owner, workspaceId, colleague, "admin");

          const billing = yield* apiKeyOf(admin, workspaceId, [
            "billing:manage",
            "post:read",
          ]);

          const publishing = yield* apiKeyOf(admin, workspaceId, [
            "post:publish",
            "post:read",
          ]);

          const older = yield* apiKeyOf(admin, workspaceId, ["webhook:manage"]);

          const theirs = yield* apiKeyOf(colleague, workspaceId, [
            "billing:manage",
          ]);

          yield* unrecorded(older.apiKey.id);

          const changed = yield* app.request(
            "/api/auth/organization/update-member-role",
            {
              body: {
                memberId: yield* memberIdOf(owner, workspaceId, admin.id),
                organizationId: workspaceId,
                role: "editor",
              },
              headers: asPerson(owner),
            }
          );

          assert.strictEqual(changed.status, 200);
          assert.isFalse(yield* works(billing.key));
          assert.isTrue(yield* works(publishing.key));
          assert.isTrue(yield* works(older.key));
          assert.isTrue(yield* works(theirs.key));

          assert.deepStrictEqual(
            (yield* revocationsIn(owner, workspaceId)).map(
              ({ objectIds }) => objectIds["apiKeyId"]
            ),
            [billing.apiKey.id]
          );

          // Raised again, nothing more goes, and nothing comes back.
          const raised = yield* app.request(
            "/api/auth/organization/update-member-role",
            {
              body: {
                memberId: yield* memberIdOf(owner, workspaceId, admin.id),
                organizationId: workspaceId,
                role: "admin",
              },
              headers: asPerson(owner),
            }
          );

          assert.strictEqual(raised.status, 200);
          assert.isTrue(yield* works(publishing.key));
          assert.isFalse(yield* works(billing.key));
        })
    );

    it.effect(
      "revoke the keys of a member who leaves, and of one who closes their account",
      () =>
        Effect.gen(function* leaving() {
          const app = yield* TestApp;
          const owner = yield* signedUp("staying-owner");
          const leaver = yield* signedUp("leaving-admin");
          const closer = yield* signedUp("closing-admin");
          const workspaceId = yield* workspaceOf(owner, "Leaving");

          yield* join(owner, workspaceId, leaver, "admin");
          yield* join(owner, workspaceId, closer, "admin");

          const leaverKey = yield* apiKeyOf(leaver, workspaceId, ["post:read"]);
          const closerKey = yield* apiKeyOf(closer, workspaceId, ["post:read"]);
          const ownerKey = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

          const left = yield* app.request("/api/auth/organization/leave", {
            body: { organizationId: workspaceId },
            headers: asPerson(leaver),
          });

          assert.strictEqual(left.status, 200);
          assert.isFalse(yield* works(leaverKey.key));
          assert.isTrue(yield* works(closerKey.key));

          assert.deepStrictEqual(yield* revocationsIn(owner, workspaceId), [
            {
              actor: { _tag: "user", userId: leaver.id },
              objectIds: { apiKeyId: leaverKey.apiKey.id },
            },
          ]);

          const closed = yield* app.request("/api/me", {
            body: { password },
            headers: asPerson(closer),
            method: "DELETE",
          });

          assert.strictEqual(closed.status, 204);
          assert.isFalse(yield* works(closerKey.key));
          assert.isTrue(yield* works(ownerKey.key));
        })
    );

    it.effect(
      "refuse, when it is used, a key past its maker's standing however it got there, and keep the others",
      () =>
        Effect.gen(function* whenUsed() {
          const sql = yield* SqlClient.SqlClient;
          const owner = yield* signedUp("checking-owner");
          const admin = yield* signedUp("slipping-admin");
          const gone = yield* signedUp("slipped-admin");
          const workspaceId = yield* workspaceOf(owner, "Checked");

          yield* join(owner, workspaceId, admin, "admin");
          yield* join(owner, workspaceId, gone, "admin");

          const billing = yield* apiKeyOf(admin, workspaceId, [
            "billing:manage",
          ]);

          const reader = yield* apiKeyOf(admin, workspaceId, ["post:read"]);
          const goneKey = yield* apiKeyOf(gone, workspaceId, ["post:read"]);
          const older = yield* apiKeyOf(gone, workspaceId, ["post:read"]);
          const ownerKey = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

          yield* unrecorded(older.apiKey.id);

          // As a key made while its maker's standing changed would find
          // it: the change written past every hook.
          yield* sql`UPDATE auth.member SET role = 'editor' WHERE organization_id = ${workspaceId} AND user_id = ${admin.id}`;
          yield* sql`DELETE FROM auth.member WHERE organization_id = ${workspaceId} AND user_id = ${gone.id}`;

          assert.isFalse(yield* works(billing.key));
          assert.isFalse(yield* works(goneKey.key));
          assert.isTrue(yield* works(reader.key));
          assert.isTrue(yield* works(older.key));
          assert.isTrue(yield* works(ownerKey.key));

          // Refused, they are revoked too.
          const left =
            yield* sql`SELECT id FROM auth.apikey WHERE reference_id = ${workspaceId} ORDER BY id`;

          assert.sameMembers(
            left.map((row) => String(row["id"])),
            [reader.apiKey.id, older.apiKey.id, ownerKey.apiKey.id]
          );
        })
    );

    it.effect(
      "revoke a leaving member's keys only once the guards before let the leave through",
      () =>
        Effect.gen(function* lockedOut() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const owner = yield* signedUp("requiring-owner");
          const leaver = yield* signedUp("locked-out-admin");
          const workspaceId = yield* workspaceOf(owner, "Required");

          yield* join(owner, workspaceId, leaver, "admin");

          const leaverKey = yield* apiKeyOf(leaver, workspaceId, ["post:read"]);

          // The workspace now requires two-step verification, which the
          // admin's account does not have: leaving stays open to them.
          yield* sql`INSERT INTO workspace.security_policies (workspace_id, two_step_required, updated_at) VALUES (${workspaceId}, true, now())`;

          const left = yield* app.request("/api/auth/organization/leave", {
            body: { organizationId: workspaceId },
            headers: asPerson(leaver),
          });

          assert.strictEqual(left.status, 200);
          assert.isFalse(yield* works(leaverKey.key));
        })
    );

    it.effect("keep every key of the only owner, whom leaving is refused", () =>
      Effect.gen(function* onlyOwner() {
        const app = yield* TestApp;
        const owner = yield* signedUp("only-owner");
        const workspaceId = yield* workspaceOf(owner, "Alone");
        const ownerKey = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

        const left = yield* app.request("/api/auth/organization/leave", {
          body: { organizationId: workspaceId },
          headers: asPerson(owner),
        });

        assert.notStrictEqual(left.status, 200);
        assert.isTrue(yield* works(ownerKey.key));
      })
    );
  }
);
