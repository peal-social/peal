import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, CurrentMember, Forbidden, forWorkspace } from "peal-contract";
import type { Member } from "peal-contract";

import { InboxToolsLive } from "#app/mcp/inbox-handlers.ts";
import { InboxTools } from "#app/mcp/inbox-tools.ts";
import { CommentRules } from "#engagement/application/comment-rules.ts";
import { EngagementInbox } from "#engagement/application/engagement-inbox.ts";
import { EngagementMessages } from "#engagement/application/engagement-messages.ts";
import { EngagementReviews } from "#engagement/application/engagement-reviews.ts";
import { InboxRulesApiLive } from "#engagement/container.ts";
import { UpgradePaths } from "#shared/application/upgrade-paths.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { freshWorkspace, memberOf } from "#test/channels/support.ts";
import {
  forget,
  messagesOn,
  privateText,
  received,
  RulesTest,
  threadOn,
} from "#test/engagement/rule-world.ts";
import { securityTest } from "#workspace/api/security.ts";
import { withheldWhileImpersonating } from "#workspace/domain/membership.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// A comment rule's private text through the API and MCP, on the rules'
// own use case over Postgres: who may give one, and who may read it.

const editorOf = (workspaceId: WorkspaceId) =>
  memberOf(workspaceId, permissionsFor("editor"));

// Every member the private text is withheld from, or refused to, by why.
const othersOf = (workspaceId: WorkspaceId) => {
  const editor = editorOf(workspaceId);
  const user = editor.principal._tag === "user" ? editor.principal : undefined;

  if (user === undefined) {
    throw new Error("an editor is a user");
  }

  const application: Member = {
    ...editor,
    principal: {
      ...user,
      oauth: {
        clientId: "synthetic-client",
        scopes: ["workspace:read", "workspace:publish"],
        workspaceId,
      },
    },
  };

  const partnerKey: Member = {
    permissions: ["engagement:read", "engagement:reply"],
    principal: {
      _tag: "partnerKey",
      partnerId: "synthetic-partner",
      partnerKeyId: "synthetic-partner-key",
      permissions: ["engagement:read", "engagement:reply"],
      scopes: [],
    },
    workspaceId,
  };

  const staff: Member = {
    permissions: editor.permissions.filter(
      (permission) => !withheldWhileImpersonating.has(permission)
    ),
    principal: { ...user, impersonatedBy: user.userId },
    workspaceId,
  };

  const replier = memberOf(
    workspaceId,
    permissionsFor("editor").filter(
      (permission) => permission !== "engagement:message"
    )
  );

  return {
    application,
    partnerKey,
    replier,
    staff,
    viewer: memberOf(workspaceId, permissionsFor("viewer")),
  };
};

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["automations.commentRules"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        InboxRulesApiLive.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

// An Instagram channel whose messages are on, in the workspace.
const instagramIn = (workspaceId: WorkspaceId) =>
  threadOn(workspaceId, "instagram").pipe(
    Effect.tap((thread) => messagesOn(workspaceId, thread.channelId))
  );

const newRule = (channelId: string) => ({
  channelId,
  keywords: ["price"],
  privateReply: privateText,
  reply: "The price list is in your messages.",
});

describe("a comment rule's private text through the API", () => {
  it.live(
    "is given by who may send private replies, and read by who may read them",
    () =>
      Effect.gen(function* api() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* instagramIn(workspaceId);
          const others = othersOf(workspaceId);
          const headers = forWorkspace(workspaceId);

          const editor = yield* clientAs(editorOf(workspaceId));

          const made = yield* editor["automations.commentRules"].create({
            headers,
            payload: newRule(thread.channelId),
          });

          assert.strictEqual(made.privateReply, privateText);
          assert.deepStrictEqual(
            made.channels.map(({ privateReply }) => privateReply),
            ["available"]
          );

          // Giving one takes the messages' permission and consent.
          for (const member of [others.replier, others.application]) {
            const refused = yield* clientAs(member).pipe(
              Effect.flatMap((client) =>
                client["automations.commentRules"].create({
                  headers,
                  payload: newRule(thread.channelId),
                })
              ),
              Effect.flip
            );

            assert.instanceOf(refused, Forbidden);
          }

          // A comment it answered: its private reply waits for the public.
          yield* Effect.sleep("5 millis");
          yield* received(thread, [{ author: 1, text: "price?" }]);
          yield* CommentRules.use((rules) => rules.runDue);

          const mine = yield* editor["automations.commentRules"].get({
            headers,
            params: { ruleId: made.id },
          });

          assert.deepStrictEqual(
            mine.matches.map(({ privateCode }) => privateCode),
            ["waiting"]
          );

          // Reading it takes the messages' reading permission and consent:
          // the text, and which comments got or will get one.
          for (const member of [
            others.viewer,
            others.partnerKey,
            others.application,
          ]) {
            const client = yield* clientAs(member);

            const shown = yield* client["automations.commentRules"].get({
              headers,
              params: { ruleId: made.id },
            });

            const listed = yield* client["automations.commentRules"].list({
              headers,
              query: {},
            });

            assert.isNull(shown.privateReply);
            // That it holds one is the rule's setting, which they read.
            assert.isTrue(shown.holdsPrivateReply);
            assert.deepStrictEqual(
              shown.matches.map(
                ({ privateCode, privateReplyId, privateStatus }) => [
                  privateCode,
                  privateReplyId,
                  privateStatus,
                ]
              ),
              [[null, null, null]]
            );
            assert.deepStrictEqual(
              listed.items.map(({ privateReply }) => privateReply),
              [null]
            );
          }

          assert.instanceOf(
            yield* clientAs(others.staff).pipe(
              Effect.flatMap((client) =>
                client["automations.commentRules"].get({
                  headers,
                  params: { ruleId: made.id },
                })
              ),
              Effect.flip
            ),
            Forbidden
          );

          // Widening a rule that holds one takes the same.
          for (const member of [others.replier, others.application]) {
            const refused = yield* clientAs(member).pipe(
              Effect.flatMap((client) =>
                client["automations.commentRules"].update({
                  headers,
                  params: { ruleId: made.id },
                  payload: { keywords: ["price", "list"] },
                })
              ),
              Effect.flip
            );

            assert.instanceOf(refused, Forbidden);
          }

          const off = yield* editor["automations.commentRules"].update({
            headers,
            params: { ruleId: made.id },
            payload: { privateReply: null },
          });

          assert.isNull(off.privateReply);
          assert.isFalse(off.holdsPrivateReply);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );
});

// The inbox's other use cases, never reached by the rules' tools.
const Tools = InboxToolsLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(EngagementInbox, {}),
      Layer.mock(EngagementMessages, {}),
      Layer.mock(EngagementReviews, {}),
      UpgradePaths.layerTest
    )
  )
);

// What a client reads of a rule the tools answer.
const decodeRule = Schema.decodeUnknownSync(
  Schema.Struct({
    id: Schema.String,
    privateReply: Schema.NullOr(Schema.String),
  })
);

const decodeRules = Schema.decodeUnknownSync(
  Schema.Struct({
    rules: Schema.Array(
      Schema.Struct({ privateReply: Schema.NullOr(Schema.String) })
    ),
  })
);

const calledAs = <A, E, R>(
  member: Member,
  handled: Effect.Effect<Stream.Stream<A, E, R>, E, R>
) =>
  handled.pipe(
    Effect.flatMap((stream) => Stream.runCollect(stream)),
    Effect.provideService(CurrentMember, member)
  );

describe("a comment rule's private text through MCP", () => {
  it.live(
    "is given by who may send private replies, and read by who may read them",
    () =>
      Effect.gen(function* mcp() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* instagramIn(workspaceId);
          const others = othersOf(workspaceId);
          const tools = yield* InboxTools;

          const [started] = yield* calledAs(
            editorOf(workspaceId),
            tools.handle("start_comment_rule", newRule(thread.channelId))
          );

          const made = decodeRule(started?.encodedResult);

          assert.strictEqual(made.privateReply, privateText);

          const refusalOf = (member: Member) =>
            calledAs(
              member,
              tools.handle("start_comment_rule", newRule(thread.channelId))
            ).pipe(
              Effect.flip,
              Effect.map((error) => error.message)
            );

          assert.include(
            yield* refusalOf(others.replier),
            "may not send private replies in this workspace"
          );
          assert.include(
            yield* refusalOf(others.application),
            "synthetic-client"
          );

          assert.include(
            yield* calledAs(
              others.replier,
              tools.handle("update_comment_rule", {
                keywords: ["price", "list"],
                ruleId: made.id,
              })
            ).pipe(
              Effect.flip,
              Effect.map((error) => error.message)
            ),
            "may not send private replies in this workspace"
          );

          for (const member of [others.viewer, others.application]) {
            const [listed] = yield* calledAs(
              member,
              tools.handle("list_comment_rules", {})
            );

            assert.deepStrictEqual(
              decodeRules(listed?.encodedResult).rules.map(
                ({ privateReply }) => privateReply
              ),
              [null]
            );
          }

          const [changed] = yield* calledAs(
            editorOf(workspaceId),
            tools.handle("update_comment_rule", {
              privateReply: null,
              ruleId: made.id,
            })
          );

          assert.isNull(decodeRule(changed?.encodedResult).privateReply);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(Layer.provideMerge(Tools, RulesTest)))
  );
});
