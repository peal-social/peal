import { Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { serverUrl } from "#api/server-url.ts";

// Better Auth's session, as `/get-session` answers it: null when signed
// out, the active workspace's id when one is set.
const SessionSchema = Schema.NullOr(
  Schema.Struct({
    session: Schema.Struct({
      activeOrganizationId: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  })
);

const decodeSession = Schema.decodeUnknownEffect(SessionSchema);

/**
 * The workspace Better Auth keeps active on the session these cookies sign
 * in (the one the person last made or chose), read from the server at
 * PEAL_API_URL: none when there is none, or when it does not answer within
 * 3 seconds.
 */
export const activeWorkspaceOf = (cookie: string) =>
  Effect.gen(function* activeWorkspace() {
    const client = yield* HttpClient.HttpClient;
    const base = yield* serverUrl;

    const response = yield* client.execute(
      HttpClientRequest.get(`${base}/api/auth/get-session`).pipe(
        HttpClientRequest.setHeader("cookie", cookie)
      )
    );

    const session = yield* decodeSession(yield* response.json);

    return Option.fromNullishOr(session?.session.activeOrganizationId);
  }).pipe(
    Effect.timeout("3 seconds"),
    Effect.catchCause(() => Effect.succeed(Option.none<string>())),
    Effect.provide(FetchHttpClient.layer)
  );
