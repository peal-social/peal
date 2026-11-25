import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, Forbidden, forWorkspace } from "peal-contract";
import type { Member } from "peal-contract";

import { FollowUpsHandlers } from "#publishing/api/follow-ups/follow-ups.ts";
import { freshWorkspace, memberOf } from "#test/channels/support.ts";
import { onPostsServerAt } from "#test/publishing/posts-server.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// Where follow-up rules act on this server, through the API: what the web
// app's post page offers Follow up from. The test server sends every
// later part and counts every platform's likes.

const timeout = 60_000;

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["automations.followUps"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        FollowUpsHandlers.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

describe("where follow-up rules act, through the API", () => {
  it.effect(
    "answers every platform once, kind by kind, beside the rules' own paths",
    () =>
      onPostsServerAt(
        "2026-07-06T07:00:00Z",
        Effect.gen(function* answers() {
          const workspaceId = yield* freshWorkspace;

          const viewer = yield* clientAs(
            memberOf(workspaceId, permissionsFor("viewer"))
          );

          const answered = yield* viewer["automations.followUps"].platforms({
            headers: forWorkspace(workspaceId),
          });

          const byPlatform = new Map(
            answered.map(({ platform, ...support }) => [platform, support])
          );

          assert.deepStrictEqual(
            {
              bluesky: byPlatform.get("bluesky"),
              linkedin: byPlatform.get("linkedin"),
              threads: byPlatform.get("threads"),
              x: byPlatform.get("x"),
              youtube: byPlatform.get("youtube"),
            },
            {
              bluesky: { comment: "available", repost: "available" },
              linkedin: { comment: "notAllowed", repost: "notAllowed" },
              threads: { comment: "review", repost: "notBuilt" },
              x: { comment: "available", repost: "notBuilt" },
              youtube: { comment: "notBuilt", repost: "noApi" },
            }
          );
          assert.strictEqual(answered.length, byPlatform.size);
        })
      ),
    timeout
  );

  it.effect(
    "refuses a member who may not read posts",
    () =>
      onPostsServerAt(
        "2026-07-06T07:00:00Z",
        Effect.gen(function* refuses() {
          const workspaceId = yield* freshWorkspace;

          const outsider = yield* clientAs(memberOf(workspaceId, []));

          const refused = yield* outsider["automations.followUps"]
            .platforms({ headers: forWorkspace(workspaceId) })
            .pipe(Effect.flip);

          assert.instanceOf(refused, Forbidden);
        })
      ),
    timeout
  );
});
