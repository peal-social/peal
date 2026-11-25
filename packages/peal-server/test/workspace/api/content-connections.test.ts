// The connection of each write to an article, to a rule that publishes a
// follow-up or repeats a post, or to a file the assistant makes into the
// media library is kept as a post's is: once the request is answered
// without an error, whatever signed it in, and never for one refused or
// failed. Each operation is the contract's own, read by reflection, sent
// through the API's Authentication with what it needs faked.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Ref } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApi } from "effect/http-api";
import type { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";
import { Api, Authentication, workspaceHeader } from "peal-contract";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { AuthenticationLive } from "#workspace/api/security.ts";
import { Authenticate } from "#workspace/application/authenticate.ts";
import { BrowserSessions } from "#workspace/application/browser-sessions.ts";
import { ConnectionJournal } from "#workspace/application/connection-journal.ts";
import type { ContentChange } from "#workspace/application/connection-journal.ts";
import { ImpersonationGuard } from "#workspace/application/impersonation-guard.ts";
import { RequestLimits } from "#workspace/application/request-limits.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";

// The writes that joined the journal, by operation.
const joined = [
  "articles.create",
  "articles.delete",
  "articles.retry",
  "articles.schedule",
  "articles.unpublish",
  "articles.unschedule",
  "articles.update",
  "articles.updateOnSite",
  "automations.followUps.approve",
  "automations.followUps.create",
  "automations.followUps.delete",
  "automations.followUps.update",
  "automations.recycling.create",
  "automations.recycling.delete",
  "automations.recycling.resume",
  "automations.recycling.update",
  "media.images.create",
  "media.slideshows.create",
  "media.slideshows.createFromEdit",
  "media.videos.create",
  "media.voiceovers.create",
];

interface Operation {
  readonly endpoint: HttpApiEndpoint.Top;
  readonly group: HttpApiGroup.Top;
  readonly name: string;
}

const operations: Operation[] = [];

HttpApi.reflect(Api, {
  onEndpoint: ({ endpoint, group }) => {
    const name = `${group.identifier}.${endpoint.identifier}`;

    if (joined.includes(name)) {
      operations.push({ endpoint, group, name });
    }
  },
  onGroup: () => {
    // Only endpoints matter.
  },
});

const workspaceId = WorkspaceIdSchema.make(
  "0195d2c0-0000-7000-8000-0000000000b1"
);

const userId = UserIdSchema.make("0195d2c0-0000-7000-8000-0000000000b2");

const sessionCookie = "peal.session_token=synthetic-session";
const apiKey = "peal_synthetic_api_key";
const oauthToken = "synthetic-oauth-access-token";

// Who each credential is: a person in their session, a key of the
// workspace, or the command line acting for the person.
const AuthenticateTest = Layer.succeed(
  Authenticate,
  Authenticate.of({
    apiKey: () => Effect.die("The API's middleware reads keys as bearers"),
    bearer: (token) =>
      Effect.succeed(
        Redacted.value(token) === apiKey
          ? new ApiKeyPrincipal({
              apiKeyId: "synthetic-key",
              permissions: ["post:create"],
              workspaceId,
            })
          : new UserPrincipal({
              impersonatedBy: Option.none(),
              oauth: Option.some({
                clientId: "peal-cli",
                scopes: ["workspace:write"],
                workspaceId: Option.none(),
              }),
              userId,
            })
      ),
    isTrustedOrigin: () => true,
    mcp: () => Effect.die("The API's middleware never reads MCP requests"),
    session: () =>
      Effect.succeed(
        new UserPrincipal({ impersonatedBy: Option.none(), userId })
      ),
  })
);

// The API's Authentication, whose journal adds what it is given to `kept`.
const authenticationKeeping = (kept: Ref.Ref<readonly ContentChange[]>) =>
  AuthenticationLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        AuthenticateTest,
        RequestLimits.unlimited,
        Layer.succeed(
          BrowserSessions,
          BrowserSessions.of({ joined: () => Effect.succeedNone })
        ),
        Layer.succeed(
          ImpersonationGuard,
          ImpersonationGuard.of({
            admit: () => Effect.void,
            changed: () => Effect.void,
            stopped: () => Effect.void,
          })
        ),
        Layer.succeed(
          ConnectionJournal,
          ConnectionJournal.of({
            contentChanged: (change) =>
              Ref.update(kept, (changes) => [...changes, change]),
          })
        )
      )
    )
  );

type Access = ContentChange["access"];

// What the handler does: answer, answer a refusal (an error the API
// encoded), or fail.
type Outcome = "answered" | "failed" | "refused";

const handlerFor = (outcome: Outcome) => {
  if (outcome === "failed") {
    return Effect.die(new Error("A synthetic failure of the handler"));
  }

  return Effect.succeed(
    HttpServerResponse.empty({ status: outcome === "answered" ? 201 : 409 })
  );
};

// A request to the operation through Authentication, signed in as `access`
// says, or with no credential at all.
const send = (
  { endpoint, group }: Operation,
  access: Access | "nobody",
  outcome: Outcome
) =>
  Effect.gen(function* sending() {
    const kept = yield* Ref.make<readonly ContentChange[]>([]);

    const authentication = yield* Authentication.pipe(
      Effect.provide(authenticationKeeping(kept))
    );

    const sent = {
      origin: "http://localhost:3001",
      [workspaceHeader]: workspaceId,
      "x-forwarded-for": "203.0.113.9",
    };

    // Only a session sends cookies.
    const headers =
      access === "session" ? { ...sent, cookie: sessionCookie } : sent;

    const request = HttpServerRequest.fromWeb(
      new Request(`http://localhost:3001${endpoint.path}`, {
        headers,
        method: endpoint.method,
      })
    );

    const handler = handlerFor(outcome);

    const answered =
      access === "session" || access === "nobody"
        ? authentication.session(handler, {
            credential: Redacted.make("synthetic-session"),
            endpoint,
            group,
          })
        : authentication.bearer(handler, {
            credential: Redacted.make(
              access === "apiKey" ? apiKey : oauthToken
            ),
            endpoint,
            group,
          });

    yield* answered.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provideService(HttpRouter.RouteContext, {
        params: {},
        route: HttpRouter.route("*", "*", handler),
      }),
      Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
      Effect.scoped,
      Effect.exit
    );

    return yield* Ref.get(kept);
  });

const accesses: readonly Access[] = ["session", "apiKey", "oauth"];

describe("the connections kept of the writes that joined the journal", () => {
  it("finds every one of them in the contract", () => {
    assert.deepStrictEqual(
      operations.map(({ name }) => name).toSorted(),
      joined.toSorted()
    );
  });

  it.effect(
    "keeps one connection for each answered write, with how it signed in",
    () =>
      Effect.gen(function* answered() {
        for (const operation of operations) {
          for (const access of accesses) {
            const changes = yield* send(operation, access, "answered");

            assert.deepStrictEqual(
              changes.map((change) => ({
                access: change.access,
                apiKeyId: Option.getOrNull(change.apiKeyId),
                userId: Option.getOrNull(change.userId),
                workspaceId: Option.getOrNull(change.workspaceId),
              })),
              [
                {
                  access,
                  apiKeyId: access === "apiKey" ? "synthetic-key" : null,
                  userId: access === "apiKey" ? null : userId,
                  workspaceId,
                },
              ],
              `${operation.name} through ${access}`
            );
          }
        }
      })
  );

  it.effect("keeps none for a write refused, failed or not signed in", () =>
    Effect.gen(function* notKept() {
      for (const operation of operations) {
        for (const access of accesses) {
          for (const outcome of ["refused", "failed"] as const) {
            assert.deepStrictEqual(
              yield* send(operation, access, outcome),
              [],
              `${operation.name} ${outcome} through ${access}`
            );
          }
        }

        assert.deepStrictEqual(
          yield* send(operation, "nobody", "answered"),
          [],
          `${operation.name} without a credential`
        );
      }
    })
  );
});
