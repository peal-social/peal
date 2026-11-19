"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import {
  CircleDotIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  RadioTowerIcon,
  StarIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  inboxMessageRetentionDays,
  inboxPlatforms,
  inboxReviewRetentionDays,
  isSocialChannel,
} from "peal-contract";
import type { SocialChannel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListViews,
  viewTabClass,
} from "peal-ui/components/list-toolbar";
import { Skeleton } from "peal-ui/components/skeleton";
import { useState } from "react";
import type { ReactNode } from "react";

import { channelsOf } from "#channels/channels-api.ts";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link, usePathname, useRouter } from "#i18n/navigation.ts";
import { threadPage } from "#inbox/atoms.ts";
import type { ThreadFilter } from "#inbox/atoms.ts";
import {
  everyThread,
  inboxStateOf,
  knownThreadFilter,
  withInboxQuery,
} from "#inbox/inbox-query.ts";
import type { InboxState, InboxView } from "#inbox/inbox-query.ts";
import { conversationList } from "#inbox/message-atoms.ts";
import { reviewLocations } from "#inbox/review-atoms.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

import {
  ConversationRowView,
  ReviewThreadRowView,
  ThreadRowView,
} from "./inbox-rows.tsx";
import type { InboxRowLink } from "./inbox-rows.tsx";
import { CollectionNote, useChannelName } from "./inbox-views.tsx";

// How often a list is read again while its tab is visible.
const refreshEvery = 60_000;

// A row's link: the app's, the list staying where it is.
const RowLink: InboxRowLink = ({ children, ...props }) => (
  <Link {...props} scroll={false}>
    {children}
  </Link>
);

const Loading = () => {
  const t = useTranslations("InboxList");

  return (
    <div className="flex flex-col gap-2 p-4" aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
};

const LoadFailed = ({ onRetry }: { readonly onRetry: () => void }) => {
  const t = useTranslations("InboxList");

  return (
    <div className="p-4">
      <Alert variant="destructive">
        <AlertDescription>
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("loadFailed")}
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t("retry")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
};

const Rows = ({ children }: { readonly children: ReactNode }) => (
  <ul className="divide-y">{children}</ul>
);

// What the rows need of the list: where each opens, and the one open.
interface RowPlace {
  readonly channels: readonly SocialChannel[];
  readonly hrefOf: (rest: string) => string;
  readonly isOpen: (href: string) => boolean;
}

// A page of comments, then the pages after it that "Show more" opened.
// Each page starts where the one before ends, and reads itself again
// while the tab is visible.
const ThreadPages = ({
  cursor,
  filter,
  more,
  onClear,
  onMore,
  place,
  workspaceId,
}: {
  readonly cursor: string | null;
  readonly filter: ThreadFilter;
  // How many pages to show after this one.
  readonly more: number;
  readonly onClear: () => void;
  readonly onMore: () => void;
  readonly place: RowPlace;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxList");
  const lists = useTranslations("Lists");
  const page = threadPage(workspaceId, filter, cursor);
  const result = useAtomValue(page);
  const reload = useAtomRefresh(page);

  useRefreshWhileVisible(reload, refreshEvery);

  return AsyncResult.match(result, {
    onFailure: () => <LoadFailed onRetry={reload} />,
    onInitial: () => <Loading />,
    onSuccess: ({ value }) => {
      if (cursor === null && value.items.length === 0) {
        const filtered = filter.unanswered || filter.channelId !== null;

        return (
          <EmptyState>
            <EmptyStateIcon icon={<MessageSquareIcon />} />
            <EmptyStateTitle>
              {filtered ? t("noMatch") : t("noComments")}
            </EmptyStateTitle>
            {filtered ? (
              <EmptyStateActions>
                <Button variant="outline" size="sm" onClick={onClear}>
                  {lists("clear")}
                </Button>
              </EmptyStateActions>
            ) : (
              <CollectionNote />
            )}
          </EmptyState>
        );
      }

      const next = value.nextCursor;

      return (
        <>
          <Rows>
            {value.items.map((thread) => {
              const href = place.hrefOf(`/inbox/${thread.id}`);

              return (
                <ThreadRowView
                  key={thread.id}
                  channel={place.channels.find(
                    ({ id }) => id === thread.channelId
                  )}
                  current={place.isOpen(href)}
                  href={href}
                  link={RowLink}
                  thread={thread}
                />
              );
            })}
          </Rows>
          {next !== null && more > 0 ? (
            <ThreadPages
              cursor={next}
              filter={filter}
              more={more - 1}
              place={place}
              workspaceId={workspaceId}
              onClear={onClear}
              onMore={onMore}
            />
          ) : null}
          {next !== null && more === 0 ? (
            <div className="flex justify-center p-3">
              <Button variant="ghost" size="sm" onClick={onMore}>
                {t("showMore")}
              </Button>
            </div>
          ) : null}
        </>
      );
    },
  });
};

// The comments of one filter: choosing another starts from its first page.
const Comments = ({
  filter,
  onClear,
  place,
  workspaceId,
}: {
  readonly filter: ThreadFilter;
  readonly onClear: () => void;
  readonly place: RowPlace;
  readonly workspaceId: string;
}) => {
  const [more, setMore] = useState(0);

  return (
    <ThreadPages
      cursor={null}
      filter={filter}
      more={more}
      place={place}
      workspaceId={workspaceId}
      onClear={onClear}
      onMore={() => {
        setMore((shown) => shown + 1);
      }}
    />
  );
};

const Reviews = ({
  place,
  workspaceId,
}: {
  readonly place: RowPlace;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxList");
  const page = reviewLocations(workspaceId);
  const result = useAtomValue(page);
  const reload = useAtomRefresh(page);

  useRefreshWhileVisible(reload, refreshEvery);

  return AsyncResult.match(result, {
    onFailure: () => <LoadFailed onRetry={reload} />,
    onInitial: () => <Loading />,
    onSuccess: ({ value }) =>
      value.items.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={<StarIcon />} />
          <EmptyStateTitle>{t("noReviews")}</EmptyStateTitle>
          <EmptyStateDescription>
            {t("reviewsKept", { days: inboxReviewRetentionDays })}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <Rows>
          {value.items.map((thread) => {
            const href = place.hrefOf(`/inbox/reviews/${thread.id}`);

            return (
              <ReviewThreadRowView
                key={thread.id}
                channel={place.channels.find(
                  ({ id }) => id === thread.channelId
                )}
                current={place.isOpen(href)}
                href={href}
                link={RowLink}
                thread={thread}
              />
            );
          })}
        </Rows>
      ),
  });
};

const Messages = ({
  mayChooseChannels,
  place,
  workspaceId,
}: {
  readonly mayChooseChannels: boolean;
  readonly place: RowPlace;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxList");
  const workspaceHref = useWorkspaceHref();
  const page = conversationList(workspaceId);
  const result = useAtomValue(page);
  const reload = useAtomRefresh(page);

  useRefreshWhileVisible(reload, refreshEvery);

  return AsyncResult.match(result, {
    onFailure: () => <LoadFailed onRetry={reload} />,
    onInitial: () => <Loading />,
    onSuccess: ({ value }) =>
      value.items.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={<MessagesSquareIcon />} />
          <EmptyStateTitle>{t("noMessages")}</EmptyStateTitle>
          <EmptyStateDescription>
            {t("messagesKept", { days: inboxMessageRetentionDays })}
          </EmptyStateDescription>
          {mayChooseChannels ? (
            <EmptyStateActions>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={workspaceHref(workspaceId, "/settings/messages")}
                  />
                }
              >
                {t("messageSettings")}
              </Button>
            </EmptyStateActions>
          ) : null}
        </EmptyState>
      ) : (
        <Rows>
          {value.items.map((conversation) => {
            const href = place.hrefOf(`/inbox/messages/${conversation.id}`);

            return (
              <ConversationRowView
                key={conversation.id}
                channel={place.channels.find(
                  ({ id }) => id === conversation.channelId
                )}
                conversation={conversation}
                current={place.isOpen(href)}
                href={href}
                link={RowLink}
              />
            );
          })}
        </Rows>
      ),
  });
};

const viewIcons = {
  comments: MessageSquareIcon,
  messages: MessagesSquareIcon,
  reviews: StarIcon,
} as const;

/**
 * The inbox's list pane (DESIGN.md, "Split view"): its tabs (comments,
 * the locations' reviews where the workspace has some, and the direct
 * messages for members who may read them), the comments' Filter in the
 * pane's header with its chips, and the rows, each opening its item
 * beside the list. What it shows lives in the address. It renders in the
 * browser, where the reader's time zone is known.
 */
export const InboxList = ({
  mayChooseChannels,
  mayReadMessages,
  workspaceId,
}: {
  /** The member may choose whose messages Peal reads (channel:connect). */
  readonly mayChooseChannels: boolean;
  readonly mayReadMessages: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxList");
  const lists = useTranslations("Lists");
  const channelName = useChannelName();
  const hydrated = useHydrated();
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const pathname = usePathname();
  const asked = inboxStateOf(useSearchParams());
  const channels = useAtomValue(channelsOf(workspaceId));
  const reviews = useAtomValue(reviewLocations(workspaceId));
  const menu = useFilterMenu();

  // The inbox reads social channels only, never a website.
  const known = AsyncResult.isSuccess(channels)
    ? channels.value.filter(isSocialChannel)
    : [];

  // Only the channels whose platform Peal reads comments on.
  const readable = known.filter(({ platform }) =>
    inboxPlatforms.some((read) => read === platform)
  );

  const hasReviews =
    AsyncResult.isSuccess(reviews) && reviews.value.items.length > 0;

  const views = (["comments", "reviews", "messages"] as const).filter(
    (view) =>
      view === "comments" ||
      view === asked.view ||
      (view === "reviews" && hasReviews) ||
      (view === "messages" && mayReadMessages)
  );

  // A channel the address names that the inbox does not read is left
  // out once the channels are known.
  const state: InboxState = {
    filter: AsyncResult.isSuccess(channels)
      ? knownThreadFilter(
          asked.filter,
          readable.map(({ id }) => id)
        )
      : asked.filter,
    view: asked.view,
  };

  const inbox = workspaceHref(workspaceId, "/inbox");

  // The comments' filters change on the inbox itself, the item open left.
  const filterTo = (filter: ThreadFilter) => {
    router.replace(withInboxQuery(inbox, { ...state, filter }), {
      scroll: false,
    });
  };

  const place: RowPlace = {
    channels: known,
    hrefOf: (rest) => withInboxQuery(workspaceHref(workspaceId, rest), state),
    isOpen: (href) => href.split("?")[0] === pathname,
  };

  const { filter } = state;
  const chosen = readable.find(({ id }) => id === filter.channelId);
  const comments = state.view === "comments";

  const properties = [
    {
      icon: CircleDotIcon,
      id: "status",
      label: t("status"),
      values: [{ id: "waiting", label: t("waiting") }],
    },
    ...(readable.length > 1
      ? [
          {
            icon: RadioTowerIcon,
            id: "channel",
            label: t("channel"),
            values: readable.map((channel) => ({
              id: channel.id,
              label: channelName(channel),
            })),
          },
        ]
      : []),
  ];

  const tabOf = (view: InboxView) => {
    const Icon = viewIcons[view];
    const current = view === state.view;

    return (
      <Link
        key={view}
        href={withInboxQuery(inbox, {
          filter: view === "comments" ? filter : everyThread,
          view,
        })}
        scroll={false}
        className={viewTabClass(current)}
        {...(current ? { "aria-current": "page" as const } : {})}
      >
        <Icon aria-hidden />
        {t(view)}
      </Link>
    );
  };

  const list = (() => {
    if (!hydrated) {
      return <Loading />;
    }

    if (state.view === "reviews") {
      return <Reviews place={place} workspaceId={workspaceId} />;
    }

    if (state.view === "messages") {
      return (
        <Messages
          mayChooseChannels={mayChooseChannels}
          place={place}
          workspaceId={workspaceId}
        />
      );
    }

    return (
      <Comments
        key={`${filter.channelId ?? "all"}/${filter.unanswered ? "waiting" : "all"}`}
        filter={filter}
        place={place}
        workspaceId={workspaceId}
        onClear={() => {
          filterTo(everyThread);
        }}
      />
    );
  })();

  return (
    <>
      {comments ? (
        <PageActions>
          <FilterMenu
            chosen={{
              channel: filter.channelId === null ? [] : [filter.channelId],
              status: filter.unanswered ? ["waiting"] : [],
            }}
            properties={properties}
            state={menu}
            onChoose={(property, values) => {
              filterTo(
                property === "status"
                  ? { ...filter, unanswered: values.length > 0 }
                  : { ...filter, channelId: values[0] ?? null }
              );
            }}
          />
        </PageActions>
      ) : null}
      {views.length > 1 || (comments && (filter.unanswered || chosen)) ? (
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          {views.length > 1 ? (
            <ListViews aria-label={t("views")}>{views.map(tabOf)}</ListViews>
          ) : null}
          {comments && (filter.unanswered || chosen !== undefined) ? (
            <FilterChips aria-label={lists("filters")}>
              {filter.unanswered ? (
                <FilterChip
                  icon={<CircleDotIcon aria-hidden />}
                  join={lists("is")}
                  property={t("status")}
                  removeLabel={lists("remove", { property: t("status") })}
                  value={t("waiting")}
                  onEdit={() => {
                    menu.openAt("status");
                  }}
                  onRemove={() => {
                    filterTo({ ...filter, unanswered: false });
                  }}
                />
              ) : null}
              {chosen === undefined ? null : (
                <FilterChip
                  icon={<RadioTowerIcon aria-hidden />}
                  join={lists("is")}
                  property={t("channel")}
                  removeLabel={lists("remove", { property: t("channel") })}
                  value={channelName(chosen)}
                  onEdit={() => {
                    menu.openAt("channel");
                  }}
                  onRemove={() => {
                    filterTo({ ...filter, channelId: null });
                  }}
                />
              )}
              <FilterChipsClear
                onClick={() => {
                  filterTo(everyThread);
                }}
              >
                {lists("clear")}
              </FilterChipsClear>
            </FilterChips>
          ) : null}
        </div>
      ) : null}
      <section
        aria-label={t(state.view)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {list}
      </section>
    </>
  );
};
