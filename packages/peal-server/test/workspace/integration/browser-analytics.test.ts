// How the web app measures its use, as GET /api/me tells it, and the
// person's choice about it, through the whole server: off without a key or
// without PEAL_POSTHOG_WEB, never for staff acting as someone, and the web
// app's session joining the server's events of the same person.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { HttpApiClient } from "effect/http-api";
import { SqlClient } from "effect/sql";
import {
  deviceCodeGrantType,
  MeSchema,
  OAuthApi,
  forWorkspace,
} from "peal-contract";

import {
  appWithPostHog,
  capturedEvents,
  eventsMatching,
  syntheticProjectToken,
} from "#test/shared/fake-posthog.ts";
import {
  apiKeyOf,
  bodyOf,
  cookiesOf,
  inProcessHttpClient,
  makeAdmin,
  MigratedSqlLive,
  origin,
  signedUpUnconfirmed,
  signIn,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

const json = <S extends Schema.Top>(schema: S) => Schema.toCodecJson(schema);

const ChoiceSchema = Schema.Struct({
  consent: Schema.Literals(["granted", "refused"]),
  decidedAt: Schema.String,
});

const ExportedUserSchema = Schema.Struct({
  user: Schema.Struct({
    browserAnalyticsConsent: Schema.NullOr(Schema.String),
    browserAnalyticsConsentAt: Schema.NullOr(Schema.String),
  }),
});

const consentPath = "/api/me/browser-analytics/consent";

// A UUIDv7, as the web app's SDK makes its session ids.
const browserSessionId = "019a7b2c-3d4e-7f50-8a1b-2c3d4e5f6a7b";

const draft = {
  channelIds: [],
  content: { media: [], overrides: [], text: "A synthetic draft." },
};

const meOf = (cookie: string) =>
  Effect.gen(function* me() {
    const app = yield* TestApp;

    return yield* bodyOf(
      json(MeSchema),
      yield* app.request("/api/me", { headers: { cookie } })
    );
  });

const choose = (cookie: string, choice: "granted" | "refused") =>
  Effect.gen(function* chosen() {
    const app = yield* TestApp;

    return yield* app.request(consentPath, {
      body: { choice },
      headers: { cookie },
      method: "PUT",
    });
  });

layer(Layer.mergeAll(TestApp.layerWith(unconfirmedEmails), MigratedSqlLive), {
  excludeTestServices: true,
  timeout: "120 seconds",
})("the web app's measurement without product analytics", (it) => {
  it.effect("is null, and a choice is kept all the same", () =>
    Effect.gen(function* off() {
      const person = yield* signedUpUnconfirmed("measure-off");

      assert.isNull((yield* meOf(person.cookies)).browserAnalytics ?? null);

      const kept = yield* choose(person.cookies, "granted");

      assert.strictEqual(kept.status, 200);
      assert.strictEqual(
        (yield* bodyOf(ChoiceSchema, kept)).consent,
        "granted"
      );
      assert.isNull((yield* meOf(person.cookies)).browserAnalytics ?? null);
    })
  );
});

layer(Layer.mergeAll(appWithPostHog(), MigratedSqlLive), {
  excludeTestServices: true,
  timeout: "120 seconds",
})("the web app's measurement with PEAL_POSTHOG_WEB unset", (it) => {
  it.effect("is null though the server measures", () =>
    Effect.gen(function* unset() {
      const person = yield* signedUpUnconfirmed("measure-unset");

      assert.isNull((yield* meOf(person.cookies)).browserAnalytics ?? null);
    })
  );
});

layer(
  Layer.mergeAll(appWithPostHog({ PEAL_POSTHOG_WEB: "on" }), MigratedSqlLive),
  { excludeTestServices: true, timeout: "180 seconds" }
)("the web app's measurement with PEAL_POSTHOG_WEB on", (it) => {
  it.effect("says undecided, with the token and the environment", () =>
    Effect.gen(function* undecided() {
      const person = yield* signedUpUnconfirmed("measure-undecided");
      const workspaceId = yield* workspaceOf(person, "Measured");
      const { browserAnalytics } = yield* meOf(person.cookies);

      assert.deepStrictEqual(browserAnalytics, {
        consent: "undecided",
        decidedAt: null,
        environment: "test",
        excludedWorkspaceIds: [],
        token: syntheticProjectToken,
      });
      assert.isString(workspaceId);
    })
  );

  it.effect(
    "reads each choice back at once, with its date, and none past six months",
    () =>
      Effect.gen(function* choices() {
        const sql = yield* SqlClient.SqlClient;
        const person = yield* signedUpUnconfirmed("measure-choice");

        // Read once, so a session cached in a cookie would be stale.
        yield* meOf(person.cookies);

        const granted = yield* choose(person.cookies, "granted");

        assert.strictEqual(granted.status, 200);

        const grantedAt = (yield* bodyOf(ChoiceSchema, granted)).decidedAt;
        const afterGrant = (yield* meOf(person.cookies)).browserAnalytics;

        assert.strictEqual(afterGrant?.consent, "granted");
        assert.strictEqual(
          Option.fromNullishOr(afterGrant?.decidedAt).pipe(
            Option.map(DateTime.formatIso),
            Option.getOrNull
          ),
          grantedAt
        );

        const refused = yield* choose(person.cookies, "refused");

        assert.strictEqual(refused.status, 200);
        assert.strictEqual(
          (yield* meOf(person.cookies)).browserAnalytics?.consent,
          "refused"
        );

        yield* sql`UPDATE auth."user" SET browser_analytics_consent_at = now() - interval '184 days' WHERE id = ${person.id}`;

        const expired = (yield* meOf(person.cookies)).browserAnalytics;

        assert.strictEqual(expired?.consent, "undecided");
        assert.isNull(expired?.decidedAt ?? null);

        yield* sql`UPDATE auth."user" SET browser_analytics_consent_at = now() - interval '182 days' WHERE id = ${person.id}`;

        assert.strictEqual(
          (yield* meOf(person.cookies)).browserAnalytics?.consent,
          "refused"
        );
      })
  );

  it.effect("refuses a key, and answers it no measurement", () =>
    Effect.gen(function* key() {
      const app = yield* TestApp;
      const owner = yield* signedUpUnconfirmed("measure-key");
      const workspaceId = yield* workspaceOf(owner, "Keyed");

      const { key: token } = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

      const authorization = `Bearer ${token}`;

      const set = yield* app.request(consentPath, {
        body: { choice: "granted" },
        headers: { authorization },
        method: "PUT",
      });

      assert.strictEqual(set.status, 403);

      const me = yield* app.request("/api/me", { headers: { authorization } });

      assert.strictEqual(me.status, 403);
    })
  );

  it.effect("refuses an application acting for the person", () =>
    Effect.gen(function* application() {
      const app = yield* TestApp;
      const oauth = yield* HttpApiClient.make(OAuthApi, { baseUrl: origin });
      const person = yield* signedUpUnconfirmed("measure-oauth");

      // Peal's own command line, through its device grant: an application
      // all the same.
      const device = yield* oauth.tokens.deviceAuthorization({
        payload: {
          client_id: "peal-cli",
          resource: `${origin}/api`,
          scope: "offline_access workspace:read",
        },
      });

      const typed = `${device.user_code.slice(0, 4)}-${device.user_code.slice(4)}`;

      const reviewed = yield* app.request(
        `/api/auth/device?user_code=${typed}`,
        { headers: { cookie: person.cookies } }
      );

      assert.strictEqual(reviewed.status, 200);

      const approved = yield* app.request("/api/auth/device/approve", {
        body: { userCode: device.user_code },
        headers: { cookie: person.cookies },
      });

      assert.strictEqual(approved.status, 200);

      const tokens = yield* oauth.tokens.token({
        payload: {
          client_id: "peal-cli",
          device_code: device.device_code,
          grant_type: deviceCodeGrantType,
        },
      });

      const authorization = `Bearer ${tokens.access_token}`;

      const set = yield* app.request(consentPath, {
        body: { choice: "granted" },
        headers: { authorization },
        method: "PUT",
      });

      assert.strictEqual(set.status, 403);

      // Nor does it measure an application.
      const me = yield* bodyOf(
        json(MeSchema),
        yield* app.request("/api/me", { headers: { authorization } })
      );

      assert.isNull(me.browserAnalytics ?? null);
    }).pipe(Effect.provide(inProcessHttpClient))
  );

  it.effect(
    "is null in a session staff act in, which may not choose either",
    () =>
      Effect.gen(function* impersonated() {
        const app = yield* TestApp;
        const member = yield* signedUpUnconfirmed("measure-member");
        const support = yield* signedUpUnconfirmed("measure-staff");

        yield* workspaceOf(member, "Supported");
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

        const actingAs = cookiesOf(started);
        const me = yield* meOf(actingAs);

        assert.strictEqual(me.impersonatedBy, support.id);
        assert.isNull(me.browserAnalytics ?? null);

        const set = yield* choose(actingAs, "granted");

        assert.strictEqual(set.status, 403);
        assert.strictEqual(
          (yield* meOf(member.cookies)).browserAnalytics?.consent,
          "undecided"
        );
      })
  );

  it.effect("lets neither a sign-up nor updateUser set the choice", () =>
    Effect.gen(function* notInput() {
      const app = yield* TestApp;
      const sql = yield* SqlClient.SqlClient;

      const created = yield* app.request("/api/auth/sign-up/email", {
        body: {
          browserAnalyticsConsent: "granted",
          browserAnalyticsConsentAt: "2026-11-18T10:00:00.000Z",
          email: `measure-sign-up+${randomUUID()}@example.test`,
          locale: "en",
          name: "measure-sign-up",
          password: "correct horse battery staple",
        },
      });

      assert.strictEqual(created.status, 400);

      const { cookies: person } = yield* signedUpUnconfirmed("measure-input");

      const updated = yield* app.request("/api/auth/update-user", {
        body: { browserAnalyticsConsent: "granted" },
        headers: { cookie: person },
      });

      assert.strictEqual(updated.status, 400);

      const me = yield* meOf(person);

      assert.strictEqual(me.browserAnalytics?.consent, "undecided");

      const rows = yield* sql<{
        readonly consent: string | null;
      }>`SELECT browser_analytics_consent AS consent FROM auth."user" WHERE id = ${me.user.id}`;

      assert.deepStrictEqual(rows, [{ consent: null }]);

      // Nor does Better Auth answer them.
      const session = yield* app.request("/api/auth/get-session", {
        headers: { cookie: person },
      });

      assert.notInclude(JSON.stringify(session.body), "browserAnalytics");
    })
  );

  it.effect("puts the choice and its date in the account's export", () =>
    Effect.gen(function* exported() {
      const app = yield* TestApp;
      const person = yield* signedUpUnconfirmed("measure-export");

      const before = yield* bodyOf(
        ExportedUserSchema,
        yield* app.request("/api/me/export", {
          headers: { cookie: person.cookies },
        })
      );

      assert.isNull(before.user.browserAnalyticsConsent);
      assert.isNull(before.user.browserAnalyticsConsentAt);

      const granted = yield* bodyOf(
        ChoiceSchema,
        yield* choose(person.cookies, "granted")
      );

      const after = yield* bodyOf(
        ExportedUserSchema,
        yield* app.request("/api/me/export", {
          headers: { cookie: person.cookies },
        })
      );

      assert.strictEqual(after.user.browserAnalyticsConsent, "granted");
      assert.strictEqual(
        after.user.browserAnalyticsConsentAt,
        granted.decidedAt
      );
    })
  );

  it.effect(
    "joins a person's events to the web app's session their browser names",
    () =>
      Effect.gen(function* joined() {
        const app = yield* TestApp;
        const person = yield* signedUpUnconfirmed("measure-session");
        const workspaceId = yield* workspaceOf(person, "Joined");
        const posts = `/api/v1/posts`;

        // Only once the person allowed it.
        assert.strictEqual(
          (yield* choose(person.cookies, "granted")).status,
          200
        );

        const named = yield* app.request(posts, {
          body: draft,
          headers: {
            cookie: person.cookies,
            "x-posthog-session-id": browserSessionId,
            ...forWorkspace(workspaceId),
          },
        });

        assert.strictEqual(named.status, 201);

        const malformed = yield* app.request(posts, {
          body: draft,
          headers: {
            cookie: person.cookies,
            "x-posthog-session-id": "not-a-session",
            ...forWorkspace(workspaceId),
          },
        });

        assert.strictEqual(malformed.status, 201);

        const { key: token } = yield* apiKeyOf(person, workspaceId, [
          "post:create",
        ]);

        const keyed = yield* app.request(posts, {
          body: draft,
          headers: {
            authorization: `Bearer ${token}`,
            "x-posthog-session-id": browserSessionId,
            ...forWorkspace(workspaceId),
          },
        });

        assert.strictEqual(keyed.status, 201);

        const created = yield* eventsMatching(
          (event) =>
            event.event === "api_operation" &&
            event.properties["operation"] === "posts.create" &&
            event.properties["workspace_id"] === workspaceId,
          3
        );

        const byPerson = created.filter(
          ({ distinct_id: id }) => id === person.id
        );

        assert.strictEqual(byPerson.length, 2);
        assert.deepStrictEqual(
          byPerson.map(({ properties }) => properties["$session_id"] ?? null),
          [browserSessionId, null]
        );

        const byKey = created.filter(
          ({ distinct_id: id }) => id === `workspace:${workspaceId}`
        );

        assert.strictEqual(byKey.length, 1);
        assert.notProperty(byKey[0]?.properties, "$session_id");

        const all = yield* capturedEvents;

        assert.notInclude(JSON.stringify(all), "not-a-session");
      })
  );

  it.effect(
    "joins no session for a person who has not allowed it, or withdrew",
    () =>
      Effect.gen(function* notAllowed() {
        const app = yield* TestApp;
        const person = yield* signedUpUnconfirmed("measure-unjoined");
        const workspaceId = yield* workspaceOf(person, "Unjoined");
        const posts = `/api/v1/posts`;

        const write = () =>
          app.request(posts, {
            body: draft,
            headers: {
              cookie: person.cookies,
              "x-posthog-session-id": browserSessionId,
              ...forWorkspace(workspaceId),
            },
          });

        // Undecided, then refused.
        assert.strictEqual((yield* write()).status, 201);
        yield* choose(person.cookies, "refused");
        assert.strictEqual((yield* write()).status, 201);

        const created = yield* eventsMatching(
          (event) =>
            event.event === "api_operation" &&
            event.properties["operation"] === "posts.create" &&
            event.properties["workspace_id"] === workspaceId,
          2
        );

        assert.deepStrictEqual(
          created.map(({ properties }) => properties["$session_id"] ?? null),
          [null, null]
        );
      })
  );
});
