import { DateTime } from "effect";
import { useTranslations } from "next-intl";
import type { AgendaItem } from "peal-contract";
import { Badge } from "peal-ui/components/badge";
import type { ReactNode } from "react";

import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";

/** A link the page draws, so views stay apart from navigation. */
export type LinkTo = (href: string, label: string) => ReactNode;

/** The posts of the agenda that go out on the same day in the reader's zone. */
export interface AgendaDay {
  readonly day: string;
  readonly items: readonly AgendaItem[];
}

/**
 * The agenda's posts by day, as `dayOf` names a day (the reader's zone,
 * once hydrated), keeping their order: by time, then id.
 */
export const agendaDays = (
  items: readonly AgendaItem[],
  dayOf: (item: AgendaItem) => string
): AgendaDay[] => {
  const days: { day: string; items: AgendaItem[] }[] = [];

  for (const item of items) {
    const day = dayOf(item);
    const last = days.at(-1);

    if (last !== undefined && last.day === day) {
      last.items.push(item);
    } else {
      days.push({ day, items: [item] });
    }
  }

  return days;
};

/** One post of the agenda: its time, workspace, platforms and how it starts. */
export const AgendaItemView = ({
  item,
  linkTo,
  workspaceName,
}: {
  readonly item: AgendaItem;
  readonly linkTo: LinkTo;
  readonly workspaceName: string;
}) => {
  const t = useTranslations("Overview.agenda");
  const workspaceHref = useWorkspaceHref();
  const at = DateTime.toDate(item.scheduledAt);

  // None where the person may not read the workspace's channels; said
  // where the post has no channel left.
  const listed = item.platforms ?? [];
  const channels = useTranslations("ChannelsPage");

  const platforms =
    item.platforms !== null && listed.length === 0
      ? [t("noPlatform")]
      : listed.map((platform) => channels("platform", { platform }));

  return (
    <li className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4">
      <time
        dateTime={DateTime.formatIso(item.scheduledAt)}
        className="w-16 shrink-0 font-medium tabular-nums"
      >
        {t("time", { at })}
      </time>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{workspaceName}</span>
          {platforms.map((platform) => (
            <Badge key={platform} variant="outline">
              {platform}
            </Badge>
          ))}
          <Badge variant="secondary">
            {t("status", { status: item.status })}
          </Badge>
        </div>
        <p dir="auto" className="text-muted-foreground truncate">
          {linkTo(
            workspaceHref(item.workspaceId, `/posts/${item.postId}`),
            item.excerpt === "" ? t("noText") : item.excerpt
          )}
        </p>
      </div>
    </li>
  );
};

/** The agenda's posts, a list under each day's heading. */
export const AgendaDaysView = ({
  days,
  linkTo,
  workspaceNames,
}: {
  readonly days: readonly AgendaDay[];
  readonly linkTo: LinkTo;
  readonly workspaceNames: ReadonlyMap<string, string>;
}) => {
  const t = useTranslations("Overview.agenda");

  return (
    <div className="flex flex-col gap-6">
      {days.map(({ day, items }) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{day}</h2>
          <ul
            aria-label={t("listLabel", { day })}
            className="flex flex-col gap-2"
          >
            {items.map((item) => (
              <AgendaItemView
                key={item.postId}
                item={item}
                linkTo={linkTo}
                workspaceName={
                  workspaceNames.get(item.workspaceId) ?? item.workspaceId
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
