"use client";

import { useAtomSet } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "peal-ui/components/toast";

import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useOfferUndo } from "#components/undo.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";
import { postsKeys, readScheduledPosts, reschedulePost } from "#posts/api.ts";
import { failureOf } from "#posts/outcome.ts";
import { slotTakenBy } from "#posts/slot-taken.ts";

/** A scheduled post to move, and where it is now. */
export interface PostMove {
  readonly postId: string;
  /** Where it goes. */
  readonly at: DateTime.Utc;
  /** Where it is, which Undo moves it back to. */
  readonly from: DateTime.Utc;
  /** The zone its schedule is kept in. */
  readonly scheduleZone: string;
  /** The queue that placed it, whose slot Undo checks first. */
  readonly queueId: string | null;
}

/**
 * Moves a scheduled post, as the calendar's drag and the command menu do:
 * a toast says where it went, with Undo (and ⌘Z), which moves it back
 * unless another post of its queue took the slot it left meanwhile; a
 * refusal says why. Times read in `timeZone`, the reader's.
 */
export const useMovePost = (
  workspaceId: string,
  timeZone: string
): ((move: PostMove) => Promise<void>) => {
  const t = useTranslations("Posts.Calendar");
  const billing = useTranslations("Billing");
  const format = useFormatter();
  const timeOptions = useTimeOptions();
  const reschedule = useAtomSet(reschedulePost, { mode: "promiseExit" });
  const readPostsAt = useAtomSet(readScheduledPosts, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  const offerUndo = useOfferUndo();

  const shownAt = (at: DateTime.DateTime) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
      ...timeOptions,
    });

  // Whether another post of the queue took the slot at `at` since: read
  // from the server when Undo is pressed, as a teammate may have queued one.
  // A read that fails takes the slot as free, as the move back would have.
  const slotTaken = async (
    postId: string,
    queueId: string,
    at: DateTime.Utc
  ): Promise<boolean> => {
    const exit = await readPostsAt({
      params: { workspaceId },
      query: { from: at, to: DateTime.add(at, { seconds: 1 }) },
    });

    return (
      Exit.isSuccess(exit) && slotTakenBy(exit.value, { at, postId, queueId })
    );
  };

  // `undoable` is false for the move back itself, which offers nothing more.
  const moveTo = async (
    { at, from, postId, queueId, scheduleZone }: PostMove,
    undoable: boolean
  ): Promise<void> => {
    const exit = await reschedule({
      params: { postId, workspaceId },
      payload: { at, timeZone: scheduleZone },
      reactivityKeys: postsKeys,
    });

    if (Exit.isSuccess(exit)) {
      if (!undoable) {
        toast.success(t("movedBack", { at: shownAt(at) }));

        return;
      }

      offerUndo({
        message: t("moved", { at: shownAt(at) }),
        undo: async () => {
          if (queueId !== null && (await slotTaken(postId, queueId, from))) {
            toast.info(t("slotTaken", { at: shownAt(at) }));

            return;
          }

          await moveTo(
            { at: from, from: at, postId, queueId, scheduleZone },
            false
          );
        },
      });

      return;
    }

    offerUpgrade(exit);

    const reason = Option.map(failureOf(exit), ({ _tag }) => _tag);

    toast.error(
      Option.match(reason, {
        onNone: () => t("moveFailed"),
        onSome: (tag) => {
          if (tag === "ScheduleInPast") {
            return t("moveInPast");
          }

          if (tag === "PlanLimitReached") {
            return billing("limitReached", { limit: "scheduledPosts" });
          }

          return tag === "Forbidden" ? t("moveForbidden") : t("moveFailed");
        },
      })
    );
  };

  return async (move) => {
    await moveTo(move, true);
  };
};
