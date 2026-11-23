// A workspace's API used, reads included, is told to product analytics
// once a workspace, way in and day: a key's as the workspace, an
// application's as its person, never a session's, nor a request the
// limit refused.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";
import { RequestLimits } from "#workspace/application/request-limits.ts";
import type { RequestStanding } from "#workspace/application/request-limits.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import type { Principal } from "#workspace/domain/principal.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";
import { analysedRequestLimits } from "#workspace/infrastructure/analysed-request-limits.ts";

const standing = (allowed: boolean): RequestStanding => ({
  allowed,
  limit: 600,
  policy: "default",
  remaining: allowed ? 599 : 0,
  resetAfterSeconds: 30,
  windowSeconds: 60,
  withPaymentMethod: Option.none(),
});

// The key the stub's limit refuses.
const refusedKey = "refused";

const Counted = Layer.succeed(
  RequestLimits,
  RequestLimits.of({
    admit: (principal) =>
      Effect.succeedSome(
        standing(
          !(
            principal._tag === "ApiKeyPrincipal" &&
            principal.apiKeyId === refusedKey
          )
        )
      ),
  })
);

const freshWorkspace = () => WorkspaceIdSchema.make(randomUUID());

const keyOf = (workspaceId: WorkspaceId, apiKeyId = "synthetic") =>
  new ApiKeyPrincipal({ apiKeyId, permissions: [], workspaceId });

const userId = UserIdSchema.make(randomUUID());

const applicationOf = (workspaceId: Option.Option<WorkspaceId>) =>
  new UserPrincipal({
    impersonatedBy: Option.none(),
    oauth: Option.some({
      clientId: "synthetic-client",
      scopes: ["workspace:read"],
      workspaceId,
    }),
    userId,
  });

const admit = (principal: Principal, actingIn = Option.none<WorkspaceId>()) =>
  RequestLimits.use((limits) => limits.admit(principal, actingIn));

layer(
  analysedRequestLimits(Counted).pipe(Layer.provideMerge(recordedAnalytics))
)("the API's use product analytics hears", (it) => {
  it.effect("tells a key's first request of a day, as the workspace", () =>
    Effect.gen(function* key() {
      const workspaceId = freshWorkspace();

      yield* clearRecorded;

      const answered = yield* admit(keyOf(workspaceId));

      yield* admit(keyOf(workspaceId));
      yield* admit(keyOf(workspaceId, "another"));

      const [sent, ...more] = yield* sentEvents;

      assert.isTrue(Option.isSome(answered));
      assert.lengthOf(more, 0);
      assert.strictEqual(sent?.event, "api_used");
      assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
      assert.strictEqual(sent?.properties["via"], "apiKey");
      assert.strictEqual(sent?.properties["day"], "1970-01-01");
      assert.strictEqual(sent?.properties["workspace_id"], workspaceId);
    })
  );

  it.effect("tells it again the next day", () =>
    Effect.gen(function* nextDay() {
      const workspaceId = freshWorkspace();

      yield* admit(keyOf(workspaceId));
      yield* clearRecorded;
      yield* TestClock.adjust("1 day");
      yield* admit(keyOf(workspaceId));

      const [sent, ...more] = yield* sentEvents;

      assert.lengthOf(more, 0);
      assert.strictEqual(sent?.properties["day"], "1970-01-02");
    })
  );

  it.effect(
    "tells an application's as its person, in the workspace its token is bound to, never one a request names",
    () =>
      Effect.gen(function* application() {
        const bound = freshWorkspace();

        yield* clearRecorded;
        yield* admit(applicationOf(Option.some(bound)));
        // Bound to none, as the command line's: the workspaces its
        // requests name are not checked yet, and are never told.
        yield* admit(
          applicationOf(Option.none()),
          Option.some(freshWorkspace())
        );
        yield* admit(
          applicationOf(Option.none()),
          Option.some(freshWorkspace())
        );

        const sent = yield* sentEvents;

        assert.deepStrictEqual(
          sent.map((event) => [
            event.event,
            event.distinctId,
            event.properties["via"],
            event.properties["workspace_id"],
          ]),
          [
            ["api_used", userId, "oauth", bound],
            ["api_used", userId, "oauth", undefined],
          ]
        );
      })
  );

  it.effect("tells nothing more of a day once a later one began", () =>
    Effect.gen(function* earlier() {
      const workspaceId = freshWorkspace();

      yield* TestClock.adjust("1 day");
      yield* admit(keyOf(freshWorkspace()));
      yield* clearRecorded;
      // A request that read the clock before midnight, answered after.
      yield* TestClock.adjust("-1 day");
      yield* admit(keyOf(workspaceId));
      yield* TestClock.adjust("1 day");
      yield* admit(keyOf(workspaceId));

      assert.deepStrictEqual(
        (yield* sentEvents).map((event) => event.properties["workspace_id"]),
        [workspaceId]
      );
    })
  );

  it.effect("tells nothing of a session, nor of a request refused", () =>
    Effect.gen(function* untold() {
      yield* clearRecorded;

      yield* admit(
        new UserPrincipal({ impersonatedBy: Option.none(), userId }),
        Option.some(freshWorkspace())
      );

      yield* admit(keyOf(freshWorkspace(), refusedKey));

      assert.deepStrictEqual(yield* sentEvents, []);
    })
  );
});
