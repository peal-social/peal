import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import type { EngagedChannel } from "#engagement/application/ports/engagement-channels.ts";
import { SendPrivateReply } from "#engagement/application/send-private-reply.ts";
import { forgetComment, receiveComment } from "#engagement/domain/comment.ts";
import type { Comment } from "#engagement/domain/comment.ts";
import {
  beginPrivateReply,
  privateReplyWindow,
} from "#engagement/domain/private-reply.ts";
import { Actor } from "#shared/domain/access.ts";
import type { Permission } from "#shared/domain/access.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
} from "#shared/domain/inbox-message-platform.ts";
import {
  facebookCommentScopes,
  instagramLoginCommentScope,
} from "#shared/domain/inbox-platform.ts";
import { makePrivateReplyWorld } from "#test/engagement/fakes/private-reply-world.ts";
import type { PrivateReplyWorld } from "#test/engagement/fakes/private-reply-world.ts";
import {
  channelId,
  comment,
  commentId,
  memberId,
  messageBox,
  publishedAt,
  reading,
  thread,
  workspaceId,
} from "#test/engagement/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

const actorWith = (...permissions: Permission[]) =>
  new Actor({
    permissions,
    subject: { _tag: "user", impersonatedBy: Option.none(), userId: memberId },
    workspaceId,
  });

const editor = actorWith(
  "engagement:read",
  "engagement:readMessages",
  "engagement:reply",
  "engagement:message"
);

// A member who answers comments, never messages.
const replier = actorWith("engagement:read", "engagement:reply");

// Staff acting as the editor hold none of engagement's permissions.
const staff = new Actor({
  permissions: [],
  subject: {
    _tag: "user",
    impersonatedBy: Option.some(memberId),
    userId: memberId,
  },
  workspaceId,
});

// A member through an application (an MCP client, say).
const throughApp = new Actor({
  permissions: [...editor.permissions],
  subject: {
    _tag: "user",
    clientId: "synthetic-mcp-client",
    impersonatedBy: Option.none(),
    userId: memberId,
  },
  workspaceId,
});

const page: EngagedChannel = {
  accountId: "page-1",
  connection: Option.none(),
  platform: "facebook",
  scopes: [
    "pages_show_list",
    facebookCommentScopes.read,
    facebookCommentScopes.manage,
    ...facebookMessageScopes,
  ],
};

const instagram: EngagedChannel = {
  accountId: "ig-1",
  connection: Option.some("instagramLogin"),
  platform: "instagram",
  scopes: [instagramLoginCommentScope, instagramLoginMessageScope],
};

// Written five minutes after the post, read by Peal two days later: the
// window counts from the first.
const writtenAt = DateTime.addDuration(publishedAt, "5 minutes");

const answered = (): Comment => comment(1, { writtenAt });

// Peal read it two days after it was written.
const readLate = (): Comment =>
  receiveComment(
    commentId(1),
    thread(1),
    reading(1, { writtenAt }),
    DateTime.addDuration(writtenAt, "2 days")
  );

const soon = DateTime.addDuration(writtenAt, "1 hour");

const at = <A, E, R>(effect: Effect.Effect<A, E, R>, when = soon) =>
  TestClock.setTime(DateTime.toEpochMillis(when)).pipe(Effect.andThen(effect));

// A world with comment 1 on a channel whose messages are on.
const worldWith = (
  channel: EngagedChannel = page,
  world: PrivateReplyWorld = makePrivateReplyWorld(),
  on = true
) => {
  const kept = answered();

  world.comments.state.comments.set(kept.id, kept);
  world.comments.state.channels.set(channelId(1), channel);

  if (on) {
    world.boxes.state.boxes.set(channelId(1), messageBox(channelId(1)));
    world.boxes.state.switchedOn.set(channelId(1), {
      channelId: channelId(1),
      enabledAt: writtenAt,
      enabledBy: Option.none(),
      workspaceId,
    });
  }

  return world;
};

const sending = (
  actor: Actor = editor,
  text = "Here is the link you asked for.",
  key?: string
) =>
  EngagementPrivateReplies.use((replies) =>
    replies.send(actor, commentId(1), text, Option.fromUndefinedOr(key))
  );

// Nothing reserved: no row, no job, no outbound message.
const reservedNothing = (world: PrivateReplyWorld) =>
  Effect.sync(() => {
    assert.strictEqual(world.state.replies.size, 0);
    assert.deepStrictEqual(world.state.jobs, []);
  });

const billed = (allowed: number) => {
  const meters = fakeMeters({ allowed: Option.some(allowed) });

  return {
    meters,
    world: worldWith(page, makePrivateReplyWorld({ meters })),
  };
};

const claimsOf = FakeMetersLedger.use(Ref.get).pipe(
  Effect.map(({ claims, givenBack }) => ({ claims, givenBack }))
);

describe("a member's private reply", () => {
  it.effect(
    "is journalled with its job and its outbound message, then sent once",
    () => {
      const { meters, world } = billed(5);

      return at(
        Effect.gen(function* sends() {
          const reply = yield* sending();

          assert.strictEqual(reply.status._tag, "sending");
          assert.strictEqual(reply.commentId, commentId(1));
          assert.deepStrictEqual(reply.authorId, Option.some(memberId));
          assert.deepStrictEqual(world.state.jobs, [reply.id]);
          assert.strictEqual((yield* claimsOf).claims.length, 1);

          const run = yield* SendPrivateReply.use((send) => send.run(reply.id));

          assert.strictEqual(run, "settled");
          assert.strictEqual(world.state.sent.length, 1);
          // The attempt was committed before the platform was called.
          assert.deepStrictEqual(
            world.state.sentAs.map(
              (status) =>
                status._tag === "sending" && Option.isSome(status.attemptedAt)
            ),
            [true]
          );
          assert.strictEqual(
            world.state.replies.get(reply.id)?.status._tag,
            "sent"
          );

          // Run again, as a job started twice: nothing more is sent.
          assert.strictEqual(
            yield* SendPrivateReply.use((send) => send.run(reply.id)),
            "superseded"
          );
          assert.strictEqual(world.state.sent.length, 1);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect("is never sent twice to one comment", () => {
    const world = worldWith();

    return at(
      Effect.gen(function* once() {
        const first = yield* sending();

        const second = yield* sending(editor, "Another text.").pipe(
          Effect.flip
        );

        assert.strictEqual(second._tag, "PrivateReplyPending");
        assert.strictEqual(
          second._tag === "PrivateReplyPending"
            ? second.privateReplyId
            : undefined,
          first.id
        );
        assert.deepStrictEqual(world.state.jobs, [first.id]);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "answers a key sent again with what it made, even past the window",
    () => {
      const { meters, world } = billed(5);

      return Effect.gen(function* keyed() {
        const first = yield* at(sending(editor, "Here.", "synthetic-key"));
        const again = yield* at(sending(editor, "Here.", "synthetic-key"));

        assert.strictEqual(again.id, first.id);
        assert.strictEqual((yield* claimsOf).claims.length, 1);

        // A lost answer retried after Peal's seven days: the key answers it.
        const late = yield* at(
          sending(editor, "Here.", "synthetic-key"),
          DateTime.addDuration(writtenAt, privateReplyWindow)
        );

        assert.strictEqual(late.id, first.id);

        const reused = yield* at(
          sending(editor, "Another.", "synthetic-key")
        ).pipe(Effect.flip);

        assert.strictEqual(reused._tag, "ReplyKeyReused");
      }).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "counts the window from when the comment was written, not when Peal read it",
    () => {
      const world = worldWith();
      const late = readLate();

      world.comments.state.comments.set(late.id, late);

      return Effect.gen(function* window() {
        // Five days after Peal read it, but past seven days less an hour
        // since it was written.
        const refused = yield* at(
          sending(),
          DateTime.addDuration(
            writtenAt,
            Duration.sum(privateReplyWindow, Duration.minutes(1))
          )
        ).pipe(Effect.flip);

        assert.strictEqual(refused._tag, "PrivateReplyNotPossible");
        assert.strictEqual(
          refused._tag === "PrivateReplyNotPossible" ? refused.reason : "",
          "tooOld"
        );
        yield* reservedNothing(world);

        const sent = yield* at(
          sending(),
          DateTime.addDuration(
            writtenAt,
            Duration.subtract(privateReplyWindow, Duration.minutes(1))
          )
        );

        assert.strictEqual(sent.status._tag, "sending");
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "is refused, reserving nothing, without the permission to answer messages",
    () => {
      const { meters, world } = billed(5);

      return at(
        Effect.gen(function* refused() {
          for (const actor of [replier, staff]) {
            const failure = yield* sending(actor).pipe(Effect.flip);

            assert.strictEqual(failure._tag, "MissingPermission");
          }

          yield* reservedNothing(world);
          assert.deepStrictEqual((yield* claimsOf).claims, []);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "is refused to an application the owner did not let answer messages",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* consent() {
          const refused = yield* sending(throughApp).pipe(Effect.flip);

          assert.strictEqual(refused._tag, "MessagesNeedConsent");
          yield* reservedNothing(world);

          world.boxes.state.applications.push({
            clientId: "synthetic-mcp-client",
            grantedAt: writtenAt,
            grantedBy: Option.some(memberId),
            workspaceId,
          });

          assert.strictEqual(
            (yield* sending(throughApp)).status._tag,
            "sending"
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "is refused for another workspace's comment, a comment gone, and the account's own",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* refused() {
          const elsewhere = new Actor({
            permissions: [...editor.permissions],
            subject: editor.subject,
            workspaceId: WorkspaceIdSchema.make(
              "33333333-3333-4333-8333-333333333333"
            ),
          });

          assert.strictEqual(
            (yield* sending(elsewhere).pipe(Effect.flip))._tag,
            "CommentNotFound"
          );

          world.comments.state.comments.set(
            commentId(1),
            forgetComment(answered())
          );

          const gone = yield* sending().pipe(Effect.flip);

          assert.strictEqual(
            gone._tag === "PrivateReplyNotPossible" ? gone.reason : gone._tag,
            "gone"
          );

          world.comments.state.comments.set(commentId(1), answered());
          world.comments.state.channels.set(channelId(1), {
            ...page,
            accountId: "7001",
          });

          const own = yield* sending().pipe(Effect.flip);

          assert.strictEqual(
            own._tag === "PrivateReplyNotPossible" ? own.reason : own._tag,
            "ownComment"
          );
          yield* reservedNothing(world);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("needs the channel's messages on, and their permissions", () => {
    const off = worldWith(page, makePrivateReplyWorld(), false);

    return at(
      Effect.gen(function* standing() {
        const refused = yield* sending().pipe(Effect.flip);

        assert.deepStrictEqual(
          refused._tag === "AbilityUnavailable"
            ? [refused.ability, refused.standing]
            : [],
          ["privateReply", "unsupported"]
        );
        yield* reservedNothing(off);

        off.boxes.state.boxes.set(channelId(1), messageBox(channelId(1)));
        off.boxes.state.switchedOn.set(channelId(1), {
          channelId: channelId(1),
          enabledAt: writtenAt,
          enabledBy: Option.none(),
          workspaceId,
        });
        off.comments.state.channels.set(channelId(1), {
          ...page,
          scopes: [facebookCommentScopes.read],
        });

        const reconnect = yield* sending().pipe(Effect.flip);

        assert.deepStrictEqual(
          reconnect._tag === "AbilityUnavailable"
            ? [reconnect.ability, reconnect.standing]
            : [],
          ["privateReply", "reconnect"]
        );
        yield* reservedNothing(off);
      })
    ).pipe(Effect.provide(off.layer));
  });

  it.effect(
    "takes the channel's messages on in the comment's own workspace only",
    () => {
      const world = worldWith(page, makePrivateReplyWorld(), false);

      // One Page in two workspaces: on in the other, off in this one.
      world.boxes.state.switchedOn.set(channelId(1), {
        channelId: channelId(1),
        enabledAt: writtenAt,
        enabledBy: Option.none(),
        workspaceId: WorkspaceIdSchema.make(
          "33333333-3333-4333-8333-333333333333"
        ),
      });

      return at(
        Effect.gen(function* elsewhere() {
          const refused = yield* sending().pipe(Effect.flip);

          assert.strictEqual(refused._tag, "AbilityUnavailable");
          yield* reservedNothing(world);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "is off where the server reads none of the platform's messages",
    () => {
      const world = worldWith(
        page,
        makePrivateReplyWorld({ messages: new Set(["mastodon"]) })
      );

      return at(
        Effect.gen(function* off() {
          assert.strictEqual(
            (yield* sending().pipe(Effect.flip))._tag,
            "AbilityUnavailable"
          );
          yield* reservedNothing(world);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("keeps to the platform's length, and refuses an empty text", () => {
    const world = worldWith(instagram);

    return at(
      Effect.gen(function* length() {
        const long = yield* sending(editor, "é".repeat(501)).pipe(Effect.flip);

        assert.deepStrictEqual(
          long._tag === "ReplyTooLong" ? [long.maximum, long.unit] : [],
          [1000, "utf8Bytes"]
        );

        assert.strictEqual(
          (yield* sending(editor, "  ").pipe(Effect.flip))._tag,
          "ReplyEmpty"
        );
        // Control characters alone clean to nothing: a refusal, never a
        // fault.
        assert.strictEqual(
          (yield* sending(editor, "\u0007\u0008").pipe(Effect.flip))._tag,
          "ReplyEmpty"
        );
        yield* reservedNothing(world);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "is refused by a paused meter before anything, unless the request has a key",
    () => {
      const { meters, world } = billed(0);

      return at(
        Effect.gen(function* paused() {
          const refused = yield* sending().pipe(Effect.flip);

          assert.strictEqual(refused._tag, "AllowanceReached");
          yield* reservedNothing(world);

          // With a key, the journal is asked first; the claim then refuses.
          const keyed = yield* sending(editor, "Here.", "synthetic-key").pipe(
            Effect.flip
          );

          assert.strictEqual(keyed._tag, "AllowanceReached");
          assert.deepStrictEqual((yield* claimsOf).claims, []);
          assert.deepStrictEqual(world.state.jobs, []);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );
});

describe("a private reply's job", () => {
  it.effect(
    "drops one whose comment was forgotten while it was on its way, once it settles",
    () => {
      const world = worldWith();

      world.state.sending = { _tag: "failed", reason: "commentGone" };

      return at(
        Effect.gen(function* forgotten() {
          const reply = yield* sending();

          world.comments.state.comments.set(
            commentId(1),
            forgetComment(answered())
          );

          yield* SendPrivateReply.use((send) => send.run(reply.id));

          assert.isFalse(world.state.replies.has(reply.id));
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("gives the outbound message back when it failed", () => {
    const { meters, world } = billed(5);

    world.state.sending = { _tag: "failed", reason: "alreadyAnswered" };

    return at(
      Effect.gen(function* failed() {
        const reply = yield* sending();

        yield* SendPrivateReply.use((send) => send.run(reply.id));

        assert.deepStrictEqual(world.state.replies.get(reply.id)?.status, {
          _tag: "failed",
          at: soon,
          reason: "alreadyAnswered",
        });
        assert.strictEqual((yield* claimsOf).givenBack.length, 1);

        // Failed, the comment may get another.
        assert.strictEqual((yield* sending()).status._tag, "sending");
      })
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect(
    "never sends again once a run set out: it looks, and leaves it to a person",
    () => {
      const { meters, world } = billed(5);

      world.state.sending = { _tag: "unconfirmed", reason: "noResponse" };

      return at(
        Effect.gen(function* lost() {
          const reply = yield* sending();

          yield* SendPrivateReply.use((send) => send.run(reply.id));

          assert.strictEqual(
            world.state.replies.get(reply.id)?.status._tag,
            "unconfirmed"
          );

          // A person says it did not go out: its outbound message comes
          // back, and its job stops for good.
          const confirmed = yield* EngagementPrivateReplies.use((replies) =>
            replies.confirm(editor, reply.id, false)
          );

          assert.deepStrictEqual(confirmed.status, {
            _tag: "failed",
            at: soon,
            reason: "notSent",
          });
          assert.deepStrictEqual(world.state.cancelled, [reply.id]);
          assert.strictEqual((yield* claimsOf).givenBack.length, 1);
          assert.strictEqual(world.state.sent.length, 1);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect("resumes a run cut after it set out, and sends nothing", () => {
    const world = worldWith();

    world.state.resuming = { _tag: "sent", platformMessageId: "m-found" };

    return at(
      Effect.gen(function* resumed() {
        const reply = yield* sending();

        // An earlier run set out, and stopped before it recorded anything.
        world.state.replies.set(
          reply.id,
          Result.getOrThrow(beginPrivateReply(reply, soon))
        );

        yield* SendPrivateReply.use((send) => send.run(reply.id));

        assert.deepStrictEqual(world.state.sent, []);
        assert.strictEqual(world.state.resumed.length, 1);
        assert.strictEqual(
          world.state.replies.get(reply.id)?.status._tag,
          "sent"
        );
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect("hands one no job settled to a person, and stops its job", () => {
    const world = worldWith();

    return Effect.gen(function* stranded() {
      const reply = yield* at(sending());

      const handed = yield* at(
        SendPrivateReply.use((send) => send.settleStranded),
        DateTime.addDuration(soon, "2 hours")
      );

      assert.strictEqual(handed, 1);
      assert.strictEqual(
        world.state.replies.get(reply.id)?.status._tag,
        "unconfirmed"
      );
      assert.deepStrictEqual(world.state.cancelled, [reply.id]);
    }).pipe(Effect.provide(world.layer));
  });
});

describe("another workspace's private reply", () => {
  it.effect("is neither shown nor confirmed", () => {
    const world = worldWith();

    world.state.sending = { _tag: "unconfirmed", reason: "noResponse" };

    const elsewhere = new Actor({
      permissions: [...editor.permissions],
      subject: editor.subject,
      workspaceId: WorkspaceIdSchema.make(
        "33333333-3333-4333-8333-333333333333"
      ),
    });

    return at(
      Effect.gen(function* isolated() {
        const reply = yield* sending();

        yield* SendPrivateReply.use((send) => send.run(reply.id));

        const shown = yield* EngagementPrivateReplies.use((replies) =>
          replies.privateReply(elsewhere, reply.id)
        ).pipe(Effect.flip);

        assert.strictEqual(shown._tag, "PrivateReplyNotFound");

        const confirmed = yield* EngagementPrivateReplies.use((replies) =>
          replies.confirm(elsewhere, reply.id, false)
        ).pipe(Effect.flip);

        assert.strictEqual(confirmed._tag, "PrivateReplyNotFound");
        assert.strictEqual(
          world.state.replies.get(reply.id)?.status._tag,
          "unconfirmed"
        );
      })
    ).pipe(Effect.provide(world.layer));
  });
});

describe("what a thread shows of private replies", () => {
  it.effect(
    "shows them to who may read messages, and the channel's standing to all",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* shown() {
          yield* sending();

          const forEditor = yield* EngagementPrivateReplies.use((replies) =>
            replies.ofThread(editor, channelId(1), [commentId(1)])
          );

          assert.strictEqual(forEditor.standing, "available");
          assert.strictEqual(forEditor.replies.length, 1);

          const forReplier = yield* EngagementPrivateReplies.use((replies) =>
            replies.ofThread(replier, channelId(1), [commentId(1)])
          );

          assert.strictEqual(forReplier.standing, "available");
          assert.deepStrictEqual(forReplier.replies, []);

          const forApp = yield* EngagementPrivateReplies.use((replies) =>
            replies.ofThread(throughApp, channelId(1), [commentId(1)])
          );

          assert.deepStrictEqual(forApp.replies, []);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );
});
