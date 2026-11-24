import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import {
  ActivityPageSchema,
  PartnerKeySchema,
  WorkspaceMemberSchema,
  forWorkspace,
} from "peal-contract";

import {
  bodyOf,
  MigratedSqlLive,
  password,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
} from "./harness.ts";
import type { Person } from "./harness.ts";
import { bearer, keyOf, partnerOf } from "./partner-support.ts";

// A partner's keys follow the members of its home workspace who made them,
// as the workspace's API keys do: once the maker leaves, is removed,
// closes their account or may no longer manage the partner account, their
// keys stop working. Keys with no recorded maker stay.

const SelfServiceLive = Layer.mergeAll(
  TestApp.layerWith({
    ...unconfirmedEmails,
    PEAL_PARTNER_SELF_SERVICE: "true",
  }),
  MigratedSqlLive
);

const KeysSchema = Schema.toCodecJson(Schema.Array(PartnerKeySchema));

const MembersSchema = Schema.toCodecJson(Schema.Array(WorkspaceMemberSchema));

const PageSchema = Schema.toCodecJson(ActivityPageSchema);

const MemberIdsSchema = Schema.Struct({
  members: Schema.Array(
    Schema.Struct({ id: Schema.String, userId: Schema.String })
  ),
});

const asPerson = (person: Person) => ({ cookie: person.cookies });

// Someone who joins the home workspace with `role`: written directly, as
// this server does not send invitations' emails.
const seated = Effect.fn("seated")(function* seated(
  home: string,
  label: string,
  role: string
) {
  const sql = yield* SqlClient.SqlClient;
  const person = yield* signedUpUnconfirmed(label);

  yield* sql`INSERT INTO auth.member (organization_id, user_id, role, created_at) VALUES (${home}, ${person.id}, ${role}, now())`;

  return person;
});

// Whether the partner key still authenticates.
const works = Effect.fn("works")(function* works(key: string) {
  const app = yield* TestApp;

  return (
    (yield* app.request("/api/v1/partner", { headers: bearer(key) })).status ===
    200
  );
});

const memberIdOf = Effect.fn("memberIdOf")(function* memberIdOf(
  owner: Person,
  home: string,
  userId: string
) {
  const app = yield* TestApp;

  const listed = yield* bodyOf(
    MemberIdsSchema,
    yield* app.request(
      `/api/auth/organization/list-members?organizationId=${home}`,
      { headers: asPerson(owner) }
    )
  );

  return listed.members.find((member) => member.userId === userId)?.id ?? "";
});

layer(SelfServiceLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the partner keys of a member whose standing changes",
  (it) => {
    it.effect(
      "list each key with its maker, count it before a removal, and revoke a removed admin's keys alone",
      () =>
        Effect.gen(function* removal() {
          const app = yield* TestApp;
          const { home, owner } = yield* partnerOf("partner-remover");
          const admin = yield* seated(home, "partner-removed", "admin");
          const ownerKey = yield* keyOf(owner, home);
          const adminKey = yield* keyOf(admin, home);

          const listed = yield* bodyOf(
            KeysSchema,
            yield* app.request(`/api/v1/partner-account/keys`, {
              headers: { ...asPerson(owner), ...forWorkspace(home) },
            })
          );

          assert.sameDeepMembers(
            listed.map(({ createdBy, id }) => [id, createdBy?.id ?? null]),
            [
              [ownerKey.partnerKey.id, owner.id],
              [adminKey.partnerKey.id, admin.id],
            ]
          );

          const members = yield* bodyOf(
            MembersSchema,
            yield* app.request(`/api/v1/members`, {
              headers: { ...asPerson(owner), ...forWorkspace(home) },
            })
          );

          assert.deepStrictEqual(
            members.find(({ userId }) => userId === admin.id)?.apiKeysAtStake,
            {
              removal: 1,
              roles: {
                admin: 0,
                contributor: 1,
                editor: 1,
                owner: 0,
                viewer: 1,
              },
            }
          );

          const removed = yield* app.request(
            "/api/auth/organization/remove-member",
            {
              body: { memberIdOrEmail: admin.email, organizationId: home },
              headers: asPerson(owner),
            }
          );

          assert.strictEqual(removed.status, 200);
          assert.isFalse(yield* works(adminKey.key));
          assert.isTrue(yield* works(ownerKey.key));

          const page = yield* bodyOf(
            PageSchema,
            yield* app.request(
              `/api/v1/activity?operation=partnerAccount.revokeKey`,
              { headers: { ...asPerson(owner), ...forWorkspace(home) } }
            )
          );

          assert.deepStrictEqual(
            page.items.map(({ objectIds }) => objectIds),
            [{ partnerKeyId: adminKey.partnerKey.id }]
          );
        })
    );

    it.effect(
      "revoke the keys of an admin given a role that manages no partner account, and of one who leaves",
      () =>
        Effect.gen(function* demotion() {
          const app = yield* TestApp;
          const { home, owner } = yield* partnerOf("partner-demoter");
          const demoted = yield* seated(home, "partner-demoted", "admin");
          const leaver = yield* seated(home, "partner-leaver", "admin");
          const demotedKey = yield* keyOf(demoted, home);
          const leaverKey = yield* keyOf(leaver, home);

          const changed = yield* app.request(
            "/api/auth/organization/update-member-role",
            {
              body: {
                memberId: yield* memberIdOf(owner, home, demoted.id),
                organizationId: home,
                role: "editor",
              },
              headers: asPerson(owner),
            }
          );

          assert.strictEqual(changed.status, 200);
          assert.isFalse(yield* works(demotedKey.key));
          assert.isTrue(yield* works(leaverKey.key));

          const left = yield* app.request("/api/auth/organization/leave", {
            body: { organizationId: home },
            headers: asPerson(leaver),
          });

          assert.strictEqual(left.status, 200);
          assert.isFalse(yield* works(leaverKey.key));
        })
    );

    it.effect("revoke the keys of an admin who closes their account", () =>
      Effect.gen(function* closure() {
        const app = yield* TestApp;
        const { home, owner } = yield* partnerOf("partner-stayer");
        const closer = yield* seated(home, "partner-closer", "admin");
        const closerKey = yield* keyOf(closer, home);
        const ownerKey = yield* keyOf(owner, home);

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
      "refuse, when it is used, a key past its maker's standing however it got there, and keep a key with no maker",
      () =>
        Effect.gen(function* whenUsed() {
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("partner-checker");
          const gone = yield* seated(home, "partner-gone", "admin");
          const lowered = yield* seated(home, "partner-lowered", "admin");
          const goneKey = yield* keyOf(gone, home);
          const loweredKey = yield* keyOf(lowered, home);
          const older = yield* keyOf(gone, home);
          const ownerKey = yield* keyOf(owner, home);

          yield* sql`UPDATE workspace.partner_keys SET created_by = NULL WHERE id = ${older.partnerKey.id}`;

          // As a key made while its maker's standing changed would find
          // it: the change written past every hook.
          yield* sql`DELETE FROM auth.member WHERE organization_id = ${home} AND user_id = ${gone.id}`;
          yield* sql`UPDATE auth.member SET role = 'viewer' WHERE organization_id = ${home} AND user_id = ${lowered.id}`;

          assert.isFalse(yield* works(goneKey.key));
          assert.isFalse(yield* works(loweredKey.key));
          assert.isTrue(yield* works(older.key));
          assert.isTrue(yield* works(ownerKey.key));

          // Refused, they are revoked too.
          const left =
            yield* sql`SELECT k.id FROM workspace.partner_keys k JOIN workspace.partners p ON p.id = k.partner_id WHERE p.workspace_id = ${home}`;

          assert.sameMembers(
            left.map((row) => String(row["id"])),
            [older.partnerKey.id, ownerKey.partnerKey.id]
          );
        })
    );
  }
);
