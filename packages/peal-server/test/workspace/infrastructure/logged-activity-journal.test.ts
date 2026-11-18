import { assert, describe, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";

import { ActivityLog } from "#activity/application/activity-log.ts";
import { ActivityEventIdSchema } from "#activity/domain/activity-event-id.ts";
import { ActivityEvent } from "#activity/domain/activity-event.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  sampleUserId as userId,
  sampleWorkspaceId as workspaceId,
} from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";
import { ActivityJournal } from "#workspace/application/activity-journal.ts";
import type {
  AnsweredChange,
  ChangeOutcome,
} from "#workspace/application/activity-journal.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";
import { LoggedActivityJournal } from "#workspace/infrastructure/logged-activity-journal.ts";

// The operation the stub log fails to keep: its database is down.
const unkept = "posts.unkept";

// A log that keeps everything, but `unkept`.
const LogTest = Layer.succeed(
  ActivityLog,
  ActivityLog.of({
    list: () => Effect.die("not used"),
    purge: Effect.succeed(0),
    record: (entry) =>
      entry.operation === unkept
        ? Effect.fail(new DatabaseError({ cause: "synthetic" }))
        : Effect.succeed(
            new ActivityEvent({
              actor: entry.actor,
              application: Option.none(),
              errorCode: entry.errorCode,
              id: ActivityEventIdSchema.make(
                "00000000-0000-7000-8000-0000000000a1"
              ),
              impersonated: entry.impersonated,
              objectIds: {},
              occurredAt: DateTime.makeUnsafe(0),
              operation: entry.operation,
              requestId: entry.requestId,
              status: entry.status,
              via: entry.via,
              workspaceId: entry.workspaceId,
            })
          ),
  })
);

const member = new UserPrincipal({
  impersonatedBy: Option.none(),
  userId,
});

const change = (overrides: Partial<AnsweredChange> = {}): AnsweredChange => ({
  named: {},
  operation: "posts.create",
  outcome: { _tag: "answered", status: 201 },
  principal: member,
  requestId: Option.none(),
  via: "session",
  workspaceId,
  ...overrides,
});

const recordAndRead = (overrides: Partial<AnsweredChange> = {}) =>
  Effect.gen(function* recording() {
    yield* clearRecorded;
    yield* ActivityJournal.use((journal) => journal.record(change(overrides)));

    return yield* sentEvents;
  });

describe("the activity journal's product analytics", () => {
  layer(
    LoggedActivityJournal.pipe(
      Layer.provide(LogTest),
      Layer.provideMerge(recordedAnalytics)
    )
  )((it) => {
    it.effect.each<{
      readonly expected: Readonly<Record<string, boolean | number | string>>;
      readonly label: string;
      readonly outcome: ChangeOutcome;
    }>([
      {
        expected: { status: 201, succeeded: true },
        label: "an answer",
        outcome: { _tag: "answered", status: 201 },
      },
      {
        expected: { status: 409, succeeded: false },
        label: "a refusing answer",
        outcome: { _tag: "answered", status: 409 },
      },
      {
        expected: {
          error_code: "post_not_found",
          status: 404,
          succeeded: false,
        },
        label: "a contract's error",
        outcome: { _tag: "failed", error: Option.some("PostNotFound") },
      },
      {
        expected: { status: 500, succeeded: false },
        label: "a failure the contract does not declare",
        outcome: { _tag: "failed", error: Option.none() },
      },
      {
        expected: { succeeded: false },
        label: "no answer",
        outcome: { _tag: "unanswered" },
      },
    ])("tells $label with its status and code", ({ expected, outcome }) =>
      Effect.gen(function* answered() {
        const [sent] = yield* recordAndRead({ outcome });

        assert.strictEqual(sent?.event, "api_operation");
        assert.strictEqual(sent?.distinctId, userId);

        const properties = sent?.properties ?? {};

        assert.deepStrictEqual(
          {
            error_code: properties["error_code"],
            status: properties["status"],
            succeeded: properties["succeeded"],
          },
          {
            error_code: undefined,
            status: undefined,
            ...expected,
          }
        );
        assert.strictEqual(properties["operation"], "posts.create");
        assert.strictEqual(properties["via"], "session");
      })
    );

    it.effect("tells nothing of a change through the MCP endpoint", () =>
      Effect.gen(function* mcp() {
        assert.deepStrictEqual(
          yield* recordAndRead({
            operation: "mcp.create_tag",
            outcome: { _tag: "toolCalled", errorCode: Option.none() },
            via: "mcp",
          }),
          []
        );
      })
    );

    it.effect("tells a key's change as its workspace's", () =>
      Effect.gen(function* key() {
        const [sent] = yield* recordAndRead({
          principal: new ApiKeyPrincipal({
            apiKeyId: "synthetic-key",
            permissions: [],
            workspaceId,
          }),
          via: "apiKey",
        });

        assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
        assert.strictEqual(sent?.properties["actor_kind"], "service");
      })
    );

    it.effect("tells nothing of what staff do as a member", () =>
      Effect.gen(function* impersonated() {
        assert.deepStrictEqual(
          yield* recordAndRead({
            principal: new UserPrincipal({
              impersonatedBy: Option.some(
                UserIdSchema.make("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d")
              ),
              userId,
            }),
          }),
          []
        );
      })
    );

    it.effect("tells nothing the log did not keep", () =>
      Effect.gen(function* unkeptChange() {
        yield* clearRecorded;

        const failed = yield* ActivityJournal.use((journal) =>
          journal.record(change({ operation: unkept }))
        ).pipe(Effect.flip);

        assert.strictEqual(failed._tag, "DatabaseError");
        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("takes every Better Auth route it keeps as a token", () =>
      Effect.gen(function* routes() {
        for (const operation of [
          "auth:/organization/create",
          "auth:/organization/update-member-role",
          "auth:/subscription/upgrade",
          "partner.createWorkspace",
        ]) {
          const [sent] = yield* recordAndRead({ operation });

          assert.strictEqual(sent?.properties["operation"], operation);
        }
      })
    );
  });
});
