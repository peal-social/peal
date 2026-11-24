import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";
import {
  Api,
  Forbidden,
  InboxActionUnavailable,
  InboxCommentNotFound,
  InboxPrivateReplyNotFound,
  PrivateReplyNotPossible,
  PrivateReplyPending,
  ReplyInvalid,
  ReplyStatusConflict,
  forWorkspace,
} from "peal-contract";
import type { Member } from "peal-contract";

import type { EngagedChannel } from "#engagement/application/ports/engagement-channels.ts";
import { InboxApiLive, InboxMessagesApiLive } from "#engagement/container.ts";
import { privateReplyWindow } from "#engagement/domain/private-reply.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import { facebookCommentScopes } from "#shared/domain/inbox-platform.ts";
import { memberOf } from "#test/channels/support.ts";
import { makePrivateReplyWorld } from "#test/engagement/fakes/private-reply-world.ts";
import type { PrivateReplyWorld } from "#test/engagement/fakes/private-reply-world.ts";
import {
  channelId,
  comment,
  commentId,
  messageBox,
  publishedAt,
  thread,
  workspaceId,
} from "#test/engagement/support.ts";
import { securityTest } from "#workspace/api/security.ts";
import { withheldWhileImpersonating } from "#workspace/domain/membership.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The private replies' endpoints, and what a thread shows of them, on
// their real use cases over the in-memory world. Each request acts as a
// member, as WorkspaceAccess would.

const page: EngagedChannel = {
  accountId: "page-1",
  connection: Option.none(),
  platform: "facebook",
  scopes: [
    facebookCommentScopes.read,
    facebookCommentScopes.manage,
    ...facebookMessageScopes,
  ],
};

const writtenAt = DateTime.addDuration(publishedAt, "5 minutes");

// A Page's comment 1, under thread 1, with the Page's messages on.
const worldWithComment = (): PrivateReplyWorld => {
  const world = makePrivateReplyWorld();
  const kept = comment(1, { writtenAt });

  world.comments.state.threads.set(thread(1).id, thread(1));
  world.comments.state.comments.set(kept.id, kept);
  world.comments.state.channels.set(channelId(1), page);
  world.boxes.state.boxes.set(channelId(1), messageBox(channelId(1)));
  world.boxes.state.switchedOn.set(channelId(1), {
    channelId: channelId(1),
    enabledAt: writtenAt,
    enabledBy: Option.none(),
    workspaceId,
  });

  return world;
};

const clientAs = (world: PrivateReplyWorld, member: Member) =>
  HttpApiTest.groups(Api, ["inbox", "inboxMessages"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.mergeAll(InboxApiLive, InboxMessagesApiLive).pipe(
          Layer.provideMerge(securityTest(member)),
          Layer.provide(
            Layer.mergeAll(world.layer, world.comments.layer, world.boxes.layer)
          )
        ),
        HttpServer.layerServices
      )
    )
  );

const editor = memberOf(workspaceId, permissionsFor("editor"));

const userId = editor.principal._tag === "user" ? editor.principal.userId : "";

const headers = forWorkspace(workspaceId);

const soon = DateTime.addDuration(writtenAt, "1 hour");

const at = <A, E, R>(effect: Effect.Effect<A, E, R>, when = soon) =>
  TestClock.setTime(DateTime.toEpochMillis(when)).pipe(Effect.andThen(effect));

const sending = (member: Member, world: PrivateReplyWorld, text = "Hi") =>
  clientAs(world, member).pipe(
    Effect.flatMap((client) =>
      client.inboxMessages.sendPrivateReply({
        headers,
        payload: { commentId: commentId(1), text },
      })
    )
  );

describe("the private replies' endpoints", () => {
  it.effect(
    "send one to a comment's author, once, and show how it stands",
    () => {
      const world = worldWithComment();

      return at(
        Effect.gen(function* sent() {
          const client = yield* clientAs(world, editor);
          const reply = yield* sending(editor, world, "Here is the link.");

          assert.strictEqual(reply.status, "sending");
          assert.strictEqual(reply.commentId, commentId(1));
          assert.strictEqual(reply.text, "Here is the link.");
          assert.deepStrictEqual(world.state.jobs, [reply.id]);

          const again = yield* sending(editor, world, "Another.").pipe(
            Effect.flip
          );

          assert.instanceOf(again, PrivateReplyPending);
          assert.strictEqual(
            again instanceof PrivateReplyPending ? again.privateReplyId : "",
            reply.id
          );

          const shown = yield* client.inboxMessages.getPrivateReply({
            headers,
            params: { privateReplyId: reply.id },
          });

          assert.deepStrictEqual(shown, reply);

          // Only an unconfirmed one is confirmed.
          const conflict = yield* client.inboxMessages
            .confirmPrivateReply({
              headers,
              params: { privateReplyId: reply.id },
              payload: { went: false },
            })
            .pipe(Effect.flip);

          assert.instanceOf(conflict, ReplyStatusConflict);

          // The thread shows it on its comment, and until when one may go.
          const detail = yield* client.inbox.getThread({
            headers,
            params: { threadId: thread(1).id },
          });

          assert.strictEqual(detail.abilities.privateReply, "available");

          const [shownComment] = detail.comments;

          assert.strictEqual(shownComment?.privateReply?.id, reply.id);
          assert.deepStrictEqual(
            shownComment?.privateReplyUntil,
            DateTime.addDuration(writtenAt, privateReplyWindow)
          );

          const abilities = yield* client.inbox.getAbilities({
            headers,
            params: { channelId: channelId(1) },
          });

          assert.strictEqual(abilities.privateReply, "available");
        })
      );
    }
  );

  it.effect(
    "refuse whoever may not answer messages: a viewer, staff acting as a member, an application without the owner's leave",
    () => {
      const world = worldWithComment();

      const staff: Member = {
        ...memberOf(
          workspaceId,
          permissionsFor("editor").filter(
            (permission) => !withheldWhileImpersonating.has(permission)
          )
        ),
        principal: {
          _tag: "user",
          impersonatedBy: "01900000-0000-7000-8000-0000000000c1",
          userId,
        },
      };

      const application: Member = {
        ...editor,
        principal: {
          _tag: "user",
          impersonatedBy: null,
          oauth: {
            clientId: "synthetic-unconsented-client",
            scopes: ["workspace:publish"],
            workspaceId,
          },
          userId,
        },
      };

      const viewer = memberOf(workspaceId, permissionsFor("viewer"));

      return at(
        Effect.gen(function* refused() {
          for (const member of [viewer, staff, application]) {
            assert.instanceOf(
              yield* sending(member, world).pipe(Effect.flip),
              Forbidden
            );
          }

          assert.strictEqual(world.state.replies.size, 0);

          // Shown neither to whoever may not read messages.
          const reply = yield* sending(editor, world);

          for (const member of [viewer, staff, application]) {
            const client = yield* clientAs(world, member);

            const shown = yield* client.inboxMessages
              .getPrivateReply({
                headers,
                params: { privateReplyId: reply.id },
              })
              .pipe(Effect.flip);

            assert.instanceOf(shown, Forbidden);
          }

          const detail = yield* clientAs(world, viewer).pipe(
            Effect.flatMap((client) =>
              client.inbox.getThread({
                headers,
                params: { threadId: thread(1).id },
              })
            )
          );

          assert.isNull(detail.comments[0]?.privateReply);
        })
      );
    }
  );

  it.effect(
    "refuse, reserving nothing, a comment too old, unknown, or a channel whose messages are off",
    () => {
      const world = worldWithComment();

      return Effect.gen(function* refused() {
        const old = yield* at(
          sending(editor, world),
          DateTime.addDuration(
            writtenAt,
            Duration.sum(privateReplyWindow, Duration.minutes(1))
          )
        ).pipe(Effect.flip);

        assert.instanceOf(old, PrivateReplyNotPossible);

        // Past it, the thread no longer offers one.
        const detail = yield* at(
          clientAs(world, editor).pipe(
            Effect.flatMap((client) =>
              client.inbox.getThread({
                headers,
                params: { threadId: thread(1).id },
              })
            )
          ),
          DateTime.addDuration(
            writtenAt,
            Duration.sum(privateReplyWindow, Duration.minutes(1))
          )
        );

        assert.isNull(detail.comments[0]?.privateReplyUntil);
        assert.strictEqual(
          old instanceof PrivateReplyNotPossible ? old.reason : "",
          "tooOld"
        );

        const unknown = yield* at(
          clientAs(world, editor).pipe(
            Effect.flatMap((client) =>
              client.inboxMessages.sendPrivateReply({
                headers,
                payload: { commentId: "not-an-id", text: "Hi" },
              })
            ),
            Effect.flip
          )
        );

        assert.instanceOf(unknown, InboxCommentNotFound);

        const long = yield* at(
          sending(editor, world, "x".repeat(2001)).pipe(Effect.flip)
        );

        assert.instanceOf(long, ReplyInvalid);

        world.boxes.state.switchedOn.clear();

        const off = yield* at(sending(editor, world).pipe(Effect.flip));

        assert.instanceOf(off, InboxActionUnavailable);
        assert.strictEqual(
          off instanceof InboxActionUnavailable ? off.ability : "",
          "privateReply"
        );

        const missing = yield* at(
          clientAs(world, editor).pipe(
            Effect.flatMap((client) =>
              client.inboxMessages.getPrivateReply({
                headers,
                params: { privateReplyId: "not-an-id" },
              })
            ),
            Effect.flip
          )
        );

        assert.instanceOf(missing, InboxPrivateReplyNotFound);
        assert.strictEqual(world.state.replies.size, 0);
      });
    }
  );
});
