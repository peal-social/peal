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
import { useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, PointerEvent, ReactNode } from "react";

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
  heightOf,
  moveWidget,
  periodOf,
  periodRange,
  removeWidget,
  renameWidget,
  resizeWidget,
  setChannel,
  setPeriod,
  sizeFor,
  widthOf,
  workspaceFigures,
} from "#analytics/widgets.ts";
import type {
  Board,
  Figures,
  Period,
  Widget,
  WidgetHeight,
  WidgetKind,
  WidgetWidth,
} from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";
import {
  BestTimesTable,
  BestTimesView,
} from "#components/analytics/best-times-view.tsx";
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
  PostsRingBody,
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

/** How much room a widget has: the columns and rows it spans. */
interface Room {
  readonly height: WidgetHeight;
  readonly width: WidgetWidth;
}

/**
 * A widget's skeleton while its numbers are read: the headline's place,
 * then a faint chart.
 */
const WidgetLoading = ({ name }: { readonly name: string }) => {
  const t = useTranslations("Analytics.widgets");

  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 flex-col gap-4">
      <span className="sr-only">{t("loading", { name })}</span>
      <Skeleton className="h-7 w-28" />
      <svg
        aria-hidden="true"
        viewBox="0 0 200 60"
        preserveAspectRatio="none"
        className="text-muted mt-auto h-full max-h-40 min-h-12 w-full animate-pulse"
      >
        <path
          d="M0 48 C 20 44, 30 30, 50 34 S 80 50, 100 36 S 140 12, 160 22 S 190 16, 200 10 L 200 60 L 0 60 Z"
          fill="currentColor"
        />
      </svg>
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

// The first line of a post's text, once it is read; where it went out
// until then, or if it cannot be.
const PostFirstLine = ({
  fallback,
  postId,
  workspaceId,
}: {
  readonly fallback: string;
  readonly postId: string;
  readonly workspaceId: string;
}) => {
  const result = useAtomValue(workspacePost(workspaceId, postId));

  return AsyncResult.value(result).pipe(
    Option.map((post) => post.content.text.split("\n")[0]?.trim() ?? ""),
    Option.filter((line) => line !== ""),
    Option.getOrElse(() => fallback)
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
  readonly room: Room;
  readonly workspaceId: string;
}

// What a widget shows from figures, the workspace's or one channel's.
const FiguresBody = ({
  figures,
  kind,
  name,
  room,
}: {
  readonly figures: Figures;
  readonly kind: WidgetKind;
  readonly name: string;
  readonly room: Room;
}) => {
  switch (kind) {
    case "followers":
    case "engagement":
    case "reach":
    case "views": {
      return (
        <DayCountBody count={kind} figures={figures} name={name} room={room} />
      );
    }

    case "posts": {
      return <PostsRingBody figures={figures} room={room} />;
    }

    case "impressions":
    case "clicks":
    case "saves": {
      return <StatBody count={kind} figures={figures} room={room} />;
    }

    case "activity": {
      return <ActivityBody figures={figures} name={name} room={room} />;
    }

    case "comparison":
    case "topPosts":
    case "channels":
    case "platforms":
    case "bestTimes":
    case "export": {
      return <ComparisonBody figures={figures} room={room} />;
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
  room,
  workspaceId,
}: {
  readonly channelId: string;
  readonly dashboard: AnalyticsDashboard;
  readonly kind: WidgetKind;
  readonly name: string;
  readonly range: SummaryRange;
  readonly room: Room;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics.widgets");
  const query = analyticsChannel(workspaceId, channelId, range);
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);

  return AsyncResult.match(result, {
    onFailure: () => <WidgetFailed name={name} retry={retry} />,
    onInitial: () => <WidgetLoading name={name} />,
    onSuccess: ({ value }) =>
      Option.match(channelFigures(dashboard, value), {
        onNone: () => (
          <p className="text-muted-foreground text-sm">{t("noDays")}</p>
        ),
        onSome: (figures) => (
          <FiguresBody figures={figures} kind={kind} name={name} room={room} />
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
  room,
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
          room={room}
          workspaceId={workspaceId}
        />
      );
    }

    case "channels": {
      return (
        <ChannelsBody channels={channels} dashboard={dashboard} room={room} />
      );
    }

    case "platforms": {
      return <PlatformsBody dashboard={dashboard} room={room} />;
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
          room={room}
        />
      ) : (
        <ChannelBody
          channelId={channelId}
          dashboard={dashboard}
          kind={kind}
          name={name}
          range={range}
          room={room}
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
    onInitial: () => <WidgetLoading name={props.name} />,
    onSuccess: ({ value }) => <DashboardBody {...props} dashboard={value} />,
  });
};

const BestTimesData = ({
  channelId,
  compact,
  name,
  period,
  timeZone,
  workspaceId,
}: {
  readonly channelId: string;
  readonly compact: boolean;
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
    onInitial: () => <WidgetLoading name={name} />,
    onSuccess: ({ value }) => (
      <>
        <BestTimesView compact={compact} found={value} />
        <div className="sr-only">
          <BestTimesTable found={value} />
        </div>
      </>
    ),
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
        compact={props.room.height === 1}
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

interface Resize {
  readonly id: string;
  readonly room: Room;
}

// Which side of a widget the pointer is on: a widget as wide as the
// board has others above and below it, a narrower one beside it.
const sideOf = (event: DragEvent<HTMLElement>, full: boolean): DropSide => {
  const box = event.currentTarget.getBoundingClientRect();

  const before = full
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

// A computed length in pixels ("24px"), or none.
const pixels = (value: string): number =>
  Number(value.replace(/px$/u, "")) || 0;

// What an arrow key does to a widget's size: columns, then rows.
const stepOf = (key: string): readonly [number, number] | null => {
  switch (key) {
    case "ArrowRight": {
      return [1, 0];
    }

    case "ArrowLeft": {
      return [-1, 0];
    }

    case "ArrowDown": {
      return [0, 1];
    }

    case "ArrowUp": {
      return [0, -1];
    }

    default: {
      return null;
    }
  }
};

/** The board's cells as laid out: one column's width, one row's height. */
const cellOf = (grid: HTMLElement) => {
  const style = getComputedStyle(grid);
  const columns = style.gridTemplateColumns.split(" ").length;
  const gap = pixels(style.columnGap);
  const rowGap = pixels(style.rowGap);
  const row = pixels(style.gridAutoRows) || 1;
  const column = (grid.clientWidth - gap * (columns - 1)) / columns;

  return { column, columns, gap, row, rowGap };
};

/**
 * The analytics page: a board of widgets the person arranges, each with
 * its own period, channel and size, kept in their browser for the
 * workspace. **Add widgets** sits in the page's actions; a widget moves
 * by dragging its handle, and resizes from its corner, by pointer or
 * with the arrow keys.
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
  const grid = useRef<HTMLUListElement>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Widget | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
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

  // Resizing by pointer: the widget follows the pointer by whole columns
  // and rows, its content blurred, and keeps the size once let go.
  const startResize = (
    event: PointerEvent<HTMLElement>,
    widget: Widget,
    start: Room
  ) => {
    const container = grid.current;

    if (container === null) {
      return;
    }

    event.preventDefault();

    const handle = event.currentTarget;
    const card = handle.parentElement?.getBoundingClientRect();
    const cell = cellOf(container);

    if (card === undefined) {
      return;
    }

    handle.setPointerCapture(event.pointerId);

    let room = start;

    const move = (moved: globalThis.PointerEvent) => {
      const next = sizeFor(
        widget.kind,
        Math.min(
          cell.columns,
          (moved.clientX - card.left + cell.gap) / (cell.column + cell.gap)
        ),
        (moved.clientY - card.top + cell.rowGap) / (cell.row + cell.rowGap)
      );

      room = next;
      setResize({ id: widget.id, room: next });
    };

    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setResize(null);
      update((current) =>
        resizeWidget(current, widget.id, room.width, room.height)
      );
    };

    setResize({ id: widget.id, room: start });
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  // Resizing by keyboard: the arrows widen, narrow, lengthen and shorten.
  const keyResize = (
    event: KeyboardEvent<HTMLElement>,
    widget: Widget,
    room: Room
  ) => {
    const step = stepOf(event.key);

    if (step === null) {
      return;
    }

    event.preventDefault();

    const next = sizeFor(
      widget.kind,
      room.width + step[0],
      room.height + step[1]
    );

    update((current) =>
      resizeWidget(current, widget.id, next.width, next.height)
    );
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
    const own: Room = { height: heightOf(widget), width: widthOf(widget) };
    const room = resize?.id === widget.id ? resize.room : own;
    const period = periodOf(widget);
    const channelId = channelOf(widget, channelIds);
    const channel = channels.find(({ id }) => id === channelId);
    const periodText = t("period", { period });
    const full = room.width === 4;

    return (
      <WidgetCardView
        name={name}
        width={room.width}
        height={room.height}
        resizing={resize?.id === widget.id}
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
          setDrop({ id: widget.id, side: sideOf(event, full) });
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
              sideOf(event, full)
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
            className="text-muted-foreground hover:bg-muted bg-card absolute top-6 left-0 z-10 hidden -translate-x-1/2 cursor-grab rounded-sm border py-1 opacity-0 transition-opacity select-none group-hover/widget:opacity-100 active:cursor-grabbing sm:block"
          >
            <GripVerticalIcon className="size-4" />
          </span>
        }
        resizer={
          <button
            type="button"
            aria-label={t("resize", { name })}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            title={t("resize", { name })}
            onPointerDown={(event) => {
              startResize(event, widget, own);
            }}
            onKeyDown={(event) => {
              keyResize(event, widget, own);
            }}
            className="focus-visible:ring-ring absolute right-1 bottom-1 z-10 hidden size-5 cursor-nwse-resize touch-none items-end justify-end rounded-sm opacity-0 outline-none group-hover/widget:opacity-100 group-data-[resizing]/widget:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 sm:flex"
          >
            <span
              aria-hidden="true"
              className="border-muted-foreground size-2.5 rounded-br-sm border-r-2 border-b-2"
            />
          </button>
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
          room={room}
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
        ref={grid}
        aria-label={t("boardLabel")}
        className="grid auto-rows-(--widget-row) grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
        style={{ "--widget-row": "20rem" }}
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
            const ownName = title.trim() === t("name", { kind: renaming.kind });

            update((current) =>
              renameWidget(current, renaming.id, ownName ? "" : title)
            );
            setRenaming(null);
          }}
        />
      )}
    </>
  );
};
