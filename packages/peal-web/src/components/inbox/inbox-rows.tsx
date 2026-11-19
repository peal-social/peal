"use client";

import { DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type {
  InboxConversation,
  InboxReviewThread,
  InboxThread,
  SocialChannel,
} from "peal-contract";
import type { ComponentType, ReactNode } from "react";

import { useChannelName } from "./inbox-views.tsx";

// The inbox's rows (DESIGN.md, "Split view"): each a link to the item it
// opens beside the list, one line naming it with the time of its latest
// news at its end, one line of counts under it, and a dot while something
// waits. The row open is marked (`aria-current`).

/** A link of the app, which the list gives, so tests render without Next. */
export type InboxRowLink = ComponentType<{
  readonly "aria-current"?: "page";
  readonly children: ReactNode;
  readonly className: string;
  readonly href: string;
}>;

// A row's time: its day, in the reader's zone.
const useDay = () => {
  const format = useFormatter();

  return (at: DateTime.Utc): string =>
    format.dateTime(DateTime.toDateUtc(at), { day: "numeric", month: "short" });
};

const InboxRow = ({
  current,
  href,
  link: Link,
  title,
  waiting,
  when,
  under,
}: {
  readonly current: boolean;
  readonly href: string;
  readonly link: InboxRowLink;
  readonly title: string;
  /** Whether something in it waits for the workspace. */
  readonly waiting: boolean;
  readonly when: string | null;
  readonly under: string;
}) => (
  <li>
    <Link
      href={href}
      className="hover:bg-muted/60 focus-visible:ring-ring/50 aria-[current=page]:bg-accent flex flex-col gap-0.5 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
      {...(current ? { "aria-current": "page" as const } : {})}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={
            waiting
              ? "bg-brand size-1.5 shrink-0 rounded-full"
              : "size-1.5 shrink-0"
          }
        />
        <span
          dir="auto"
          className="min-w-0 flex-1 truncate text-sm font-medium"
        >
          {title}
        </span>
        {when === null ? null : (
          <span className="text-muted-foreground shrink-0 text-xs">{when}</span>
        )}
      </span>
      <span className="text-muted-foreground truncate pl-3.5 text-xs">
        {under}
      </span>
    </Link>
  </li>
);

/** A post's comments on one channel: how many wait, of how many. */
export const ThreadRowView = ({
  channel,
  current,
  href,
  link,
  thread,
}: {
  /** The thread's channel, unless it was disconnected since. */
  readonly channel: SocialChannel | undefined;
  readonly current: boolean;
  readonly href: string;
  readonly link: InboxRowLink;
  readonly thread: InboxThread;
}) => {
  const t = useTranslations("Inbox.row");
  const channelName = useChannelName();
  const day = useDay();

  return (
    <InboxRow
      current={current}
      href={href}
      link={link}
      title={t("thread", { channel: channelName(channel) })}
      under={t("counts", {
        comments: thread.comments,
        unanswered: thread.unanswered,
      })}
      waiting={thread.unanswered > 0}
      when={thread.lastCommentAt === null ? null : day(thread.lastCommentAt)}
    />
  );
};

/** A location's reviews: how many wait, and Google's figures. */
export const ReviewThreadRowView = ({
  channel,
  current,
  href,
  link,
  thread,
}: {
  /** The location's channel, unless it was disconnected since. */
  readonly channel: SocialChannel | undefined;
  readonly current: boolean;
  readonly href: string;
  readonly link: InboxRowLink;
  readonly thread: InboxReviewThread;
}) => {
  const t = useTranslations("InboxReviews.row");
  const format = useFormatter();
  const channelName = useChannelName();
  const day = useDay();

  const average =
    thread.averageRating === null
      ? "none"
      : format.number(thread.averageRating, { maximumFractionDigits: 1 });

  const total =
    thread.totalReviewCount === null
      ? "none"
      : format.number(thread.totalReviewCount);

  const figures = t("figures", { average, total });

  const counts = t("counts", {
    reviews: thread.reviews,
    unanswered: thread.unanswered,
  });

  return (
    <InboxRow
      current={current}
      href={href}
      link={link}
      title={t("location", { channel: channelName(channel) })}
      under={figures === "" ? counts : `${counts} · ${figures}`}
      waiting={thread.unanswered > 0}
      when={thread.lastReviewAt === null ? null : day(thread.lastReviewAt)}
    />
  );
};

/** A conversation: who is in it, on which channel, whether it is read. */
export const ConversationRowView = ({
  channel,
  conversation,
  current,
  href,
  link,
}: {
  /** The conversation's channel, unless it was disconnected since. */
  readonly channel: SocialChannel | undefined;
  readonly conversation: InboxConversation;
  readonly current: boolean;
  readonly href: string;
  readonly link: InboxRowLink;
}) => {
  const t = useTranslations("InboxMessages.row");
  const channelName = useChannelName();
  const day = useDay();

  const people = conversation.participants
    .map(({ displayName, handle }) => displayName ?? handle)
    .join(", ");

  return (
    <InboxRow
      current={current}
      href={href}
      link={link}
      title={t("with", { people })}
      under={[
        conversation.unread ? t("unread") : t("read"),
        channelName(channel),
        t("count", { count: conversation.messages }),
      ].join(" · ")}
      waiting={conversation.unread}
      when={day(conversation.lastMessageAt)}
    />
  );
};
