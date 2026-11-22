// A person's name and a workspace's go out in invitations, from Peal's own
// domain: Better Auth's routes keep them one line, bounded, and never a
// link, and refuse what was typed otherwise, with a code the web app's
// forms explain.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { workspaceSlugOf } from "peal-contract/workspace-slug";

import {
  bodyOf,
  IntegrationLive,
  newEmail,
  password,
  signedUp,
  TestApp,
  workspaceOf,
} from "./harness.ts";

const RefusalSchema = Schema.Struct({ code: Schema.String });

const NamesSchema = Schema.Array(Schema.Struct({ name: Schema.String }));

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "names people type",
  (it) => {
    it.effect(
      "refuse a sign-up named with a link, for a known address as for a new one",
      () =>
        Effect.gen(function* signUps() {
          const app = yield* TestApp;
          const known = yield* signedUp("known-name");

          for (const email of [newEmail("linked"), known.email]) {
            const reply = yield* app.request("/api/auth/sign-up/email", {
              body: {
                email,
                locale: "en",
                name: "Claim your prize at evil.com",
                password,
              },
            });

            assert.strictEqual(reply.status, 400);
            assert.strictEqual(
              (yield* bodyOf(RefusalSchema, reply)).code,
              "INVALID_NAME"
            );
          }

          const long = yield* app.request("/api/auth/sign-up/email", {
            body: {
              email: newEmail("long-name"),
              locale: "en",
              name: "a".repeat(101),
              password,
            },
          });

          assert.strictEqual(long.status, 400);
        })
    );

    it.effect(
      "keep a name on one line, and refuse a link in a person's new name",
      () =>
        Effect.gen(function* renames() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const person = yield* signedUp("renamed");

          const kept = yield* app.request("/api/auth/update-user", {
            body: { name: "St. John\nSmith" },
            headers: { cookie: person.cookies },
          });

          assert.strictEqual(kept.status, 200);

          const linked = yield* app.request("/api/auth/update-user", {
            body: { name: "see www.evil.example" },
            headers: { cookie: person.cookies },
          });

          assert.strictEqual(linked.status, 400);
          assert.strictEqual(
            (yield* bodyOf(RefusalSchema, linked)).code,
            "INVALID_NAME"
          );

          const stored =
            yield* sql`SELECT name FROM auth.user WHERE id = ${person.id}`;

          assert.deepStrictEqual(
            Schema.decodeUnknownSync(NamesSchema)(stored),
            [{ name: "St. John Smith" }]
          );
        })
    );

    it.effect("refuse a workspace named with a link, made or renamed", () =>
      Effect.gen(function* workspaces() {
        const app = yield* TestApp;
        const sql = yield* SqlClient.SqlClient;
        const owner = yield* signedUp("workspace-namer");

        const made = yield* app.request("/api/auth/organization/create", {
          body: {
            name: "Free money https://evil.example",
            slug: workspaceSlugOf("linked", randomUUID().slice(0, 12)),
          },
          headers: { cookie: owner.cookies },
        });

        assert.strictEqual(made.status, 400);
        assert.strictEqual(
          (yield* bodyOf(RefusalSchema, made)).code,
          "INVALID_WORKSPACE_NAME"
        );

        const workspaceId = yield* workspaceOf(owner, "Plain");

        const renamed = yield* app.request("/api/auth/organization/update", {
          body: {
            data: { name: "Visit evil.RU" },
            organizationId: workspaceId,
          },
          headers: { cookie: owner.cookies },
        });

        assert.strictEqual(renamed.status, 400);
        assert.strictEqual(
          (yield* bodyOf(RefusalSchema, renamed)).code,
          "INVALID_WORKSPACE_NAME"
        );

        const tidied = yield* app.request("/api/auth/organization/update", {
          body: {
            data: { name: "  Ph.D.\tcandidates " },
            organizationId: workspaceId,
          },
          headers: { cookie: owner.cookies },
        });

        assert.strictEqual(tidied.status, 200);

        const stored =
          yield* sql`SELECT name FROM auth.organization WHERE id = ${workspaceId}`;

        assert.deepStrictEqual(Schema.decodeUnknownSync(NamesSchema)(stored), [
          { name: "Ph.D. candidates" },
        ]);
      })
    );
  }
);
