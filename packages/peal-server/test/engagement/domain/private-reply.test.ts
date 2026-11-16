import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Option, Result } from "effect";

import { forgetComment } from "#engagement/domain/comment.ts";
import {
  beginPrivateReply,
  confirmPrivateReply,
  forgetPrivateReplyAuthor,
  mayReplyPrivately,
  privateReplyAttempted,
  privateReplyUntil,
  privateReplyWindow,
  settlePrivateReply,
  writePrivateReply,
} from "#engagement/domain/private-reply.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import {
  comment,
  memberId,
  privateReplyId,
  publishedAt,
} from "#test/engagement/support.ts";

const writtenAt = DateTime.addDuration(publishedAt, "5 minutes");

const later = DateTime.addDuration(writtenAt, "1 minute");

const ok = <A, E>(result: Result.Result<A, E>): A => Result.getOrThrow(result);

const written = (): PrivateReply =>
  writePrivateReply(
    privateReplyId(1),
    comment(1),
    Option.some(memberId),
    "Here is the link you asked for.",
    Option.none(),
    later
  );

describe("a private reply", () => {
  it("is written for the comment, in its workspace and channel", () => {
    const reply = written();
    const answered = comment(1);

    expect(reply.commentId).toBe(answered.id);
    expect(reply.channelId).toBe(answered.channelId);
    expect(reply.workspaceId).toBe(answered.workspaceId);
    expect(reply.status).toStrictEqual({
      _tag: "sending",
      attemptedAt: Option.none(),
    });
  });

  it("is attempted once a run set out, keeping the first instant", () => {
    const reply = written();

    expect(privateReplyAttempted(reply)).toBeFalsy();

    const begun = ok(beginPrivateReply(reply, later));

    expect(privateReplyAttempted(begun)).toBeTruthy();
    expect(
      ok(beginPrivateReply(begun, DateTime.addDuration(later, "1 hour"))).status
    ).toStrictEqual(begun.status);
  });

  it("ends once, as the platform answered", () => {
    const sent = ok(
      settlePrivateReply(
        written(),
        { _tag: "sent", platformMessageId: "m1" },
        later
      )
    );

    expect(sent.status).toStrictEqual({
      _tag: "sent",
      at: later,
      platformMessageId: Option.some("m1"),
    });
    expect(
      Result.isFailure(
        settlePrivateReply(sent, { _tag: "failed", reason: "refused" }, later)
      )
    ).toBeTruthy();
    expect(Result.isFailure(beginPrivateReply(sent, later))).toBeTruthy();

    const failed = ok(
      settlePrivateReply(
        written(),
        { _tag: "failed", reason: "alreadyAnswered" },
        later
      )
    );

    expect(failed.status).toStrictEqual({
      _tag: "failed",
      at: later,
      reason: "alreadyAnswered",
    });
  });

  it("left unconfirmed is settled by a member, for good", () => {
    const unconfirmed = ok(
      settlePrivateReply(
        written(),
        { _tag: "unconfirmed", reason: "noResponse" },
        later
      )
    );

    expect(
      ok(confirmPrivateReply(unconfirmed, true, later)).status
    ).toStrictEqual({
      _tag: "sent",
      at: later,
      platformMessageId: Option.none(),
    });
    expect(
      ok(confirmPrivateReply(unconfirmed, false, later)).status
    ).toStrictEqual({ _tag: "failed", at: later, reason: "notSent" });
    expect(
      Result.isFailure(confirmPrivateReply(written(), true, later))
    ).toBeTruthy();
  });

  it("loses its author once their account is closed", () => {
    expect(forgetPrivateReplyAuthor(written()).authorId).toStrictEqual(
      Option.none()
    );
  });
});

describe("whether a comment may get a private reply", () => {
  it("is Meta's seven days less an hour", () => {
    expect(Duration.toMillis(privateReplyWindow)).toBe(
      Duration.toMillis(Duration.hours(7 * 24 - 1))
    );
  });

  it("is counted from when the comment was written, not when Peal read it", () => {
    // Read by Peal five minutes after it was written.
    const answered = comment(1);

    expect(privateReplyUntil(answered)).toStrictEqual(
      DateTime.addDuration(writtenAt, privateReplyWindow)
    );

    const almost = DateTime.addDuration(
      writtenAt,
      Duration.sum(Duration.days(6), Duration.minutes(22 * 60 + 59))
    );

    const past = DateTime.addDuration(
      writtenAt,
      Duration.sum(Duration.days(6), Duration.minutes(23 * 60 + 1))
    );

    expect(mayReplyPrivately(answered, almost, Option.none())).toStrictEqual(
      Result.succeed(answered)
    );
    expect(mayReplyPrivately(answered, past, Option.none())).toStrictEqual(
      Result.fail("tooOld")
    );
  });

  it("is never for a comment the platform no longer shows, nor the account's own", () => {
    expect(
      mayReplyPrivately(forgetComment(comment(1)), later, Option.none())
    ).toStrictEqual(Result.fail("gone"));
    expect(
      mayReplyPrivately(comment(1), later, Option.some("7001"))
    ).toStrictEqual(Result.fail("ownComment"));
    expect(
      mayReplyPrivately(comment(1), later, Option.some("9999"))
    ).toStrictEqual(Result.succeed(comment(1)));
  });
});
