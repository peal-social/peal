"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { RadioTowerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { inboxPlatforms, isSocialChannel } from "peal-contract";
import type { SocialChannel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
  ListViews,
  viewTabClass,
} from "peal-ui/components/list-toolbar";
import { Skeleton } from "peal-ui/components/skeleton";
import { useId, useState } from "react";

import { channelsOf } from "#channels/channels-api.ts";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { Link, usePathname, useRouter } from "#i18n/navigation.ts";
import { threadPage } from "#inbox/atoms.ts";
import type { ThreadFilter } from "#inbox/atoms.ts";
import {
  knownThreadFilter,
  threadFilterOf,
  threadQueryOf,
} from "#inbox/thread-query.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

import {
  InboxEmptyView,
  ThreadRowView,
  useChannelName,
} from "./inbox-views.tsx";

// How often the list is read again while its tab is visible.
const refreshEvery = 60_000;

const appLink = (href: string, label: string) => (
  <Link href={href} className="underline-offset-4 hover:underline">
    {label}
  </Link>
);

const Loading = () => {
  const t = useTranslations("Inbox");

  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
};

// A page of threads, then the pages after it that "Load more" opened. Each
// page starts where the one before ends, and reads itself again while the
// tab is visible.
const ThreadPages = ({
  channels,
  cursor,
  filter,
  more,
  onMore,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly cursor: string | null;
  readonly filter: ThreadFilter;
  // How many pages to show after this one.
  readonly more: number;
  readonly onMore: () => void;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Inbox");
  const page = threadPage(workspaceId, filter, cursor);
  const result = useAtomValue(page);
  const reload = useAtomRefresh(page);

  useRefreshWhileVisible(reload, refreshEvery);

  return AsyncResult.match(result, {
    onFailure: () => (
      <Alert variant="destructive">
        <AlertDescription>
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("loadFailed")}
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    ),
    onInitial: () => <Loading />,
    onSuccess: ({ value }) => {
      if (cursor === null && value.items.length === 0) {
        return (
          <InboxEmptyView
            filtered={filter.unanswered || filter.channelId !== null}
          />
        );
      }

      const next = value.nextCursor;

      return (
        <>
          <ul className="bg-card divide-y overflow-hidden rounded-md border">
            {value.items.map((thread) => (
              <ThreadRowView
                key={thread.id}
                thread={thread}
                channel={channels.find(({ id }) => id === thread.channelId)}
                link={appLink}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
          {next !== null && more > 0 ? (
            <ThreadPages
              channels={channels}
              cursor={next}
              filter={filter}
              more={more - 1}
              workspaceId={workspaceId}
              onMore={onMore}
            />
          ) : null}
          {next !== null && more === 0 ? (
            <Button variant="outline" className="self-center" onClick={onMore}>
              {t("list.loadMore")}
            </Button>
          ) : null}
        </>
      );
    },
  });
};

// The pages of one filter: choosing another starts from its first page.
const FilteredThreads = ({
  channels,
  filter,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly filter: ThreadFilter;
  readonly workspaceId: string;
}) => {
  const [more, setMore] = useState(0);

  return (
    <ThreadPages
      channels={channels}
      cursor={null}
      filter={filter}
      more={more}
      workspaceId={workspaceId}
      onMore={() => {
        setMore((shown) => shown + 1);
      }}
    />
  );
};

/**
 * The workspace's inbox: the posts that have comments, those with a comment
 * waiting for an answer first, narrowed to those waiting or to one channel.
 * It renders in the browser, where the reader's time zone is known.
 */
export const ThreadsList = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Inbox");
  const lists = useTranslations("Lists");
  const channelName = useChannelName();
  const hydrated = useHydrated();
  const channels = useAtomValue(channelsOf(workspaceId));
  const router = useRouter();
  const pathname = usePathname();
  const asked = threadFilterOf(useSearchParams());
  const menu = useFilterMenu();
  const titleId = useId();

  if (!hydrated) {
    return <Loading />;
  }

  // The inbox reads social channels only, never a website.
  const known = AsyncResult.isSuccess(channels)
    ? channels.value.filter(isSocialChannel)
    : [];

  // Only the channels whose platform Peal reads comments on.
  const readable = known.filter(({ platform }) =>
    inboxPlatforms.some((read) => read === platform)
  );

  // A channel the address names that the inbox does not read is left
  // out once the channels are known.
  const filter = AsyncResult.isSuccess(channels)
    ? knownThreadFilter(
        asked,
        readable.map(({ id }) => id)
      )
    : asked;

  const hrefOf = (next: ThreadFilter) => {
    const written = threadQueryOf(next);

    return written === "" ? pathname : `${pathname}?${written}`;
  };

  const go = (next: ThreadFilter) => {
    router.replace(hrefOf(next), { scroll: false });
  };

  const chosen = readable.find(({ id }) => id === filter.channelId);

  const views = [
    { label: t("filter.all"), unanswered: false },
    { label: t("filter.unanswered"), unanswered: true },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ListToolbar>
          <ListViews aria-label={t("filter.views")}>
            {views.map((view) => (
              <Link
                key={view.label}
                href={hrefOf({ ...filter, unanswered: view.unanswered })}
                scroll={false}
                className={viewTabClass(view.unanswered === filter.unanswered)}
                {...(view.unanswered === filter.unanswered
                  ? { "aria-current": "page" as const }
                  : {})}
              >
                {view.label}
              </Link>
            ))}
          </ListViews>
          {readable.length > 1 ? (
            <ListToolbarEnd>
              <FilterMenu
                chosen={{
                  channel: filter.channelId === null ? [] : [filter.channelId],
                }}
                properties={[
                  {
                    icon: RadioTowerIcon,
                    id: "channel",
                    label: t("filter.channel"),
                    values: readable.map((channel) => ({
                      id: channel.id,
                      label: channelName(channel),
                    })),
                  },
                ]}
                state={menu}
                onChoose={(_, values) => {
                  go({ ...filter, channelId: values[0] ?? null });
                }}
              />
            </ListToolbarEnd>
          ) : null}
        </ListToolbar>
        {chosen === undefined ? null : (
          <FilterChips aria-label={lists("filters")}>
            <FilterChip
              icon={<RadioTowerIcon aria-hidden />}
              join={lists("is")}
              property={t("filter.channel")}
              removeLabel={lists("remove", {
                property: t("filter.channel"),
              })}
              value={channelName(chosen)}
              onEdit={() => {
                menu.openAt("channel");
              }}
              onRemove={() => {
                go({ ...filter, channelId: null });
              }}
            />
            <FilterChipsClear
              onClick={() => {
                go({ ...filter, channelId: null });
              }}
            >
              {lists("clear")}
            </FilterChipsClear>
          </FilterChips>
        )}
      </div>
      <section aria-labelledby={titleId} className="flex flex-col gap-4">
        <h2 id={titleId} className="sr-only">
          {t("list.title")}
        </h2>
        <FilteredThreads
          key={`${filter.channelId ?? "all"}/${filter.unanswered ? "waiting" : "all"}`}
          channels={known}
          filter={filter}
          workspaceId={workspaceId}
        />
      </section>
    </div>
  );
};
