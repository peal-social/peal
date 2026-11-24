// The workspace a request acts in, for every kind of credential: the one
// its `Peal-Workspace` header names, else the credential's own, else none,
// which is refused. A header goes through the checks a workspace in the
// path went through, with the same answers.
import { assert, layer } from "@effect/vitest";
import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { workspaceHeader } from "peal-contract";

import { authorize, registeredClient } from "#test/app/mcp-support.ts";
import { commandLineToken } from "#test/workspace/support.ts";

import {
  apiKeyOf,
  bodyOf,
  MigratedSqlLive,
  origin,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "./harness.ts";
import { bearer, customerOf, keyOf, partnerOf } from "./partner-support.ts";

interface Fixture {
  /** An OAuth token of an application, bound to `workspaceId`. */
  readonly boundToken: string;
  /** The command line's token, bound to no workspace. */
  readonly commandLineToken: string;
  /** A workspace the partner made for a customer. */
  readonly customerId: string;
  /** The home workspace of the partner account. */
  readonly homeId: string;
  /** An API key of `workspaceId` with post:read. */
  readonly key: string;
  /** A workspace the owner does not belong to. */
  readonly otherWorkspaceId: string;
  readonly ownerCookies: string;
  readonly partnerKey: string;
  readonly workspaceId: string;
}

class Matrix extends Context.Service<Matrix, Fixture>()(
  "peal-server/test/RequestWorkspaceMatrix"
) {}

const MatrixLive = Layer.effect(
  Matrix,
  Effect.gen(function* matrix() {
    const sql = yield* SqlClient.SqlClient;
    const owner = yield* signedUpUnconfirmed("request-workspace");
    const outsider = yield* signedUpUnconfirmed("request-elsewhere");
    const workspaceId = yield* workspaceOf(owner, "Studio");
    const otherWorkspaceId = yield* workspaceOf(outsider, "Elsewhere");

    const { key } = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

    const clientId = yield* registeredClient;

    // An application the operator linked to the HTTP API, beside the MCP
    // endpoint it registered for.
    yield* sql`INSERT INTO auth.oauth_client_resource (client_id, resource_id, created_at) VALUES (${clientId}, ${`${origin}/api`}, now())`;

    const boundToken = yield* authorize(
      owner,
      clientId,
      workspaceId,
      "workspace:read",
      `${origin}/api`
    );

    const partner = yield* partnerOf("request-partner");
    const { key: partnerKey } = yield* keyOf(partner.owner, partner.home);
    const customer = yield* customerOf(partnerKey, "Customer");

    return {
      boundToken,
      commandLineToken: yield* commandLineToken(owner.cookies),
      customerId: customer.id,
      homeId: partner.home,
      key,
      otherWorkspaceId,
      ownerCookies: owner.cookies,
      partnerKey,
      workspaceId,
    };
  })
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      TestApp.layerWith({
        ...unconfirmedEmails,
        // An application that registers itself, to be bound to a workspace.
        MCP_DYNAMIC_REGISTRATION: "true",
        PEAL_PARTNER_SELF_SERVICE: "true",
      }),
      MigratedSqlLive
    )
  )
);

const naming = (workspaceId: string) => ({ [workspaceHeader]: workspaceId });

interface Case {
  readonly expected: number;
  readonly headers: (fixture: Fixture) => Record<string, string>;
  readonly name: string;
}

const cases: readonly Case[] = [
  {
    expected: 400,
    headers: (fixture) => ({ cookie: fixture.ownerCookies }),
    name: "a session that names no workspace",
  },
  {
    expected: 200,
    headers: (fixture) => ({
      cookie: fixture.ownerCookies,
      ...naming(fixture.workspaceId),
    }),
    name: "a session that names its member's workspace",
  },
  {
    expected: 404,
    headers: (fixture) => ({
      cookie: fixture.ownerCookies,
      ...naming(fixture.otherWorkspaceId),
    }),
    name: "a session that names a workspace its user is not a member of",
  },
  {
    expected: 404,
    headers: (fixture) => ({
      cookie: fixture.ownerCookies,
      ...naming("studio"),
    }),
    name: "a session that names something that is no workspace id",
  },
  {
    expected: 200,
    headers: (fixture) => bearer(fixture.key),
    name: "an API key that names no workspace",
  },
  {
    expected: 200,
    headers: (fixture) => ({
      ...bearer(fixture.key),
      ...naming(fixture.workspaceId),
    }),
    name: "an API key that names its own workspace",
  },
  {
    expected: 403,
    headers: (fixture) => ({
      ...bearer(fixture.key),
      ...naming(fixture.otherWorkspaceId),
    }),
    name: "an API key that names another workspace",
  },
  {
    expected: 200,
    headers: (fixture) => bearer(fixture.boundToken),
    name: "a token bound to a workspace that names none",
  },
  {
    expected: 200,
    headers: (fixture) => ({
      ...bearer(fixture.boundToken),
      ...naming(fixture.workspaceId),
    }),
    name: "a token bound to a workspace that names it",
  },
  {
    expected: 403,
    headers: (fixture) => ({
      ...bearer(fixture.boundToken),
      ...naming(fixture.otherWorkspaceId),
    }),
    name: "a token bound to a workspace that names another",
  },
  {
    expected: 400,
    headers: (fixture) => bearer(fixture.commandLineToken),
    name: "the command line's token that names no workspace",
  },
  {
    expected: 200,
    headers: (fixture) => ({
      ...bearer(fixture.commandLineToken),
      ...naming(fixture.workspaceId),
    }),
    name: "the command line's token that names its user's workspace",
  },
  {
    expected: 404,
    headers: (fixture) => ({
      ...bearer(fixture.commandLineToken),
      ...naming(fixture.otherWorkspaceId),
    }),
    name: "the command line's token that names another workspace",
  },
  {
    expected: 400,
    headers: (fixture) => bearer(fixture.partnerKey),
    name: "a partner key that names no workspace",
  },
  {
    expected: 200,
    headers: (fixture) => ({
      ...bearer(fixture.partnerKey),
      ...naming(fixture.customerId),
    }),
    name: "a partner key that names a customer's workspace",
  },
  {
    expected: 404,
    headers: (fixture) => ({
      ...bearer(fixture.partnerKey),
      ...naming(fixture.homeId),
    }),
    name: "a partner key that names its home workspace",
  },
];

const RequiredSchema = Schema.Struct({
  _tag: Schema.Literal("WorkspaceRequired"),
  code: Schema.Literal("workspace_required"),
  message: Schema.String,
  requestId: Schema.String,
});

layer(MatrixLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "the workspace a request acts in",
  (it) => {
    it.effect.each(cases)(
      "answers $expected to $name",
      ({ expected, headers }) =>
        Effect.gen(function* answers() {
          const app = yield* TestApp;
          const fixture = yield* Matrix;

          const reply = yield* app.request("/api/v1/tags", {
            headers: headers(fixture),
          });

          assert.strictEqual(
            reply.status,
            expected,
            JSON.stringify(reply.body)
          );
        })
    );

    it.effect("tells a request that names no workspace how to name one", () =>
      Effect.gen(function* required() {
        const app = yield* TestApp;
        const fixture = yield* Matrix;

        const refused = yield* bodyOf(
          RequiredSchema,
          yield* app.request("/api/v1/tags", {
            headers: { cookie: fixture.ownerCookies },
          })
        );

        assert.include(refused.message, "Peal-Workspace");
      })
    );

    it.effect("acts in the workspace the header names", () =>
      Effect.gen(function* acts() {
        const app = yield* TestApp;
        const fixture = yield* Matrix;

        const made = yield* app.request("/api/v1/tags", {
          body: { colour: "blue", name: "Launch" },
          headers: {
            cookie: fixture.ownerCookies,
            ...naming(fixture.workspaceId),
          },
        });

        assert.strictEqual(made.status, 201, JSON.stringify(made.body));

        const TagsSchema = Schema.Array(Schema.Struct({ name: Schema.String }));

        const mine = yield* bodyOf(
          TagsSchema,
          yield* app.request("/api/v1/tags", { headers: bearer(fixture.key) })
        );

        const theirs = yield* bodyOf(
          TagsSchema,
          yield* app.request("/api/v1/tags", {
            headers: {
              ...bearer(fixture.partnerKey),
              ...naming(fixture.customerId),
            },
          })
        );

        assert.deepStrictEqual(
          mine.map(({ name }) => name),
          ["Launch"]
        );
        assert.deepStrictEqual(theirs, []);
      })
    );
  }
);
