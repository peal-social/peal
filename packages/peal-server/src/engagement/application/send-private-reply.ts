import {
  Context,
  DateTime,
  Effect,
  Layer,
  Metric,
  Option,
  Result,
} from "effect";

import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";
import {
  beginPrivateReply,
  privateReplyAttempted,
  settlePrivateReply,
} from "#engagement/domain/private-reply.ts";
import type { PrivateReplyOutcome } from "#engagement/domain/private-reply.ts";
import { callBound, strandedAfter } from "#engagement/domain/reply.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";

import { PrivateReplyJobs } from "./ports/private-reply-jobs.ts";
import { PrivateReplySender } from "./ports/private-reply-sender.ts";
import { PrivateReplyStore } from "./ports/private-reply-store.ts";
import { claimOfPrivateReply } from "./private-reply-claim.ts";
import type { SendResult } from "./send-reply.ts";

/** Private replies that ended, by how. */
export const privateRepliesSettled = Metric.counter(
  "peal.engagement.private_replies",
  {
    description:
      "Private replies to comments sent from Peal that ended, by outcome",
    incremental: true,
  }
);

const counted = (outcome: string, times: number) =>
  Metric.update(
    Metric.withAttributes(privateRepliesSettled, { outcome }),
    times
  );

// The stranded private replies one run hands over: there are few, if any.
const strandedPerRun = 100;

/**
 * Sends one private reply, for the job its journal row started, as a
 * direct message is sent: a run records that it sets out to call the
 * platform, commits, and only then calls; a run that finds the call
 * already set out never sends: it asks the platform whether the message
 * is there, and leaves it `unconfirmed` when the platform cannot say. The
 * outcome and, for one that never went out, its outbound message given
 * back are saved in one transaction.
 */
export class SendPrivateReply extends Context.Service<
  SendPrivateReply,
  {
    readonly run: (
      privateReplyId: PrivateReplyId
    ) => Effect.Effect<SendResult, DatabaseError>;
    /**
     * Hands to a person those no job settled: still `sending`
     * `strandedAfter` they were written, with no call claimed in the last
     * `callBound`, they become `unconfirmed`, their job stopped in the
     * same transaction. Answers how many.
     */
    readonly settleStranded: Effect.Effect<number, DatabaseError>;
  }
>()("peal-server/engagement/application/SendPrivateReply") {
  static readonly layer = Layer.effect(
    SendPrivateReply,
    Effect.gen(function* SendPrivateReplyLive() {
      const store = yield* PrivateReplyStore;
      const sender = yield* PrivateReplySender;
      const jobs = yield* PrivateReplyJobs;
      const { transaction } = yield* TransactionRunner;
      const meters = yield* MeteredUsage;

      // Saves how sending ended, unless it ended meanwhile.
      const settle = Effect.fn("SendPrivateReply.settle")(function* settle(
        privateReplyId: PrivateReplyId,
        outcome: PrivateReplyOutcome
      ) {
        const now = yield* DateTime.now;
        const reply = yield* store.privateReply(privateReplyId);

        if (Option.isNone(reply)) {
          return "superseded" as const;
        }

        const settled = settlePrivateReply(reply.value, outcome, now);

        if (Result.isFailure(settled)) {
          return "superseded" as const;
        }

        // Only from the state it was read in.
        if (!(yield* store.advance(settled.success, reply.value))) {
          return "superseded" as const;
        }

        // One that never went out gives its outbound message back.
        if (outcome._tag === "failed") {
          yield* meters.giveBack(claimOfPrivateReply(settled.success));
        }

        // Its comment forgotten meanwhile, it goes with it.
        yield* store.dropIfForgotten(settled.success.id);

        return "settled" as const;
      });

      const run = Effect.fn("SendPrivateReply.run")(function* run(
        privateReplyId: PrivateReplyId
      ) {
        const found = yield* store.privateReply(privateReplyId);

        if (Option.isNone(found) || found.value.status._tag !== "sending") {
          return "superseded" as const;
        }

        const reply = found.value;
        const request = { channelId: reply.channelId, privateReplyId };

        // A run that finds the call set out never sends: it looks.
        if (privateReplyAttempted(reply)) {
          const outcome = yield* sender.resume(request);
          const result = yield* transaction(settle(privateReplyId, outcome));

          if (result === "settled") {
            yield* counted(outcome._tag, 1);
          }

          return result;
        }

        const begun = beginPrivateReply(reply, yield* DateTime.now);

        if (Result.isFailure(begun)) {
          return "superseded" as const;
        }

        // Committed before the call: from here on, it may be out.
        if (!(yield* store.advance(begun.success, reply))) {
          return "superseded" as const;
        }

        const outcome = yield* sender.send(request);
        const result = yield* transaction(settle(privateReplyId, outcome));

        if (result === "settled") {
          yield* counted(outcome._tag, 1);
        }

        return result;
      });

      const settleStranded = Effect.gen(function* settleStranded() {
        const now = yield* DateTime.now;

        const stranded = yield* store.stranded(
          DateTime.subtractDuration(now, strandedAfter),
          DateTime.subtractDuration(now, callBound),
          strandedPerRun
        );

        const calledBefore = DateTime.subtractDuration(now, callBound);
        let settled = 0;

        // One transaction each, its job stopped in it. One whose gate
        // claimed its call since it was listed is left to that call.
        for (const { id } of stranded) {
          const handed = yield* transaction(
            store
              .handOver(id, now, calledBefore)
              .pipe(
                Effect.tap((found) =>
                  Option.isSome(found) ? jobs.cancel(id) : Effect.void
                )
              )
          );

          settled += Option.isSome(handed) ? 1 : 0;
        }

        yield* counted("unconfirmed", settled);

        return settled;
      }).pipe(Effect.withSpan("SendPrivateReply.settleStranded"));

      return SendPrivateReply.of({ run, settleStranded });
    })
  );
}
