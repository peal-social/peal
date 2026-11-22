import {
  ByteSize,
  Clock,
  Context,
  Duration,
  Effect,
  Layer,
  Metric,
  Option,
  Schedule,
  Schema,
} from "effect";
import {
  HttpEffect,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { CurrentMember } from "peal-contract";
import type { Principal } from "peal-contract";

/**
 * How many sessions of the sessionful revisions one credential keeps open
 * at once: a person's, whichever clients they connected, or a key's. A
 * session past them ends the credential's longest unused one.
 */
export const sessionsPerCredential = 16;

/** How long a session is kept unused before it is ended. */
export const sessionIdleLimit = Duration.hours(1);

/** How often the sessions unused past the limit are looked for. */
export const sessionSweepEvery = Duration.minutes(1);

/**
 * The largest `initialize` the endpoint takes: the server keeps what it
 * says for the whole session, and a client's says little.
 */
export const maxInitializeBytes = ByteSize.kibibytes(64);

const sessionHeader = "mcp-session-id";

/**
 * The sessions Peal ended itself, by `reason` (`idle`, `pastLimit`) and
 * `outcome` (`ended`, or `failed` when the endpoint's DELETE did not end
 * it, which leaves it in memory until the server restarts).
 */
export const endedSessions = Metric.counter("peal.mcp.sessions.ended", {
  description: "Sessions of the MCP endpoint the server ended itself",
  incremental: true,
});

type EndReason = "idle" | "pastLimit";

/** A session of the sessionful revisions, as Peal keeps track of it. */
export interface OpenSession {
  readonly id: string;
  /** Whose it is: the credential that opened it (`ownerOf`). */
  readonly owner: string;
  /** When it was last used, in milliseconds since the epoch. */
  readonly lastUsed: number;
}

/**
 * Whose a session is: a person, whichever application they connected,
 * so registering more clients opens no more sessions; or a key.
 */
export const ownerOf = (principal: Principal): string => {
  switch (principal._tag) {
    case "user": {
      return `user:${principal.userId}`;
    }

    case "apiKey": {
      return `key:${principal.apiKeyId}`;
    }

    case "partnerKey": {
      return `partner-key:${principal.partnerKeyId}`;
    }
  }
};

/** The sessions unused for longer than the limit, at `now`. */
export const idleSessions = (
  sessions: readonly OpenSession[],
  now: number
): readonly OpenSession[] =>
  sessions.filter(
    ({ lastUsed }) => now - lastUsed > Duration.toMillis(sessionIdleLimit)
  );

/**
 * The sessions of an owner past `sessionsPerCredential`, least recently
 * used first: those to end so the owner keeps as many as it may.
 */
export const sessionsPastLimit = (
  sessions: readonly OpenSession[],
  owner: string
): readonly OpenSession[] => {
  const owned = sessions
    .filter((session) => session.owner === owner)
    .toSorted((a, b) => a.lastUsed - b.lastUsed);

  return owned.slice(0, Math.max(0, owned.length - sessionsPerCredential));
};

/**
 * The sessions the MCP endpoint keeps open, and how one is ended: through
 * the endpoint's own DELETE, run in the process (`SessionEndingRouter`),
 * which frees what effect/ai keeps of it.
 */
export class McpSessions extends Context.Service<
  McpSessions,
  {
    /** Ends a session, as its client's DELETE would. */
    readonly end: (id: string, reason: EndReason) => Effect.Effect<void>;
    /** Takes the router a session's DELETE is answered on. */
    readonly endOn: (router: HttpRouter.HttpRouter) => void;
    readonly forget: (id: string) => Effect.Effect<void>;
    readonly open: (id: string, owner: string) => Effect.Effect<void>;
    /** Whether the owner holds the session, which counts as using it. */
    readonly use: (id: string, owner: string) => Effect.Effect<boolean>;
  }
>()("peal-server/app/mcp/McpSessions") {
  /** The sessions, and the sweep that ends those unused too long. */
  static readonly layer = Layer.effect(
    McpSessions,
    Effect.gen(function* McpSessionsLive() {
      const sessions = new Map<string, OpenSession>();
      let ending = Option.none<HttpRouter.HttpRouter>();

      const end = (id: string, reason: EndReason) =>
        Effect.gen(function* ended() {
          sessions.delete(id);

          const request = HttpServerRequest.fromWeb(
            new Request("http://localhost/api/mcp", {
              headers: { [sessionHeader]: id },
              method: "DELETE",
            })
          );

          const status = yield* Option.match(ending, {
            onNone: () => Effect.succeed(0),
            onSome: (router) =>
              router.asHttpEffect().pipe(
                Effect.provideService(
                  HttpServerRequest.HttpServerRequest,
                  request
                ),
                Effect.scoped,
                Effect.map(({ status: answered }) => answered),
                Effect.orElseSucceed(() => 0)
              ),
          });

          // 404: the client ended it meanwhile.
          const outcome = status === 204 || status === 404 ? "ended" : "failed";

          if (outcome === "failed") {
            yield* Effect.logWarning("Could not end an MCP session").pipe(
              Effect.annotateLogs({ "http.status": status, reason })
            );
          }

          yield* Metric.update(
            Metric.withAttributes(endedSessions, { outcome, reason }),
            1
          );
        });

      const open = (id: string, owner: string) =>
        Effect.gen(function* opened() {
          sessions.set(id, {
            id,
            lastUsed: yield* Clock.currentTimeMillis,
            owner,
          });

          for (const past of sessionsPastLimit([...sessions.values()], owner)) {
            yield* end(past.id, "pastLimit");
          }
        });

      const use = (id: string, owner: string) =>
        Effect.gen(function* used() {
          const session = sessions.get(id);

          if (session?.owner !== owner) {
            return false;
          }

          sessions.set(id, {
            ...session,
            lastUsed: yield* Clock.currentTimeMillis,
          });

          return true;
        });

      const sweep = Effect.gen(function* sweep() {
        const now = yield* Clock.currentTimeMillis;

        for (const idle of idleSessions([...sessions.values()], now)) {
          yield* end(idle.id, "idle");
        }
      });

      yield* sweep.pipe(
        Effect.repeat(Schedule.spaced(sessionSweepEvery)),
        Effect.forkScoped
      );

      return McpSessions.of({
        end,
        endOn: (router) => {
          ending = Option.some(router);
        },
        forget: (id) =>
          Effect.sync(() => {
            sessions.delete(id);
          }),
        open,
        use,
      });
    })
  );
}

// Where HttpRouter keeps the route middlewares a route is added with, in
// the context of `add`: a route added without them answers as its handler
// alone does. mcp.test.ts fails (`peal.mcp.sessions.ended` counts
// `failed`) if a release of Effect keeps them elsewhere.
const routeMiddlewarePrefix = "effect/http/HttpRouter/Middleware-";

const withoutRouteMiddlewares = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.updateContext((context: Context.Context<R>) =>
      Context.makeUnsafe<R>(
        new Map(
          [...context.mapUnsafe].filter(
            ([key]) => !key.startsWith(routeMiddlewarePrefix)
          )
        )
      )
    )
  );

/**
 * The router the MCP endpoint adds its routes to: the server's, which also
 * hands its DELETE route to a router of its own, without the middlewares
 * (no credential, no session guard), on which `McpSessions` ends a session
 * in the process.
 */
export const SessionEndingRouter = Layer.effect(
  HttpRouter.HttpRouter,
  Effect.gen(function* sessionEndingRouter() {
    const router = yield* HttpRouter.HttpRouter;
    const sessions = yield* McpSessions;
    const own = yield* HttpRouter.make;

    sessions.endOn(own);

    return HttpRouter.HttpRouter.of({
      ...router,
      add: (method, path, handler, options) =>
        method === "DELETE"
          ? router
              .add(method, path, handler, options)
              .pipe(
                Effect.andThen(
                  withoutRouteMiddlewares(
                    own.add(method, path, handler, options)
                  )
                )
              )
          : router.add(method, path, handler, options),
    });
  })
);

const InitializeSchema = Schema.fromJsonString(
  Schema.Struct({ method: Schema.Literal("initialize") })
);

const decodeInitialize = Schema.decodeUnknownOption(InitializeSchema);

const jsonRpcError = (status: number, message: string) =>
  HttpServerResponse.jsonUnsafe(
    { error: { code: -32_000, message }, id: null, jsonrpc: "2.0" },
    { status }
  );

/**
 * The sessions of the sessionful revisions, request by request, after
 * `mcpAuthentication`: a session is its opener's alone (404 to anyone
 * else, as to a session that ended), each use keeps it open, a DELETE
 * ends it, an `initialize` larger than `maxInitializeBytes` is refused,
 * and a credential that opens one past `sessionsPerCredential` ends its
 * longest unused one.
 */
export const mcpSessionGuard = HttpRouter.middleware(
  Effect.gen(function* mcpSessionGuardLive() {
    const sessions = yield* McpSessions;

    return (httpEffect) =>
      Effect.gen(function* guarded() {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { principal } = yield* CurrentMember;
        const owner = ownerOf(principal);
        const sessionId = request.headers[sessionHeader];

        if (sessionId !== undefined) {
          if (!(yield* sessions.use(sessionId, owner))) {
            return HttpServerResponse.empty({ status: 404 });
          }

          const response = yield* httpEffect;

          if (request.method === "DELETE" && response.status === 204) {
            yield* sessions.forget(sessionId);
          }

          return response;
        }

        if (request.method === "POST") {
          const body = yield* request.text.pipe(Effect.orElseSucceed(() => ""));

          if (
            new TextEncoder().encode(body).length >
              ByteSize.toNumberUnsafe(maxInitializeBytes) &&
            Option.isSome(decodeInitialize(body))
          ) {
            return jsonRpcError(
              413,
              "An initialize request this large is refused: send the client's information and capabilities alone."
            );
          }
        }

        const response = yield* httpEffect;

        // effect/ai names a new session in a header it adds as the
        // response is sent, after this: it is read then.
        yield* HttpEffect.appendPreResponseHandler((_request, sent) =>
          Option.match(Option.fromUndefinedOr(sent.headers[sessionHeader]), {
            onNone: () => Effect.succeed(sent),
            onSome: (opened) =>
              sessions.open(opened, owner).pipe(Effect.as(sent)),
          })
        );

        return response;
      });
  })
);
