// A workspace's slug names its pages in the web app's addresses
// (`/<slug>/posts`): Better Auth's routes make a workspace only with a
// slug the app can route, and change it only to another such slug.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  bodyOf,
  IntegrationLive,
  signedUp,
  TestApp,
  workspaceOf,
} from "./harness.ts";

const RefusalSchema = Schema.Struct({ code: Schema.String });

const SlugSchema = Schema.Struct({ name: Schema.String, slug: Schema.String });

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
            "sign-in",
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
