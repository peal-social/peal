// A workspace's slug names its pages in the web app's addresses
// (`/<slug>/posts`): Better Auth's routes make a workspace only with a
// slug the app can route, and never change it after.
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
      "refuse a slug the web app cannot route: a personal page, an id, other characters",
      () =>
        Effect.gen(function* refused() {
          const app = yield* TestApp;
          const owner = yield* signedUp("slugs");

          for (const slug of [
            "agenda",
            "account",
            "notices",
            "report",
            "new",
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

          const taken = `agenda-${randomUUID().slice(0, 8)}`;

          const made = yield* app.request("/api/auth/organization/create", {
            body: { name: "Agenda", slug: taken },
            headers: { cookie: owner.cookies },
          });

          assert.strictEqual(made.status, 200);
          assert.strictEqual((yield* bodyOf(SlugSchema, made)).slug, taken);
        })
    );

    it.effect("keep a workspace's slug when it is renamed", () =>
      Effect.gen(function* kept() {
        const app = yield* TestApp;
        const owner = yield* signedUp("slug-kept");
        const workspaceId = yield* workspaceOf(owner, "Before");

        const moved = yield* app.request("/api/auth/organization/update", {
          body: {
            data: { slug: `after-${randomUUID().slice(0, 8)}` },
            organizationId: workspaceId,
          },
          headers: { cookie: owner.cookies },
        });

        assert.strictEqual(moved.status, 400);
        assert.strictEqual(
          (yield* bodyOf(RefusalSchema, moved)).code,
          "WORKSPACE_SLUG_FIXED"
        );

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
