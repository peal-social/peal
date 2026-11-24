"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Effect, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { GripVerticalIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnalyticsDashboard, SocialChannel } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Skeleton } from "peal-ui/components/skeleton";
import { toast } from "peal-ui/components/toast";
import { useState } from "react";
import type { DragEvent, ReactNode } from "react";

import {
  analyticsChannel,
  analyticsDashboard,
  bestTimes,
  exportUrl,
} from "#analytics/api.ts";
import type { SummaryRange } from "#analytics/api.ts";
import { useBoard } from "#analytics/board-store.ts";
import { notFollowed } from "#analytics/not-followed.ts";
import { todayIn } from "#analytics/report.ts";
import {
  addWidget,
  bestTimesDays,
  channelFigures,
  channelOf,
  defaultBoard,
  duplicateWidget,
  kinds,
  moveWidget,
  periodOf,
  periodRange,
  removeWidget,
  renameWidget,
  setChannel,
  setPeriod,
  workspaceFigures,
} from "#analytics/widgets.ts";
import type {
  Board,
  Figures,
  Period,
  Widget,
  WidgetKind,
} from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";
import { BestTimesView } from "#components/analytics/best-times-view.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useOfferUndo } from "#components/undo.tsx";
import { Link } from "#i18n/navigation.ts";
import { workspacePost } from "#posts/api.ts";

import { AddWidgets } from "./add-widgets.tsx";
import {
  ActivityBody,
  ChannelsBody,
  ComparisonBody,
  DayCountBody,
  ExportBody,
  PlatformsBody,
  StatBody,
  TopPostsBody,
} from "./widget-bodies.tsx";
import type { PostLinkProps } from "./widget-bodies.tsx";
import { WidgetCardView } from "./widget-card.tsx";
import type { DropSide } from "./widget-card.tsx";
import {
  RenameWidgetDialog,
  WidgetFilter,
  WidgetMenu,
} from "./widget-controls.tsx";

const newId = (): string => crypto.randomUUID();

/** A widget's skeleton while its numbers are read. */
const WidgetLoading = ({
  name,
  small,
}: {
  readonly name: string;
  readonly small: boolean;
}) => {
  const t = useTranslations("Analytics.widgets");

  return (
    <div aria-busy="true">
      <span className="sr-only">{t("loading", { name })}</span>
      {small ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Skeleton className="h-56 w-full" />
      )}
    </div>
  );
};

/** A widget whose numbers could not be read, with a way to read again. */
const WidgetFailed = ({
  name,
  retry,
}: {
  readonly name: string;
  readonly retry: () => void;
}) => {
  const t = useTranslations("Analytics.widgets");

  return (
    <div className="flex flex-col items-start gap-3" role="alert">
      <p className="text-sm">{t("loadFailed", { name })}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
};

// The first line of a post's text, once it is read; nothing if it cannot be.
const PostFirstLine = ({
  postId,
  workspaceId,
}: {
  readonly postId: string;
  readonly workspaceId: string;
}) => {
  const result = useAtomValue(workspacePost(workspaceId, postId));

  return AsyncResult.value(result).pipe(
    Option.map((post) => post.content.text.split("\n")[0]?.trim() ?? ""),
    Option.filter((line) => line !== ""),
    Option.getOrNull
  );
};

// A top post's line, as a link to its page.
const PostLink = ({ children, postId, workspaceId }: PostLinkProps) => {
  const workspaceHref = useWorkspaceHref();

  return (
    <Link
      href={workspaceHref(workspaceId, `/posts/${postId}`)}
      className="focus-visible:ring-ring block rounded-md outline-none focus-visible:ring-3"
    >
      {children}
    </Link>
  );
};

interface BodyProps {
  readonly channelId: string | null;
  readonly channels: readonly SocialChannel[];
  readonly kind: WidgetKind;
  readonly name: string;
  readonly range: SummaryRange;
  readonly workspaceId: string;
}

const isSmall = (kind: WidgetKind): boolean => kinds[kind].size === "small";

// What a widget shows from figures, the workspace's or one channel's.
const FiguresBody = ({
  figures,
  kind,
  name,
}: {
  readonly figures: Figures;
  readonly kind: WidgetKind;
  readonly name: string;
}) => {
  switch (kind) {
    case "followers":
    case "engagement":
    case "views": {
      return <DayCountBody count={kind} figures={figures} name={name} />;
    }

    case "posts":
    case "impressions":
    case "reach":
    case "clicks":
    case "saves": {
      return <StatBody count={kind} figures={figures} />;
    }

    case "activity": {
      return <ActivityBody figures={figures} />;
    }

    case "comparison":
    case "topPosts":
    case "channels":
    case "platforms":
    case "bestTimes":
    case "export": {
      return <ComparisonBody figures={figures} />;
    }

    default: {
      return kind satisfies never;
    }
  }
};

// One channel's figures: its series beside the dashboard of the range.
const ChannelBody = ({
  channelId,
  dashboard,
  kind,
  name,
  range,
  workspaceId,
}: {
  readonly channelId: string;
  readonly dashboard: AnalyticsDashboard;
  readonly kind: WidgetKind;
  readonly name: string;
  readonly range: SummaryRange;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics.widgets");
  const query = analyticsChannel(workspaceId, channelId, range);
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);

  return AsyncResult.match(result, {
    onFailure: () => <WidgetFailed name={name} retry={retry} />,
    onInitial: () => <WidgetLoading name={name} small={isSmall(kind)} />,
    onSuccess: ({ value }) =>
      Option.match(channelFigures(dashboard, value), {
        onNone: () => (
          <p className="text-muted-foreground text-sm">{t("noDays")}</p>
        ),
        onSome: (figures) => (
          <FiguresBody figures={figures} kind={kind} name={name} />
        ),
      }),
  });
};

// The dashboard's answer, as each kind that reads it shows it.
const DashboardBody = ({
  channelId,
  channels,
  dashboard,
  kind,
  name,
  range,
  workspaceId,
}: BodyProps & { readonly dashboard: AnalyticsDashboard }) => {
  switch (kind) {
    case "topPosts": {
      return (
        <TopPostsBody
          channels={channels}
          dashboard={dashboard}
          Excerpt={PostFirstLine}
          PostLink={PostLink}
          workspaceId={workspaceId}
        />
      );
    }

    case "channels": {
      return <ChannelsBody channels={channels} dashboard={dashboard} />;
    }

    case "platforms": {
      return <PlatformsBody dashboard={dashboard} />;
    }

    case "followers":
    case "engagement":
    case "views":
    case "posts":
    case "impressions":
    case "reach":
    case "clicks":
    case "saves":
    case "activity":
    case "comparison":
    case "bestTimes":
    case "export": {
      return channelId === null ? (
        <FiguresBody
          figures={workspaceFigures(dashboard)}
          kind={kind}
          name={name}
        />
      ) : (
        <ChannelBody
          channelId={channelId}
          dashboard={dashboard}
          kind={kind}
          name={name}
          range={range}
          workspaceId={workspaceId}
        />
      );
    }

    default: {
      return kind satisfies never;
    }
  }
};

const DashboardData = (props: BodyProps) => {
  const query = analyticsDashboard(props.workspaceId, props.range);
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);

  return AsyncResult.match(result, {
    onFailure: () => <WidgetFailed name={props.name} retry={retry} />,
    onInitial: () => (
      <WidgetLoading name={props.name} small={isSmall(props.kind)} />
    ),
    onSuccess: ({ value }) => <DashboardBody {...props} dashboard={value} />,
  });
};

const BestTimesData = ({
  channelId,
  name,
  period,
  timeZone,
  workspaceId,
}: {
  readonly channelId: string;
  readonly name: string;
  readonly period: Period;
  readonly timeZone: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics.bestTimes");

  const query = bestTimes(
    workspaceId,
    channelId,
    bestTimesDays(period),
    timeZone
  );

  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);

  return AsyncResult.match(result, {
    onFailure: ({ cause }) =>
      notFollowed(cause) ? (
        <p className="text-muted-foreground text-sm">{t("notFollowed")}</p>
      ) : (
        <WidgetFailed name={name} retry={retry} />
      ),
    onInitial: () => <WidgetLoading name={name} small={false} />,
    onSuccess: ({ value }) => <BestTimesView found={value} />,
  });
};

const WidgetBody = (
  props: BodyProps & { readonly period: Period; readonly timeZone: string }
) => {
  const t = useTranslations("Analytics.widgets");

  if (props.kind === "export") {
    return (
      <ExportBody
        accounts={exportUrl(props.workspaceId, "accounts", props.range)}
        posts={exportUrl(props.workspaceId, "posts", props.range)}
      />
    );
  }

  if (props.kind === "bestTimes") {
    return props.channelId === null ? (
      <p className="text-muted-foreground text-sm">{t("noChannel")}</p>
    ) : (
      <BestTimesData
        channelId={props.channelId}
        name={props.name}
        period={props.period}
        timeZone={props.timeZone}
        workspaceId={props.workspaceId}
      />
    );
  }

  return <DashboardData {...props} />;
};

interface Drop {
  readonly id: string;
  readonly side: DropSide;
}

// Which side of a widget the pointer is on: a wide widget has others above
// and below it, a smaller one beside it.
const sideOf = (event: DragEvent<HTMLElement>, wide: boolean): DropSide => {
  const box = event.currentTarget.getBoundingClientRect();

  const before = wide
    ? event.clientY < box.top + box.height / 2
    : event.clientX < box.left + box.width / 2;

  return before ? "before" : "after";
};

/** Where the board places a widget dropped on another's side. */
const dropIndex = (
  board: Board,
  dragged: string,
  target: string,
  side: DropSide
): number =>
  board.widgets
    .filter(({ id }) => id !== dragged)
    .findIndex(({ id }) => id === target) + (side === "after" ? 1 : 0);

/**
 * The analytics page: a board of widgets the person arranges, each with
 * its own period and channel, kept in their browser for the workspace.
 * **Add widgets** sits in the page's actions; a widget moves by dragging
 * its handle.
 */
export const AnalyticsBoard = ({
  channels,
  timeZone,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly timeZone: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics.widgets");
  const [board, update] = useBoard(workspaceId);
  const offerUndo = useOfferUndo();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Widget | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const today = todayIn(timeZone);
  const channelIds = channels.map(({ id }) => id);

  // A change the toast offers to take back: the board as it was.
  const undoable = (message: string, change: (current: Board) => Board) => {
    const before = board;

    update(change);
    offerUndo({
      message,
      undo: async () => {
        await Effect.runPromise(
          Effect.sync(() => {
            update(() => before);
          })
        );
      },
    });
  };

  const endDrag = () => {
    setDragged(null);
    setDrop(null);
  };

  const openSheet = () => {
    setAdding(true);
  };

  const actions = (
    <PageActions>
      <Button variant="ghost" size="sm" onClick={openSheet}>
        <PlusIcon aria-hidden />
        {t("add")}
      </Button>
    </PageActions>
  );

  const sheet = (
    <AddWidgets
      open={adding}
      onOpenChange={setAdding}
      onAdd={(kind) => {
        update((current) => addWidget(current, kind, newId()));
        toast.success(t("added", { name: t("name", { kind }) }));
      }}
      onReset={() => {
        undoable(t("resetDone"), () => defaultBoard);
      }}
    />
  );

  if (board.widgets.length === 0) {
    return (
      <>
        {actions}
        {sheet}
        <EmptyState className="min-h-0">
          <EmptyStateIcon icon={<LayoutGridIcon />} />
          <EmptyStateTitle>{t("emptyTitle")}</EmptyStateTitle>
          <EmptyStateDescription>{t("emptyText")}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={openSheet}>
              <PlusIcon aria-hidden />
              {t("add")}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </>
    );
  }

  const card = (widget: Widget): ReactNode => {
    const name = widget.title ?? t("name", { kind: widget.kind });
    const { size } = kinds[widget.kind];
    const period = periodOf(widget);
    const channelId = channelOf(widget, channelIds);
    const channel = channels.find(({ id }) => id === channelId);
    const periodText = t("period", { period });

    return (
      <WidgetCardView
        name={name}
        size={size}
        subtitle={
          channel === undefined
            ? periodText
            : `${periodText} · ${channelName(channel)}`
        }
        dragging={dragged === widget.id}
        dropSide={drop?.id === widget.id ? drop.side : null}
        onDragOver={(event) => {
          if (dragged === null || dragged === widget.id) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDrop({ id: widget.id, side: sideOf(event, size === "wide") });
        }}
        onDragLeave={(event) => {
          const { relatedTarget } = event;

          if (
            !(relatedTarget instanceof Node) ||
            !event.currentTarget.contains(relatedTarget)
          ) {
            setDrop(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();

          if (dragged !== null && dragged !== widget.id) {
            const at = dropIndex(
              board,
              dragged,
              widget.id,
              sideOf(event, size === "wide")
            );

            update((current) => moveWidget(current, dragged, at));
          }

          endDrag();
        }}
        handle={
          <span
            aria-hidden="true"
            draggable
            title={t("drag", { name })}
            onDragStart={(event) => {
              const article = event.currentTarget.parentElement;

              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", widget.id);

              if (article !== null) {
                event.dataTransfer.setDragImage(article, 24, 24);
              }

              setDragged(widget.id);
            }}
            onDragEnd={endDrag}
            className="text-muted-foreground hover:bg-muted bg-card absolute top-6 left-0 hidden -translate-x-1/2 cursor-grab rounded-sm border py-1 opacity-0 transition-opacity group-hover/widget:opacity-100 active:cursor-grabbing sm:block"
          >
            <GripVerticalIcon className="size-4" />
          </span>
        }
        actions={
          <>
            <WidgetFilter
              channelId={channelId}
              channels={channels}
              kind={widget.kind}
              name={name}
              period={period}
              onPeriod={(next) => {
                update((current) => setPeriod(current, widget.id, next));
              }}
              onChannel={(next) => {
                update((current) => setChannel(current, widget.id, next));
              }}
            />
            <WidgetMenu
              name={name}
              onDuplicate={() => {
                update((current) =>
                  duplicateWidget(current, widget.id, newId())
                );
                toast.success(t("duplicated", { name }));
              }}
              onRename={() => {
                setRenaming(widget);
              }}
              onRemove={() => {
                undoable(t("removed", { name }), (current) =>
                  removeWidget(current, widget.id)
                );
              }}
            />
          </>
        }
      >
        <WidgetBody
          channelId={channelId}
          channels={channels}
          kind={widget.kind}
          name={name}
          period={period}
          range={periodRange(period, today, timeZone)}
          timeZone={timeZone}
          workspaceId={workspaceId}
        />
      </WidgetCardView>
    );
  };

  return (
    <>
      {actions}
      {sheet}
      <ul
        aria-label={t("boardLabel")}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        {board.widgets.map((widget) => (
          <li key={widget.id} className="contents">
            {card(widget)}
          </li>
        ))}
      </ul>
      {renaming === null ? null : (
        <RenameWidgetDialog
          open
          current={renaming.title ?? t("name", { kind: renaming.kind })}
          onClose={() => {
            setRenaming(null);
          }}
          onRename={(title) => {
            // The kind's own name stays the kind's, in every language.
            const own = title.trim() === t("name", { kind: renaming.kind });

            update((current) =>
              renameWidget(current, renaming.id, own ? "" : title)
            );
            setRenaming(null);
          }}
        />
      )}
    </>
  );
};
