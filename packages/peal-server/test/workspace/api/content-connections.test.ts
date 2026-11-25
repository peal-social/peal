// The connection of each write that joined the journal (to an article, a
// signature, a feed, a rule that publishes a follow-up or repeats a post, a
// queue's reshuffle, a file the assistant makes into the media library, a
// transcript saved as a description) is kept as a post's is: once the
// request is answered without an error, whatever signed it in, and never
// for one refused or failed, nor for one whose handler said it changed no
// content. Each operation is the contract's own, read by reflection, sent
// through the API's Authentication with what it needs faked.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Ref } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApi } from "effect/http-api";
import type { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";
import { Api, Authentication, workspaceHeader } from "peal-contract";

import { changesNoContent, changesNothing } from "#shared/api/change-mark.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
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
  "automations.feeds.create",
  "automations.feeds.delete",
  "automations.feeds.update",
  "automations.followUps.approve",
  "automations.followUps.create",
  "automations.followUps.delete",
  "automations.followUps.update",
  "automations.queues.reshuffle",
  "automations.recycling.create",
  "automations.recycling.delete",
  "automations.recycling.resume",
  "automations.recycling.update",
  "media.images.create",
  "media.slideshows.create",
  "media.slideshows.createFromEdit",
  "media.transcriptions.create",
  "media.videos.create",
  "media.voiceovers.create",
  "posts.signatures.create",
  "posts.signatures.delete",
  "posts.signatures.update",
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

// The key's own workspace, and another one a request may name.
const workspaceId = WorkspaceIdSchema.make(
  "0195d2c0-0000-7000-8000-0000000000b1"
);

const elsewhere = WorkspaceIdSchema.make(
  "0195d2c0-0000-7000-8000-0000000000b3"
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

// What the handler does: answer; answer, having said the request changed
// no content (a transcript not saved) or nothing at all (a dry run);
// answer a refusal (an error the API encoded); or fail.
const answer = (status: number) =>
  Effect.succeed(HttpServerResponse.empty({ status }));

const handlers = {
  answered: answer(201),
  failed: Effect.die(new Error("A synthetic failure of the handler")),
  noContent: changesNoContent.pipe(Effect.andThen(answer(200))),
  nothing: changesNothing.pipe(Effect.andThen(answer(200))),
  refused: answer(409),
};

type Outcome = keyof typeof handlers;

const handlerFor = (outcome: Outcome) => handlers[outcome];

// The workspace a key acts in by default: its own, so it names none.
const namedBy = (access: Access | "nobody"): Option.Option<WorkspaceId> =>
  access === "apiKey" ? Option.none() : Option.some(workspaceId);

// A request to the operation through Authentication, signed in as `access`
// says, or with no credential at all, naming the workspace `named` gives.
const send = (
  { endpoint, group }: Operation,
  access: Access | "nobody",
  outcome: Outcome,
  named: Option.Option<WorkspaceId> = namedBy(access)
) =>
  Effect.gen(function* sending() {
    const kept = yield* Ref.make<readonly ContentChange[]>([]);

    const authentication = yield* Authentication.pipe(
      Effect.provide(authenticationKeeping(kept))
    );

    const sent = {
      origin: "http://localhost:3001",
      "x-forwarded-for": "203.0.113.9",
    };

    const naming = Option.match(named, {
      onNone: () => sent,
      onSome: (id) => ({ ...sent, [workspaceHeader]: id }),
    });

    // Only a session sends cookies.
    const headers =
      access === "session" ? { ...naming, cookie: sessionCookie } : naming;

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

    return (yield* Ref.get(kept)).map((change) => ({
      access: change.access,
      apiKeyId: Option.getOrNull(change.apiKeyId),
      userId: Option.getOrNull(change.userId),
      workspaceId: Option.getOrNull(change.workspaceId),
    }));
  });

const accesses: readonly Access[] = ["session", "apiKey", "oauth"];

// The one connection an answered write keeps, in `kept`'s workspace.
const keptAs = (access: Access, kept: WorkspaceId) => [
  {
    access,
    apiKeyId: access === "apiKey" ? "synthetic-key" : null,
    userId: access === "apiKey" ? null : userId,
    workspaceId: kept,
  },
];

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
            assert.deepStrictEqual(
              yield* send(operation, access, "answered"),
              keptAs(access, workspaceId),
              `${operation.name} through ${access}`
            );
          }
        }
      })
  );

  it.effect(
    "keeps a key's own workspace, and the workspace a person's request names",
    () =>
      Effect.gen(function* workspaces() {
        for (const operation of operations) {
          // A key acts in its own workspace, whatever the request names.
          assert.deepStrictEqual(
            yield* send(
              operation,
              "apiKey",
              "answered",
              Option.some(elsewhere)
            ),
            keptAs("apiKey", workspaceId),
            `${operation.name} through a key naming another workspace`
          );

          for (const access of ["session", "oauth"] as const) {
            assert.deepStrictEqual(
              yield* send(
                operation,
                access,
                "answered",
                Option.some(elsewhere)
              ),
              keptAs(access, elsewhere),
              `${operation.name} through ${access} naming another workspace`
            );
          }
        }
      })
  );

  it.effect(
    "keeps none for a write refused, failed, that changed no content or not signed in",
    () =>
      Effect.gen(function* notKept() {
        for (const operation of operations) {
          for (const access of accesses) {
            for (const outcome of [
              "refused",
              "failed",
              "noContent",
              "nothing",
            ] as const) {
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
