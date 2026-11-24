"use client";

import { defaultPreset, Feedback } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import type { DragDropEventHandlers } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
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
import { useRef, useState, useTransition } from "react";
import type { ComponentProps, KeyboardEvent, JSX, PointerEvent } from "react";
import { flushSync } from "react-dom";

import {
  analyticsChannel,
  analyticsDashboard,
  bestTimes,
  exportUrl,
} from "#analytics/api.ts";
import type { SummaryRange } from "#analytics/api.ts";
import { useBoard } from "#analytics/board-store.ts";
import { downloadExport } from "#analytics/export-download.ts";
import type { ExportOutcome } from "#analytics/export-download.ts";
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
  kinds,
  maxHeight,
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
import {
  RenameWidgetDialog,
  WidgetFilter,
  WidgetMenu,
} from "./widget-controls.tsx";

const newId = (): string => crypto.randomUUID();

// How widgets move: quick to start, long to settle, so a widget glides
// into place rather than stops there. The same curve carries the others
// aside as one passes, the one let go into its slot, and a resize to its
// snap.
const motion = "cubic-bezier(0.22, 1, 0.36, 1)";

const glide = { duration: 320, easing: motion };

// The board's drag: a widget let go settles into its slot along the same
// curve, from the keyboard too.
const boardPlugins = [
  ...defaultPreset.plugins,
  Feedback.configure({
    dropAnimation: { duration: 320, easing: motion },
    keyboardTransition: { duration: 220, easing: motion },
  }),
];

/**
 * A widget the board sorts: it follows the pointer in any direction from
 * its handle while the others glide aside, and the handle takes the
 * keyboard too (Space picks it up, the arrows carry it, Space puts it
 * down, Escape gives up).
 */
const SortableWidget = ({
  dragLabel,
  id,
  index,
  ...card
}: Omit<
  ComponentProps<typeof WidgetCardView>,
  "dragging" | "handle" | "ref"
> & {
  readonly dragLabel: string;
  readonly id: string;
  readonly index: number;
}) => {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    transition: glide,
  });

  return (
    <WidgetCardView
      {...card}
      widgetId={id}
      ref={ref}
      dragging={isDragging}
      handle={
        <button
          ref={handleRef}
          type="button"
          aria-label={dragLabel}
          title={dragLabel}
          className="group/grip focus-visible:ring-ring absolute top-6 right-full z-10 hidden w-6 cursor-grab touch-none justify-center rounded-sm opacity-0 transition-opacity outline-none select-none group-hover/widget:opacity-100 group-data-[dragging]/widget:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 active:cursor-grabbing sm:flex"
        >
          <GripVerticalIcon
            aria-hidden
            className="text-muted-foreground group-hover/grip:text-foreground size-4"
          />
        </button>
      }
    />
  );
};

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

// Saves an export of the range, and says so when the server refused it.
const ExportWidget = ({
  range,
  workspaceId,
}: {
  readonly range: SummaryRange;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics.export");
  const [busy, startDownload] = useTransition();

  return (
    <ExportBody
      busy={busy}
      onDownload={(kind) => {
        startDownload(async () => {
          const outcome = await downloadExport(
            workspaceId,
            exportUrl(kind, range),
            `peal-analytics-${kind}.csv`
          ).catch((): ExportOutcome => "Failed");

          // A workspace that now requires two-step verification shows its
          // notice in place of the page, as for every call.
          if (outcome === "SignedOut") {
            toast.error(t("signedOut"));
          } else if (outcome === "Refused") {
            toast.error(t("refused"));
          } else if (outcome === "Failed") {
            toast.error(t("failed"));
          }
        });
      }}
    />
  );
};

const WidgetBody = (
  props: BodyProps & { readonly period: Period; readonly timeZone: string }
) => {
  const t = useTranslations("Analytics.widgets");

  if (props.kind === "export") {
    return <ExportWidget range={props.range} workspaceId={props.workspaceId} />;
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

/**
 * Which way a resize pulls a widget: each of its edges and corners. The
 * signs say which side moves: 1 the end or bottom, -1 the start or top,
 * 0 neither.
 */
const pulls = {
  bottom: [0, 1],
  bottomEnd: [1, 1],
  bottomStart: [-1, 1],
  end: [1, 0],
  start: [-1, 0],
  top: [0, -1],
  topEnd: [1, -1],
  topStart: [-1, -1],
} as const;

type Pull = keyof typeof pulls;

// Where each handle sits and which cursor it shows. The edges' pills
// show on hover; the corners are reached by the pointer alone.
const handlePlaces: Readonly<Record<Pull, string>> = {
  bottom: "right-4 bottom-0 left-4 h-3 translate-y-1/2 cursor-ns-resize",
  bottomEnd: "right-0 bottom-0 size-4 translate-1/2 cursor-nwse-resize",
  bottomStart:
    "bottom-0 left-0 size-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  end: "top-4 right-0 bottom-4 w-3 translate-x-1/2 cursor-ew-resize",
  // Below the grip, which sits beside the name at the start edge.
  start: "top-16 bottom-4 left-0 w-3 -translate-x-1/2 cursor-ew-resize",
  top: "top-0 right-4 left-4 h-3 -translate-y-1/2 cursor-ns-resize",
  topEnd:
    "top-0 right-0 size-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  topStart: "top-0 left-0 size-4 -translate-1/2 cursor-nwse-resize",
};

// The pills drawn on the edges' handles; a corner draws none.
const pillOf: Readonly<Record<Pull, string | null>> = {
  bottom: "h-1 w-8",
  bottomEnd: null,
  bottomStart: null,
  end: "h-8 w-1",
  start: "h-8 w-1",
  top: "h-1 w-8",
  topEnd: null,
  topStart: null,
};

// The arrow keys a keyboard handle takes.
const keysOf: Partial<Record<Pull, string>> = {
  bottom: "ArrowUp ArrowDown",
  end: "ArrowLeft ArrowRight",
};

const pullOrder: readonly Pull[] = [
  "end",
  "bottom",
  "start",
  "top",
  "topStart",
  "topEnd",
  "bottomStart",
  "bottomEnd",
];

// Where every widget was before a change of size, so each glides to
// where it lands; and which one changed.
interface Layout {
  readonly changed: string;
  readonly rects: ReadonlyMap<string, DOMRect>;
}

const settle = { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

/** The widgets' boxes as laid out now, by id. */
const rectsOf = (grid: HTMLElement): ReadonlyMap<string, DOMRect> =>
  new Map(
    [...grid.querySelectorAll<HTMLElement>("[data-widget-id]")].map((item) => [
      item.dataset["widgetId"] ?? "",
      item.getBoundingClientRect(),
    ])
  );

/**
 * Glides each widget from where it was to where it is: the one resized
 * from the size it was let go at to the size it snapped to, the others
 * from their old place. Nothing moves for a reader who asked for less
 * motion.
 */
const glideFrom = (grid: HTMLElement, layout: Layout) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  for (const item of grid.querySelectorAll<HTMLElement>("[data-widget-id]")) {
    const id = item.dataset["widgetId"] ?? "";
    const before = layout.rects.get(id);
    const after = item.getBoundingClientRect();

    if (before === undefined) {
      continue;
    }

    const dx = before.left - after.left;
    const dy = before.top - after.top;
    const from = `translate(${String(dx)}px, ${String(dy)}px)`;

    if (id === layout.changed) {
      item.animate(
        [
          {
            height: `${String(before.height)}px`,
            transform: from,
            width: `${String(before.width)}px`,
          },
          {
            height: `${String(after.height)}px`,
            transform: "none",
            width: `${String(after.width)}px`,
          },
        ],
        settle
      );
    } else if (dx !== 0 || dy !== 0) {
      item.animate([{ transform: from }, { transform: "none" }], settle);
    }
  }
};

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

  // The widget being resized, while the pointer holds its edge.
  const [resizing, setResizing] = useState<{
    readonly id: string;
    readonly pull: Pull;
  } | null>(null);

  // A widget takes its new size: every widget's place is noted, the board
  // lays out anew at once, and each glides there from where it was.
  const commitSize = (widget: Widget, next: Room) => {
    const container = grid.current;
    const rects = container === null ? null : rectsOf(container);

    flushSync(() => {
      setResizing(null);
      update((current) =>
        resizeWidget(current, widget.id, next.width, next.height)
      );
    });

    if (container !== null && rects !== null) {
      glideFrom(container, { changed: widget.id, rects });
    }
  };

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

  // A widget dropped elsewhere: the board takes the order the pointer
  // left it in, which the others moved aside for as it went.
  const handleDragEnd: DragDropEventHandlers["onDragEnd"] = (event) => {
    const { source } = event.operation;

    if (event.canceled || !isSortable(source)) {
      return;
    }

    const { index, initialIndex } = source;

    if (index !== initialIndex) {
      update((current) => moveWidget(current, String(source.id), index));
    }
  };

  const openSheet = () => {
    setAdding(true);
  };

  // Resizing by pointer, as an edge is pulled: the widget follows the
  // pointer to the pixel over its neighbours, what it shows blurred, then
  // snaps to whole columns and rows once let go, and the board makes room.
  const startResize = (
    event: PointerEvent<HTMLElement>,
    widget: Widget,
    pull: Pull
  ) => {
    const [alongX, alongY] = pulls[pull];
    const container = grid.current;
    const handle = event.currentTarget;
    const item = handle.closest<HTMLElement>("[data-widget-id]");

    if (container === null || item === null) {
      return;
    }

    event.preventDefault();
    handle.setPointerCapture(event.pointerId);

    const cell = cellOf(container);
    const box = item.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    const least = kinds[widget.kind].minWidth;

    const narrowest =
      Math.min(least, cell.columns) * (cell.column + cell.gap) - cell.gap;

    // Pulled from its start, it may grow back to the board's start; from
    // its end, to the board's end. Its other side stays where it is.
    const widest =
      alongX < 0 ? box.right - bounds.left : bounds.right - box.left;

    const tallest = maxHeight * (cell.row + cell.rowGap) - cell.rowGap;
    const startX = event.clientX;
    const startY = event.clientY;
    let { width } = box;
    let { height } = box;
    let frame = 0;

    const paint = () => {
      frame = 0;
      item.style.setProperty("--resize-width", `${String(width)}px`);
      item.style.setProperty("--resize-height", `${String(height)}px`);
      // Pulled from its start or top, the card moves as it grows, so its
      // other edge stays put.
      item.style.setProperty(
        "--resize-x",
        `${String(alongX < 0 ? box.width - width : 0)}px`
      );
      item.style.setProperty(
        "--resize-y",
        `${String(alongY < 0 ? box.height - height : 0)}px`
      );
    };

    const move = (moved: globalThis.PointerEvent) => {
      if (alongX !== 0) {
        width = Math.min(
          widest,
          Math.max(narrowest, box.width + alongX * (moved.clientX - startX))
        );
      }

      if (alongY !== 0) {
        height = Math.min(
          tallest,
          Math.max(cell.row, box.height + alongY * (moved.clientY - startY))
        );
      }

      if (frame === 0) {
        frame = requestAnimationFrame(paint);
      }
    };

    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      cancelAnimationFrame(frame);
      paint();
      // The size it was let go at is noted before it snaps, so it glides.
      commitSize(
        widget,
        sizeFor(
          widget.kind,
          (width + cell.gap) / (cell.column + cell.gap),
          (height + cell.rowGap) / (cell.row + cell.rowGap)
        )
      );

      for (const property of [
        "--resize-width",
        "--resize-height",
        "--resize-x",
        "--resize-y",
      ]) {
        item.style.removeProperty(property);
      }
    };

    paint();
    setResizing({ id: widget.id, pull });
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

    commitSize(
      widget,
      sizeFor(widget.kind, room.width + step[0], room.height + step[1])
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

  const card = (widget: Widget, index: number): JSX.Element => {
    const name = widget.title ?? t("name", { kind: widget.kind });
    const own: Room = { height: heightOf(widget), width: widthOf(widget) };
    const room = own;
    const period = periodOf(widget);
    const channelId = channelOf(widget, channelIds);
    const channel = channels.find(({ id }) => id === channelId);
    const periodText = t("period", { period });

    return (
      <SortableWidget
        key={widget.id}
        id={widget.id}
        index={index}
        dragLabel={t("drag", { name })}
        name={name}
        width={room.width}
        height={room.height}
        resizing={resizing?.id === widget.id}
        subtitle={
          channel === undefined
            ? periodText
            : `${periodText} · ${channelName(channel)}`
        }
        resizer={
          <>
            {pullOrder.map((pull) => {
              // The end and bottom pills take the keyboard; the others
              // are the pointer's alone, so the card is two tab stops.
              const keyed = pull === "end" || pull === "bottom";

              const label =
                pull === "end"
                  ? t("resizeWidth", { name })
                  : t("resizeHeight", { name });

              const pill = pillOf[pull];

              return (
                <button
                  key={pull}
                  type="button"
                  aria-hidden={keyed ? undefined : true}
                  tabIndex={keyed ? undefined : -1}
                  aria-label={keyed ? label : undefined}
                  aria-keyshortcuts={keyed ? keysOf[pull] : undefined}
                  title={keyed ? label : undefined}
                  onPointerDown={(event) => {
                    startResize(event, widget, pull);
                  }}
                  onKeyDown={(event) => {
                    const horizontal =
                      event.key === "ArrowLeft" || event.key === "ArrowRight";

                    const vertical =
                      event.key === "ArrowUp" || event.key === "ArrowDown";

                    if (
                      (pull === "end" && horizontal) ||
                      (pull === "bottom" && vertical)
                    ) {
                      keyResize(event, widget, own);
                    }
                  }}
                  data-pulled={
                    resizing?.id === widget.id && resizing.pull === pull
                      ? ""
                      : undefined
                  }
                  className={`group/edge absolute z-10 hidden touch-none items-center justify-center outline-none sm:flex ${handlePlaces[pull]}`}
                >
                  {pill === null ? null : (
                    <span
                      aria-hidden="true"
                      className={`bg-muted-foreground group-focus-visible/edge:ring-ring rounded-full opacity-0 transition-opacity group-hover/edge:opacity-100 group-focus-visible/edge:opacity-100 group-focus-visible/edge:ring-3 group-data-[pulled]/edge:opacity-100 ${pill}`}
                    />
                  )}
                </button>
              );
            })}
          </>
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
      </SortableWidget>
    );
  };

  return (
    <>
      {actions}
      {sheet}
      <DragDropProvider plugins={boardPlugins} onDragEnd={handleDragEnd}>
        <ul
          ref={grid}
          aria-label={t("boardLabel")}
          className="grid auto-rows-(--widget-row) grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          style={{ "--widget-row": "20rem" }}
        >
          {board.widgets.map((widget, index) => card(widget, index))}
        </ul>
      </DragDropProvider>
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
