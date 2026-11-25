import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Context, Effect, Layer, Schema } from "effect";
import { MeSchema, forWorkspace } from "peal-contract";

import { commandLineToken } from "#test/workspace/support.ts";

import {
  apiKeyOf,
  bodyOf,
  confirmedAccount,
  cookiesOf,
  IntegrationLive,
  makeAdmin,
  origin,
  signIn,
  signedUp,
  TestApp,
  workspaceOf,
} from "./harness.ts";

interface Fixture {
  /** Signed in, then banned by staff: their cookies outlive their session. */
  readonly bannedCookies: string;
  readonly bannedWorkspaceId: string;
  /** An API key of the workspace with apiKey:read and post:read. */
  readonly key: string;
  /** The owner's command line's OAuth access token. */
  readonly ownerToken: string;
  /** A workspace the owner does not belong to. */
  readonly otherWorkspaceId: string;
  readonly ownerCookies: string;
  /** An API key of the workspace with post:read only. */
  readonly postReaderKey: string;
  /** An API key of the workspace with apiKey:read, revoked by the owner. */
  readonly revokedKey: string;
  readonly workspaceId: string;
}

const apiKeys = "/api/v1/workspace/api-keys";

class Matrix extends Context.Service<Matrix, Fixture>()(
  "peal-server/test/SecurityMatrix"
) {}

const MatrixLive = Layer.effect(
  Matrix,
  Effect.gen(function* matrix() {
    const app = yield* TestApp;

    // One after the other: the mail transport keeps one connection open,
    // where parallel emails would each open one, which Mailpit is slow to
    // greet.
    const owner = yield* signedUp("owner");
    const outsider = yield* signedUp("outsider");
    const banned = yield* signedUp("banned");
    const staff = yield* confirmedAccount("staff");

    const workspaceId = yield* workspaceOf(owner, "Studio");
    const otherWorkspaceId = yield* workspaceOf(outsider, "Elsewhere");
    const bannedWorkspaceId = yield* workspaceOf(banned, "Banned");

    const { key } = yield* apiKeyOf(owner, workspaceId, [
      "apiKey:read",
      "post:read",
    ]);

    const { key: postReaderKey } = yield* apiKeyOf(owner, workspaceId, [
      "post:read",
    ]);

    const revoked = yield* apiKeyOf(owner, workspaceId, ["apiKey:read"]);

    const revocation = yield* app.request(`${apiKeys}/${revoked.apiKey.id}`, {
      headers: { cookie: owner.cookies, ...forWorkspace(workspaceId) },
      method: "DELETE",
    });

    assert.strictEqual(revocation.status, 204);

    const ownerToken = yield* commandLineToken(owner.cookies);

    yield* makeAdmin(staff.id);

    const staffCookies = yield* signIn(staff.email);

    const ban = yield* app.request(`/api/admin/users/${banned.id}/ban`, {
      body: { expiresAt: null, reason: "Synthetic test of a ban" },
      headers: { cookie: staffCookies },
    });

    assert.strictEqual(ban.status, 204);

    return {
      bannedCookies: banned.cookies,
      bannedWorkspaceId,
      key,
      otherWorkspaceId,
      ownerCookies: owner.cookies,
      ownerToken,
      postReaderKey,
      revokedKey: revoked.key,
      workspaceId,
    };
  })
).pipe(Layer.provideMerge(IntegrationLive));

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

const base64url = (value: string) => Buffer.from(value).toString("base64url");

// An access token of Peal's whose signature was changed: it no longer
// verifies.
const tampered = (token: string) =>
  [...token.split(".").slice(0, 2), base64url("synthetic signature")].join(".");

// A token shaped as an access token, for this server's API, that expired
// long ago and was never signed by it.
const expiredToken = [
  base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" })),
  base64url(
    JSON.stringify({
      aud: `${origin}/api`,
      azp: "peal-cli",
      exp: 1,
      iat: 0,
      iss: `${origin}/api/auth`,
      scope: "workspace:read workspace:write",
      sub: "synthetic-user",
    })
  ),
  base64url("synthetic signature"),
].join(".");

// A request with the owner's session and a bearer credential besides.
const withSession =
  (credential: (fixture: Fixture) => Record<string, string>) =>
  (fixture: Fixture) => ({
    cookie: fixture.ownerCookies,
    ...credential(fixture),
  });

const channels = "/api/v1/channels";

const credential = "/api/v1/credential";

interface Case {
  readonly expected: number;
  readonly headers?: (fixture: Fixture) => Record<string, string>;
  readonly method?: "GET" | "POST";
  readonly name: string;
  readonly path: string;
  /** The workspace the request names in its `Peal-Workspace` header. */
  readonly workspace?: (fixture: Fixture) => string;
}

const newKey = { name: "deploy", permissions: ["post:read"] };

// The header that names a case's workspace, none when it names none.
const named = (
  workspace: Case["workspace"],
  fixture: Fixture
): Readonly<Record<string, string>> =>
  workspace === undefined ? {} : forWorkspace(workspace(fixture));

// The browser staff impersonate a member from.
const staffBrowser = "Synthetic staff browser";

const ExportedSessionsSchema = Schema.Struct({
  sessions: Schema.Array(
    Schema.Struct({ userAgent: Schema.NullOr(Schema.String) })
  ),
});

const RefusalSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
});

const MembersSchema = Schema.Struct({
  members: Schema.Array(Schema.Struct({ id: Schema.String })),
});

const cases: readonly Case[] = [
  {
    expected: 401,
    name: "no credentials",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a member's session",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 404,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on a workspace the user is not a member of",
    path: apiKeys,
    workspace: (fixture) => fixture.otherWorkspaceId,
  },
  {
    expected: 404,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on a workspace id that is not one",
    path: apiKeys,
    workspace: () => "studio",
  },
  {
    expected: 200,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key of the workspace",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key on another workspace",
    path: apiKeys,
    workspace: (fixture) => fixture.otherWorkspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.postReaderKey),
    name: "an API key without the permission",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: () => bearer("peal_not-a-key-that-was-ever-issued"),
    name: "an API key that was never issued",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => ({ cookie: fixture.bannedCookies }),
    name: "a banned user's cached session, reading",
    path: apiKeys,
    workspace: (fixture) => fixture.bannedWorkspaceId,
  },
  {
    expected: 401,
    headers: (fixture) => ({ cookie: fixture.bannedCookies }),
    method: "POST",
    name: "a banned user's cached session, writing",
    path: apiKeys,
    workspace: (fixture) => fixture.bannedWorkspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => ({
      cookie: fixture.ownerCookies,
      origin: "https://elsewhere.example",
    }),
    method: "POST",
    name: "a member's session sent by another site",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    name: "no credentials on the channels",
    path: channels,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a member's session on the channels",
    path: channels,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 404,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on another workspace's channels",
    path: channels,
    workspace: (fixture) => fixture.otherWorkspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key without channel:read on the channels",
    path: channels,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key on another workspace's channels",
    path: channels,
    workspace: (fixture) => fixture.otherWorkspaceId,
  },
  {
    expected: 401,
    name: "no credentials on /api/me",
    path: "/api/me",
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on /api/me",
    path: "/api/me",
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key on /api/me",
    path: "/api/me",
  },
  {
    expected: 403,
    headers: (fixture) => ({ cookie: fixture.bannedCookies }),
    name: "a banned user's cached session on /api/me",
    path: "/api/me",
  },
  {
    expected: 401,
    name: "no credentials on the user's notices",
    path: "/api/me/notices",
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on the user's notices",
    path: "/api/me/notices",
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key on the user's notices",
    path: "/api/me/notices/unread",
  },
  {
    expected: 403,
    headers: (fixture) => ({ cookie: fixture.bannedCookies }),
    name: "a banned user's cached session on the user's notices",
    path: "/api/me/notices/unread",
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session on the user's notification preferences",
    path: "/api/me/notification-preferences",
  },
  {
    expected: 200,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    method: "POST",
    name: "a session marking the user's notices read",
    path: "/api/me/notices/read-all",
  },
  {
    expected: 403,
    headers: (fixture) => ({
      cookie: fixture.ownerCookies,
      origin: "https://elsewhere.example",
    }),
    method: "POST",
    name: "a session sent by another site marking the user's notices read",
    path: "/api/me/notices/read-all",
  },
  {
    expected: 403,
    headers: (fixture) => bearer(fixture.key),
    method: "POST",
    name: "an API key marking the user's notices read",
    path: "/api/me/notices/read-all",
  },
  // A bearer credential the request presents decides: one refused is a
  // 401, whatever session the request carries besides.
  {
    expected: 401,
    headers: withSession(() => bearer("peal_not-a-key-that-was-ever-issued")),
    name: "a session with an API key that was never issued, on the credential",
    path: credential,
  },
  {
    expected: 401,
    headers: withSession(() => bearer("peal_not-a-key-that-was-ever-issued")),
    name: "a session with an API key that was never issued",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession(() => bearer("peal_not-a-key-that-was-ever-issued")),
    method: "POST",
    name: "a session with an API key that was never issued, writing",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession((fixture) => bearer(fixture.revokedKey)),
    name: "a session with a revoked API key, on the credential",
    path: credential,
  },
  {
    expected: 401,
    headers: withSession((fixture) => bearer(fixture.revokedKey)),
    name: "a session with a revoked API key",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: (fixture) => bearer(fixture.revokedKey),
    name: "a revoked API key",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession(() => bearer("peal_synthetic-key-of-another-server")),
    name: "a session with an API key of another server",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession(() =>
      bearer("peal_partner_synthetic-key-of-another-server")
    ),
    name: "a session with a partner key of another server",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession(() => bearer(expiredToken)),
    name: "a session with an expired access token",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession((fixture) => bearer(tampered(fixture.ownerToken))),
    name: "a session with an access token whose signature does not verify",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: withSession(() => bearer("synthetic.malformed.token")),
    name: "a session with a malformed access token",
    path: credential,
  },
  {
    expected: 401,
    headers: withSession(() => bearer("peal_not-a-key-that-was-ever-issued")),
    name: "a session with an API key that was never issued, on /api/me",
    path: "/api/me",
  },
  {
    expected: 401,
    headers: (fixture) => ({
      ...withSession(() => bearer("peal_not-a-key-that-was-ever-issued"))(
        fixture
      ),
      origin: "https://elsewhere.example",
    }),
    method: "POST",
    name: "a session sent by another site with an API key that was never issued",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  // A valid bearer credential acts as itself, the session aside.
  {
    expected: 403,
    headers: withSession((fixture) => bearer(fixture.postReaderKey)),
    name: "a session with an API key without the permission",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 200,
    headers: withSession((fixture) => bearer(fixture.ownerToken)),
    name: "a session with the command line's access token",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 403,
    headers: withSession((fixture) => bearer(fixture.key)),
    name: "a session with an API key on /api/me",
    path: "/api/me",
  },
  // A header that presents no bearer credential leaves the session to
  // decide: a proxy's own sign-in sends Basic on every request.
  {
    expected: 200,
    headers: withSession(() => ({
      authorization: `Basic ${Buffer.from("synthetic-user:synthetic-password").toString("base64")}`,
    })),
    name: "a session behind a proxy's Basic sign-in",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 401,
    headers: () => ({
      authorization: `Basic ${Buffer.from("synthetic-user:synthetic-password").toString("base64")}`,
    }),
    name: "a proxy's Basic sign-in without a session",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 200,
    headers: withSession(() => ({ authorization: "" })),
    name: "a session with an empty Authorization header",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
  {
    expected: 200,
    headers: withSession(() => ({ authorization: "Bearer " })),
    name: "a session with a bearer scheme that carries no token",
    path: apiKeys,
    workspace: (fixture) => fixture.workspaceId,
  },
];

layer(MatrixLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the API's security middleware",
  (it) => {
    it.effect.each(cases)(
      "answers $expected to $name",
      ({ expected, headers, method = "GET", path, workspace }) =>
        Effect.gen(function* answers() {
          const app = yield* TestApp;
          const fixture = yield* Matrix;

          const reply = yield* app.request(path, {
            body: method === "POST" ? newKey : undefined,
            headers: {
              origin,
              ...named(workspace, fixture),
              ...headers?.(fixture),
            },
            method,
          });

          assert.strictEqual(reply.status, expected);
        })
    );

    it.effect(
      "refuses a refused bearer credential with a session as it refuses one without",
      () =>
        Effect.gen(function* sameRefusal() {
          const app = yield* TestApp;
          const fixture = yield* Matrix;

          const refusalOf = (headers: Record<string, string>) =>
            app.request(credential, { headers }).pipe(
              Effect.flatMap((reply) =>
                bodyOf(RefusalSchema, reply).pipe(
                  Effect.map(({ code, message }) => ({
                    challenge: reply.headers.get("www-authenticate"),
                    code,
                    message,
                    status: reply.status,
                  }))
                )
              )
            );

          const alone = yield* refusalOf(bearer(fixture.revokedKey));

          const besideSession = yield* refusalOf({
            ...bearer(fixture.revokedKey),
            cookie: fixture.ownerCookies,
          });

          assert.deepStrictEqual(alone, {
            challenge: null,
            code: "unauthenticated",
            message: alone.message,
            status: 401,
          });
          assert.deepStrictEqual(besideSession, alone);
        })
    );

    it.effect(
      "lets staff impersonate a member, without publishing or handling keys",
      () =>
        Effect.gen(function* impersonates() {
          const app = yield* TestApp;
          const member = yield* signedUp("impersonated");
          const workspaceId = yield* workspaceOf(member, "Shop");
          const staff = yield* confirmedAccount("support");

          const { apiKey, key } = yield* apiKeyOf(member, workspaceId, [
            "apiKey:read",
          ]);

          yield* makeAdmin(staff.id);

          const staffCookies = yield* signIn(staff.email);

          // Staff ban accounts, and never remove one: removing it is its
          // owner's to do, through Peal's API, which erases what every
          // context keeps.
          const removed = yield* app.request("/api/auth/admin/remove-user", {
            body: { userId: member.id },
            headers: { cookie: staffCookies },
          });

          assert.strictEqual(removed.status, 404);

          // Nor act through Better Auth's own admin routes, which the audit
          // log would not see: the staff console records each action.
          const unrecorded = yield* app.request(
            "/api/auth/admin/impersonate-user",
            {
              body: { userId: member.id },
              headers: { cookie: staffCookies },
            }
          );

          assert.strictEqual(unrecorded.status, 404);

          const started = yield* app.request(
            `/api/admin/users/${member.id}/impersonate`,
            {
              body: { reason: "Synthetic support request" },
              headers: { cookie: staffCookies, "user-agent": staffBrowser },
            }
          );

          assert.strictEqual(started.status, 204);

          const cookie = cookiesOf(started);

          const me = yield* bodyOf(
            MeSchema,
            yield* app.request("/api/me", { headers: { cookie } })
          );

          assert.strictEqual(me.user.id, member.id);
          assert.strictEqual(me.impersonatedBy, staff.id);
          // Scheduling and publishing reach the member's real accounts.
          assert.notInclude(
            me.workspaces[0]?.permissions ?? [],
            "post:publish"
          );
          assert.notInclude(
            me.workspaces[0]?.permissions ?? [],
            "post:schedule"
          );
          assert.include(me.workspaces[0]?.permissions ?? [], "post:create");

          const created = yield* app.request(apiKeys, {
            body: newKey,
            headers: { cookie, ...forWorkspace(workspaceId) },
          });

          assert.strictEqual(created.status, 403);

          // Better Auth's own key routes are off: keys go through Peal's API.
          const listed = yield* app.request(
            `/api/auth/api-key/list?organizationId=${workspaceId}`,
            { headers: { cookie } }
          );

          const deleted = yield* app.request("/api/auth/api-key/delete", {
            body: { keyId: apiKey.id },
            headers: { cookie },
          });

          assert.strictEqual(listed.status, 404);
          assert.strictEqual(deleted.status, 404);

          // Staff may read the workspace's members, and change nothing.
          const members = yield* app.request(
            `/api/auth/organization/list-members?organizationId=${workspaceId}`,
            { headers: { cookie } }
          );

          assert.strictEqual(members.status, 200);

          const [owner] = (yield* bodyOf(MembersSchema, members)).members;
          const memberId = owner?.id ?? "";

          const changes = [
            [
              "invite-member",
              {
                email: staff.email,
                organizationId: workspaceId,
                role: "owner",
              },
            ],
            [
              "update-member-role",
              { memberId, organizationId: workspaceId, role: "viewer" },
            ],
            [
              "remove-member",
              { memberIdOrEmail: memberId, organizationId: workspaceId },
            ],
            [
              "update",
              { data: { name: "Renamed" }, organizationId: workspaceId },
            ],
            ["create", { name: "Mine", slug: `mine-${randomUUID()}` }],
          ] as const;

          for (const [route, body] of changes) {
            const changed = yield* app.request(
              `/api/auth/organization/${route}`,
              { body, headers: { cookie } }
            );

            assert.strictEqual(changed.status, 403, route);
          }

          // Nor deleting it, which goes through Peal's API.
          const workspaceDeleted = yield* app.request(`/api/v1/workspace`, {
            body: { name: "Shop" },
            headers: { cookie, ...forWorkspace(workspaceId) },
            method: "DELETE",
          });

          assert.strictEqual(workspaceDeleted.status, 403);

          // Nor changing the member's account.
          const renamed = yield* app.request("/api/auth/update-user", {
            body: { name: "Staff was here" },
            headers: { cookie },
          });

          assert.strictEqual(renamed.status, 403);

          // The key, and the member's place in the workspace, are untouched.
          const stillWorks = yield* app.request(apiKeys, {
            headers: bearer(key),
          });

          assert.strictEqual(stillWorks.status, 200);

          const ownerMe = yield* bodyOf(
            MeSchema,
            yield* app.request("/api/me", {
              headers: { cookie: member.cookies },
            })
          );

          assert.deepStrictEqual(
            ownerMe.workspaces.map(({ id, role }) => ({ id, role })),
            [{ id: workspaceId, role: "owner" }]
          );

          // The member's copy of their data leaves out the session staff
          // opened, whose browser and address are the staff member's.
          const exported = yield* bodyOf(
            ExportedSessionsSchema,
            yield* app.request("/api/me/export", {
              headers: { cookie: member.cookies },
            })
          );

          assert.isNotEmpty(exported.sessions);
          assert.notInclude(
            exported.sessions.map(({ userAgent }) => userAgent),
            staffBrowser
          );
        })
    );

    it.effect("signs a banned user out for good", () =>
      Effect.gen(function* bannedSignIn() {
        const app = yield* TestApp;
        const banned = yield* confirmedAccount("banned-again");
        const staff = yield* confirmedAccount("staff-again");

        yield* makeAdmin(staff.id);

        yield* app.request(`/api/admin/users/${banned.id}/ban`, {
          body: { expiresAt: null, reason: "Synthetic test of a ban" },
          headers: { cookie: yield* signIn(staff.email) },
        });

        const reply = yield* app.request("/api/auth/sign-in/email", {
          body: {
            email: banned.email,
            password: "correct horse battery staple",
          },
        });

        assert.strictEqual(reply.status, 403);
      })
    );
  }
);
