// The in-memory server names a request's workspace as the server does: the
// `Peal-Workspace` header, a blank one naming nothing, else the key's own.
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { workspaceHeader } from "peal-contract";

import { draftingKey } from "./signed-in.ts";
import { makeStudio, shopId, studioMe } from "./studio.ts";
import { inMemoryServer } from "./support.ts";

// The status the in-memory server answers a key's read of the tags with,
// the header set to `workspace` when given.
const statusWith = (workspace?: string) =>
  Effect.gen(function* status() {
    const studio = yield* makeStudio(studioMe, [draftingKey]);

    return yield* Effect.gen(function* sent() {
      const client = yield* HttpClient.HttpClient;

      const request = HttpClientRequest.get(
        "http://localhost:3000/api/v1/tags"
      ).pipe(HttpClientRequest.bearerToken(draftingKey.key));

      const response = yield* client.execute(
        workspace === undefined
          ? request
          : HttpClientRequest.setHeader(request, workspaceHeader, workspace)
      );

      return response.status;
    }).pipe(
      // The fetch the client reads when each request runs.
      Effect.provide(inMemoryServer(Effect.void, undefined, studio))
    );
  }).pipe(Effect.scoped);

describe("the in-memory server's workspace of a request", () => {
  it.effect("answers a key as the server does", () =>
    Effect.gen(function* answers() {
      assert.deepStrictEqual(
        [
          yield* statusWith(),
          yield* statusWith(""),
          yield* statusWith("  "),
          yield* statusWith(draftingKey.workspaceId),
          yield* statusWith(shopId),
          yield* statusWith("studio"),
        ],
        [200, 200, 200, 200, 403, 404]
      );
    })
  );
});
