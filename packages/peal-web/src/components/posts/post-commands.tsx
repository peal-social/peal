"use client";

import { DateTime, Option } from "effect";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
} from "lucide-react";
import {
  useFormatter,
  useLocale,
  useTimeZone,
  useTranslations,
} from "next-intl";
import type { Permission, Post, SocialChannel } from "peal-contract";
import { toast } from "peal-ui/components/toast";

import { channelName } from "#channels/channel-name.ts";
import { useDuplicatePost } from "#components/posts/duplicate-post.tsx";
import { choiceOfPhrase } from "#components/posts/schedule-fields.tsx";
import { useMovePost } from "#components/posts/use-move-post.ts";
import type { PageCommand } from "#components/shell/command-scope.tsx";
import { usePageCommands } from "#components/shell/command-scope.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";
import { mayDuplicate } from "#posts/duplicate.ts";
import { dateKey, timeKey, wallClockOf } from "#posts/zoned-time.ts";

/** How much of a post's text names it in the command menu's chip. */
export const chipLength = 40;

/** The start of a post's text, on one line, or null for a post without. */
export const excerptOf = (text: string): string | null => {
  const line = text.replaceAll(/\s+/gu, " ").trim();

  if (line === "") {
    return null;
  }

  return line.length > chipLength
    ? `${line.slice(0, chipLength - 1).trimEnd()}…`
    : line;
};

/**
 * Offers the command menu what a post's page can do with it: duplicate it,
 * copy the page's link, show it on the calendar on its day, and open it on
 * each platform where it went out.
 */
export const usePostCommands = ({
  channels,
  permissions,
  post,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly permissions: readonly Permission[];
  readonly post: Post;
  readonly workspaceId: string;
}): void => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("CommandMenu.post");
  const posts = useTranslations("Posts");
  const timeZone = useTimeZone() ?? "UTC";
  const locale = useLocale();
  const format = useFormatter();
  const timeOptions = useTimeOptions();
  const duplicate = useDuplicatePost(workspaceId);
  const movePost = useMovePost(workspaceId, timeZone);

  const day =
    post.schedule === null
      ? Option.none()
      : wallClockOf(post.schedule.at, timeZone).pipe(
          Option.map(({ date }) => dateKey(date))
        );

  // A post that waits for its time moves, on its own clock, as the
  // composer's "Type when" reads a date.
  const { schedule } = post;

  const movable =
    schedule !== null &&
    (post.status === "scheduled" || post.status === "awaitingApproval") &&
    permissions.includes("post:schedule");

  const reschedule: PageCommand[] =
    movable && schedule !== null
      ? Option.match(wallClockOf(schedule.at, schedule.timeZone), {
          onNone: () => [],
          onSome: ({ date, time }) => [
            {
              ask: {
                answer: (text: string) => {
                  const now = DateTime.nowUnsafe();

                  const read = choiceOfPhrase(
                    text,
                    { date, time: timeKey(time), timeZone: schedule.timeZone },
                    locale === "en" ? "monthFirst" : "dayFirst",
                    now
                  );

                  if (read.kind === "empty" || read.kind === "unread") {
                    return null;
                  }

                  if (read.kind === "past") {
                    return {
                      label: t("reschedulePast", { at: said(read.at) }),
                    };
                  }

                  return {
                    detail: format.relativeTime(DateTime.toDate(read.at), {
                      now: DateTime.toDate(now),
                    }),
                    label: t("rescheduleTo", { at: said(read.at) }),
                    run: async () => {
                      await movePost({
                        at: read.at,
                        from: schedule.at,
                        postId: post.id,
                        queueId: post.queueId,
                        scheduleZone: schedule.timeZone,
                      });
                    },
                  };
                },
                hint: t("rescheduleHint"),
                placeholder: t("reschedulePlaceholder"),
              },
              icon: CalendarClockIcon,
              id: "reschedule",
              keywords: [t("rescheduleKeyword")],
              label: t("reschedule"),
            },
          ],
        })
      : [];

  const said = (at: DateTime.DateTime) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: schedule?.timeZone ?? timeZone,
      ...timeOptions,
    });

  const live = post.targets.flatMap((target) => {
    const channel = channels.find(({ id }) => id === target.channelId);

    return target.permalink === null || channel === undefined
      ? []
      : [{ channel, permalink: target.permalink, targetId: target.id }];
  });

  const commands: PageCommand[] = [
    ...reschedule,
    ...(mayDuplicate(permissions)
      ? [
          {
            icon: CopyIcon,
            id: "duplicate",
            label: t("duplicate"),
            run: async () => {
              await duplicate(post.id);
            },
          },
        ]
      : []),
    {
      icon: LinkIcon,
      id: "copy-link",
      label: t("copyLink"),
      run: async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast.success(t("linkCopied"));
        } catch {
          toast.error(t("copyFailed"));
        }
      },
    },
    ...Option.match(day, {
      onNone: () => [],
      onSome: (date) => [
        {
          href: workspaceHref(
            workspaceId,
            `/posts?layout=calendar&date=${date}`
          ),
          icon: CalendarDaysIcon,
          id: "calendar",
          label: t("onCalendar"),
        },
      ],
    }),
    ...live.map(({ channel, permalink, targetId }) => ({
      href: permalink,
      icon: ExternalLinkIcon,
      id: `live-${targetId}`,
      keywords: [channel.handle],
      label: t("viewOn", {
        channel: channelName(channel),
        platform: posts("platform", { platform: channel.platform }),
      }),
      outside: true,
    })),
  ];

  usePageCommands({
    commands,
    heading: t("heading"),
    label: excerptOf(post.content.text) ?? t("untitled"),
  });
};

/** `usePostCommands` as a part of the page: it renders nothing. */
export const PostCommands = (props: Parameters<typeof usePostCommands>[0]) => {
  usePostCommands(props);

  return null;
};
