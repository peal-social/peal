import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, Forbidden, forWorkspace } from "peal-contract";
import type { Member } from "peal-contract";

import { InboxRulesApiLive } from "#engagement/container.ts";
import { freshWorkspace, memberOf } from "#test/channels/support.ts";
import { RulesTest } from "#test/engagement/rule-world.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// Where comment rules answer on this server, through the API: what the
// web app's form offers channels from. The rules' world reads Facebook's
// and Instagram's comments and messages.

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["automations.commentRules"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        InboxRulesApiLive.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

describe("where comment rules answer, through the API", () => {
  it.live("answers every platform, beside the rules' own paths", () =>
    Effect.gen(function* answers() {
      const workspaceId = yield* freshWorkspace;
      const headers = forWorkspace(workspaceId);

      const viewer = yield* clientAs(
        memberOf(workspaceId, permissionsFor("viewer"))
      );

      const answered = yield* viewer["automations.commentRules"].platforms({
        headers,
      });

      const byPlatform = new Map(
        answered.map(({ platform, ...support }) => [platform, support])
      );

      assert.deepStrictEqual(
        {
          bluesky: byPlatform.get("bluesky"),
          facebook: byPlatform.get("facebook"),
          instagram: byPlatform.get("instagram"),
          mastodon: byPlatform.get("mastodon"),
          youtube: byPlatform.get("youtube"),
        },
        {
          bluesky: { privateReply: "noApi", reply: "notAllowed" },
          facebook: { privateReply: "available", reply: "available" },
          instagram: { privateReply: "available", reply: "available" },
          mastodon: { privateReply: "noApi", reply: "available" },
          youtube: { privateReply: "noApi", reply: "notAllowed" },
        }
      );
      assert.strictEqual(answered.length, new Set(byPlatform.keys()).size);
    }).pipe(Effect.provide(RulesTest))
  );

  it.live("refuses a member who may not read the inbox", () =>
    Effect.gen(function* refuses() {
      const workspaceId = yield* freshWorkspace;

      const outsider = yield* clientAs(memberOf(workspaceId, []));

      const refused = yield* outsider["automations.commentRules"]
        .platforms({ headers: forWorkspace(workspaceId) })
        .pipe(Effect.flip);

      assert.instanceOf(refused, Forbidden);
    }).pipe(Effect.provide(RulesTest))
  );
});
