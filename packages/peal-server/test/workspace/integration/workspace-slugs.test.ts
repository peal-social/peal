// A workspace's slug names its pages in the web app's addresses
// (`/<slug>/posts`): Better Auth's routes make a workspace only with a
// slug the app can route, and change it only to another such slug.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import {
  bodyOf,
  IntegrationLive,
  signedUp,
  TestApp,
  workspaceOf,
} from "./harness.ts";

const RefusalSchema = Schema.Struct({ code: Schema.String });

const SlugSchema = Schema.Struct({ name: Schema.String, slug: Schema.String });

// How many pairs of people race for one slug: Better Auth checks the slug,
// then inserts, so a pair sent together mostly both pass the check.
const races = 6;

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "workspace slugs",
  (it) => {
    it.effect(
      "refuse a slug the web app cannot route: another page, an id, other characters",
      () =>
        Effect.gen(function* refused() {
          const app = yield* TestApp;
          const owner = yield* signedUp("slugs");

          for (const slug of [
            "create",
            "admin",
            "login",
            "invitations",
            randomUUID(),
            "Capitals",
            "two words",
            "trailing-",
            "a".repeat(49),
          ]) {
            const reply = yield* app.request("/api/auth/organization/create", {
              body: { name: "Refused", slug },
              headers: { cookie: owner.cookies },
            });

            assert.strictEqual(reply.status, 400, slug);
            assert.strictEqual(
              (yield* bodyOf(RefusalSchema, reply)).code,
              "INVALID_WORKSPACE_SLUG"
            );
          }

          const taken = `create-${randomUUID().slice(0, 8)}`;

          const made = yield* app.request("/api/auth/organization/create", {
            body: { name: "Create", slug: taken },
            headers: { cookie: owner.cookies },
          });

          assert.strictEqual(made.status, 200);
          assert.strictEqual((yield* bodyOf(SlugSchema, made)).slug, taken);
        })
    );

    it.effect(
      "change a workspace's slug to one the web app can route and no other workspace holds",
      () =>
        Effect.gen(function* changed() {
          const app = yield* TestApp;
          const owner = yield* signedUp("slug-changed");
          const workspaceId = yield* workspaceOf(owner, "Moving");
          const otherId = yield* workspaceOf(owner, "Other");

          const update = (id: string, slug: string) =>
            app.request("/api/auth/organization/update", {
              body: { data: { slug }, organizationId: id },
              headers: { cookie: owner.cookies },
            });

          for (const slug of ["create", randomUUID(), "Two Words"]) {
            const refused = yield* update(workspaceId, slug);

            assert.strictEqual(refused.status, 400, slug);
            assert.strictEqual(
              (yield* bodyOf(RefusalSchema, refused)).code,
              "INVALID_WORKSPACE_SLUG"
            );
          }

          const slug = `moved-${randomUUID().slice(0, 8)}`;
          const moved = yield* update(workspaceId, slug);

          assert.strictEqual(moved.status, 200);
          assert.strictEqual((yield* bodyOf(SlugSchema, moved)).slug, slug);

          const taken = yield* update(otherId, slug);

          assert.strictEqual(taken.status, 400);
          assert.strictEqual(
            (yield* bodyOf(RefusalSchema, taken)).code,
            "ORGANIZATION_SLUG_ALREADY_TAKEN"
          );
        })
    );

    it.effect(
      "make one workspace of two asked for at once with the same slug, and refuse the other as taken",
      () =>
        Effect.gen(function* raced() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;

          const create = (cookies: string, slug: string) =>
            app.request("/api/auth/organization/create", {
              body: { name: "Kim's workspace", slug },
              headers: { cookie: cookies },
            });

          for (let race = 0; race < races; race += 1) {
            const first = yield* signedUp(`slug-race-${race}-a`);
            const second = yield* signedUp(`slug-race-${race}-b`);
            const slug = `kims-workspace-${randomUUID().slice(0, 8)}`;

            const [one, other] = yield* Effect.all(
              [create(first.cookies, slug), create(second.cookies, slug)],
              { concurrency: "unbounded" }
            );

            const [made, refused, loser] =
              one.status === 200 ? [one, other, second] : [other, one, first];

            assert.strictEqual(made.status, 200, slug);
            assert.strictEqual(refused.status, 400, slug);

            // Better Auth's own check answers ALREADY_EXISTS; the database's
            // refusal, once both passed it, SLUG_ALREADY_TAKEN.
            assert.include(
              [
                "ORGANIZATION_SLUG_ALREADY_TAKEN",
                "ORGANIZATION_ALREADY_EXISTS",
              ],
              (yield* bodyOf(RefusalSchema, refused)).code
            );

            // The one refused holds no workspace, so is a member of none.
            const memberships = yield* sql<{ count: number }>`
              SELECT count(*)::int AS count FROM auth.member
              WHERE user_id = ${loser.id}`;

            assert.strictEqual(memberships[0]?.count, 0, slug);
          }
        })
    );

    it.effect("keep a workspace's slug when it is renamed", () =>
      Effect.gen(function* kept() {
        const app = yield* TestApp;
        const owner = yield* signedUp("slug-kept");
        const workspaceId = yield* workspaceOf(owner, "Before");

        const renamed = yield* app.request("/api/auth/organization/update", {
          body: { data: { name: "After" }, organizationId: workspaceId },
          headers: { cookie: owner.cookies },
        });

        assert.strictEqual(renamed.status, 200);

        const { name, slug } = yield* bodyOf(SlugSchema, renamed);

        assert.strictEqual(name, "After");
        assert.match(slug, /^before-/u);
      })
    );
  }
);
