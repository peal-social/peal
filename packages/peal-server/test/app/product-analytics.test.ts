// Product analytics through the whole server, sending to a fake PostHog:
// who each event is about, and that staff acting as someone send nothing.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { McpClient } from "effect/ai";

import { isSafeProperties } from "#shared/domain/product-event.ts";
import {
  authorize,
  connect,
  registeredClient,
  toolNamed,
} from "#test/app/mcp-support.ts";
import {
  appWithPostHog,
  capturedEvents,
  deletionsReceived,
  eventsMatching,
} from "#test/shared/fake-posthog.ts";
import type { CapturedEvent } from "#test/shared/fake-posthog.ts";
import {
  apiKeyOf,
  cookiesOf,
  makeAdmin,
  MigratedSqlLive,
  password,
  signedUpUnconfirmed,
  signIn,
  TestApp,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

const Test = Layer.mergeAll(appWithPostHog(), MigratedSqlLive);

const draft = {
  channelIds: [],
  content: { media: [], overrides: [], text: "A synthetic draft." },
};

const named =
  (event: string, distinctId: string) =>
  (captured: CapturedEvent): boolean =>
    captured.event === event && captured.distinct_id === distinctId;

const decodeNested = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Json)
);

// An object property of an event (`$set`, `$groups`), empty without one.
const nestedOf = (
  event: CapturedEvent | undefined,
  key: string
): Readonly<Record<string, typeof Schema.Json.Type>> =>
  Option.getOrElse(decodeNested(event?.properties[key]), () => ({}));

// Long enough for the server to have sent what it queued: a batch every
// two seconds at most.
const drained = Effect.sleep("5 seconds");

layer(Test, { excludeTestServices: true, timeout: "180 seconds" })(
  "product analytics",
  (it) => {
    it.effect(
      "tells a password sign-up, with the person's properties and no address",
      () =>
        Effect.gen(function* signUp() {
          const person = yield* signedUpUnconfirmed("analytics-sign-up");

          const [signedUp] = yield* eventsMatching(
            named("user_signed_up", person.id)
          );

          assert.strictEqual(signedUp?.properties["method"], "password");
          assert.strictEqual(signedUp?.properties["locale"], "en");
          assert.strictEqual(signedUp?.properties["actor_kind"], "user");
          assert.strictEqual(signedUp?.properties["environment"], "test");
          assert.strictEqual(signedUp?.properties["$geoip_disable"], true);

          const [identified] = yield* eventsMatching(
            named("$identify", person.id)
          );

          assert.deepStrictEqual(identified?.properties["$set"], {
            kind: "user",
            locale: "en",
          });
          assert.strictEqual(
            nestedOf(identified, "$set_once")["signup_method"],
            "password"
          );

          const all = yield* capturedEvents;

          assert.notInclude(JSON.stringify(all), person.email);
        })
    );

    it.effect(
      "tells a workspace made by its creator, with its group, and a member's write as theirs",
      () =>
        Effect.gen(function* workspace() {
          const owner = yield* signedUpUnconfirmed("analytics-owner");
          const workspaceId = yield* workspaceOf(owner, "Analytics");

          const [created] = yield* eventsMatching(
            named("workspace_created", owner.id)
          );

          assert.strictEqual(created?.properties["workspace_id"], workspaceId);
          assert.deepStrictEqual(
            nestedOf(created, "$groups")["workspace"],
            workspaceId
          );

          const [group] = yield* eventsMatching(
            (event) =>
              event.event === "$groupidentify" &&
              event.properties["$group_key"] === workspaceId
          );

          assert.strictEqual(group?.properties["$group_type"], "workspace");

          yield* apiKeyOf(owner, workspaceId, ["post:create"]);

          const [operation] = yield* eventsMatching(
            (event) =>
              named("api_operation", owner.id)(event) &&
              event.properties["operation"] === "apiKeys.create"
          );

          assert.strictEqual(operation?.properties["via"], "session");
          assert.strictEqual(operation?.properties["succeeded"], true);
          assert.strictEqual(operation?.properties["status"], 201);
        })
    );

    it.effect("tells a key's write as its workspace's", () =>
      Effect.gen(function* key() {
        const app = yield* TestApp;
        const owner = yield* signedUpUnconfirmed("analytics-key");
        const workspaceId = yield* workspaceOf(owner, "Keys");

        const { key: token } = yield* apiKeyOf(owner, workspaceId, [
          "post:create",
        ]);

        const created = yield* app.request(
          `/api/workspaces/${workspaceId}/posts`,
          { body: draft, headers: { authorization: `Bearer ${token}` } }
        );

        assert.strictEqual(created.status, 201);

        const [operation] = yield* eventsMatching(
          (event) =>
            named("api_operation", `workspace:${workspaceId}`)(event) &&
            event.properties["operation"] === "posts.create"
        );

        assert.strictEqual(operation?.properties["actor_kind"], "service");
        assert.strictEqual(operation?.properties["via"], "apiKey");
        assert.deepStrictEqual(operation?.properties["$set"], {
          kind: "service",
        });
      })
    );

    it.effect(
      "marks staff internal, and tells nothing of what they do as a member",
      () =>
        Effect.gen(function* staff() {
          const app = yield* TestApp;
          const member = yield* signedUpUnconfirmed("analytics-member");
          const workspaceId = yield* workspaceOf(member, "Impersonated");
          const support = yield* signedUpUnconfirmed("analytics-staff");

          yield* makeAdmin(support.id);

          const staffCookies = yield* signIn(support.email);

          const started = yield* app.request(
            `/api/admin/users/${member.id}/impersonate`,
            {
              body: { reason: "Synthetic support request" },
              headers: { cookie: staffCookies },
            }
          );

          assert.strictEqual(started.status, 204);

          const marks = yield* eventsMatching(
            (event) =>
              named("$identify", support.id)(event) &&
              nestedOf(event, "$set")["internal"] === true
          );

          assert.strictEqual(marks.length, 1);

          const drafted = yield* app.request(
            `/api/workspaces/${workspaceId}/posts`,
            { body: draft, headers: { cookie: cookiesOf(started) } }
          );

          assert.strictEqual(drafted.status, 201);

          yield* drained;

          const sent = yield* capturedEvents;

          assert.deepStrictEqual(
            sent.filter(
              ({ event, properties }) =>
                event === "api_operation" &&
                properties["workspace_id"] === workspaceId &&
                properties["operation"] === "posts.create"
            ),
            []
          );
          // Opening the console again marks no one twice.
          assert.strictEqual(
            sent.filter(
              (event) =>
                named("$identify", support.id)(event) &&
                nestedOf(event, "$set")["internal"] === true
            ).length,
            1
          );
        })
    );

    it.effect("sends only properties that may leave", () =>
      Effect.gen(function* safe() {
        const sent = yield* capturedEvents;

        assert.isAbove(sent.length, 0);
        assert.isTrue(
          sent.every(({ properties }) => isSafeProperties(properties))
        );
        // No address of any account the tests made.
        assert.notInclude(JSON.stringify(sent), "example.test");
      })
    );
  }
);

// Where addresses are confirmed, a sign-up for one that has an account
// answers with a made-up user, which makes nothing.
layer(
  Layer.mergeAll(
    appWithPostHog({ AUTH_REQUIRE_EMAIL_VERIFICATION: "true" }),
    MigratedSqlLive
  ),
  { excludeTestServices: true, timeout: "180 seconds" }
)("product analytics, where addresses are confirmed", (it) => {
  it.effect(
    "tells nothing of a sign-up for an address that has an account",
    () =>
      Effect.gen(function* knownAddress() {
        const app = yield* TestApp;
        const person = yield* signedUpUnconfirmed("analytics-twice");

        yield* eventsMatching(named("user_signed_up", person.id));

        const again = yield* app.request("/api/auth/sign-up/email", {
          body: { email: person.email, locale: "en", name: "Again", password },
        });

        assert.strictEqual(again.status, 200);

        yield* drained;

        assert.strictEqual(
          (yield* capturedEvents).filter(
            ({ event }) => event === "user_signed_up"
          ).length,
          1
        );
      })
  );
});

// The calls of a tool in a workspace PostHog received.
const toolCalls = (workspaceId: string, tool: string) =>
  eventsMatching(
    ({ event, properties }) =>
      event === "mcp_tool_called" &&
      properties["workspace_id"] === workspaceId &&
      properties["tool"] === tool
  );

// A connection's tools: each call that ran is told as `mcp_tool_called`,
// reading or changing, and never as an API operation.
layer(
  Layer.mergeAll(
    appWithPostHog({ MCP_DYNAMIC_REGISTRATION: "true" }),
    MigratedSqlLive
  ),
  { excludeTestServices: true, timeout: "180 seconds" }
)("product analytics of the MCP endpoint", (it) => {
  it.effect("tells each tool call, reading, changing or refused", () =>
    Effect.gen(function* tools() {
      const owner = yield* signedUpUnconfirmed("analytics-mcp");
      const workspaceId = yield* workspaceOf(owner, "Agents");
      const clientId = yield* registeredClient;

      const writing = yield* authorize(
        owner,
        clientId,
        workspaceId,
        "openid workspace:read workspace:write"
      );

      const context = yield* Layer.build(connect(Option.some(writing)));
      const client = yield* McpClient.McpClient.pipe(Effect.provide(context));
      const listed = yield* client.listTools().pipe(Effect.provide(context));

      const call = (name: string, args: Record<string, string> = {}) =>
        client
          .callTool({ arguments: args, tool: toolNamed(listed, name) })
          .pipe(Effect.provide(context));

      const read = yield* call("list_tags");

      assert.isNotTrue(read.isError);

      const [reading] = yield* toolCalls(workspaceId, "list_tags");

      assert.strictEqual(reading?.distinct_id, owner.id);
      assert.strictEqual(reading?.properties["changes"], false);
      assert.strictEqual(reading?.properties["is_error"], false);
      assert.isNumber(reading?.properties["duration_ms"]);

      const created = yield* call("create_tag", {
        colour: "green",
        name: "Synthetic campaign",
      });

      assert.isNotTrue(created.isError);

      const [changing] = yield* toolCalls(workspaceId, "create_tag");

      assert.strictEqual(changing?.properties["changes"], true);

      // The same name again is refused by the tool.
      const refused = yield* call("create_tag", {
        colour: "green",
        name: "Synthetic campaign",
      });

      assert.isTrue(refused.isError);

      const calls = yield* eventsMatching(
        ({ event, properties }) =>
          event === "mcp_tool_called" &&
          properties["workspace_id"] === workspaceId &&
          properties["is_error"] === true
      );

      assert.strictEqual(calls[0]?.properties["error_type"], "tool_refused");

      yield* drained;

      // Through the MCP endpoint, a change is its tool's call alone.
      assert.deepStrictEqual(
        (yield* capturedEvents).filter(
          ({ event, properties }) =>
            event === "api_operation" &&
            properties["workspace_id"] === workspaceId &&
            JSON.stringify(properties["operation"]).startsWith('"mcp.')
        ),
        []
      );
    })
  );
});

// With a personal key, an erasure deletes its persons at PostHog.
layer(
  Layer.mergeAll(
    appWithPostHog({
      PEAL_POSTHOG_PERSONAL_API_KEY: "phx_synthetic",
      PEAL_POSTHOG_PROJECT_ID: "12345",
    }),
    MigratedSqlLive
  ),
  { excludeTestServices: true, timeout: "180 seconds" }
)("product analytics of an erasure", (it) => {
  it.effect("deletes a deleted workspace's service identity at PostHog", () =>
    Effect.gen(function* erased() {
      const app = yield* TestApp;
      const owner = yield* signedUpUnconfirmed("analytics-erased");
      const workspaceId = yield* workspaceOf(owner, "Erased");

      const deleted = yield* app.request(`/api/workspaces/${workspaceId}`, {
        body: { name: "Erased" },
        headers: { cookie: owner.cookies },
        method: "DELETE",
      });

      assert.strictEqual(deleted.status, 204);

      const [deletion] = yield* deletionsReceived;

      assert.strictEqual(
        deletion?.path,
        "/api/projects/12345/persons/bulk_delete/"
      );
      assert.strictEqual(
        deletion?.headers["authorization"],
        "Bearer phx_synthetic"
      );
      assert.deepStrictEqual(
        Schema.decodeUnknownSync(
          Schema.fromJsonString(
            Schema.Struct({
              delete_events: Schema.Boolean,
              distinct_ids: Schema.Array(Schema.String),
            })
          )
        )(deletion?.body),
        { delete_events: true, distinct_ids: [`workspace:${workspaceId}`] }
      );
    })
  );
});
