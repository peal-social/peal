import { ChevronRightIcon, StarIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { PixelFigure } from "./pixel-figure";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

/** A state a mock row or chip shows: done, under way, or to look at. */
type MockState = "done" | "pending" | "warning";

interface MockChipContent {
  readonly state?: MockState | undefined;
  /** Its text, such as `:: Publishing…`. */
  readonly text: string;
}

interface MockRow {
  readonly chip?: MockChipContent | undefined;
  readonly label: string;
  readonly value: string;
}

/** A pull request a repository card lists. */
interface RepoPull {
  readonly href: string;
  readonly number: number;
  readonly title: string;
}

/**
 * What a feature cell shows beside its words, drawn from Peal's own UI:
 * a mock window with rows, a line of mono chips, pixel art of an icon, or
 * the repository's card. Never a picture of another site.
 */
type FeatureIllustration =
  | {
      readonly kind: "window";
      readonly rows: readonly MockRow[];
      /** The address in the window's bar, such as `app.peal.social/…`. */
      readonly url: string;
    }
  | {
      readonly chips: readonly MockChipContent[];
      readonly kind: "chips";
    }
  | { readonly icon: SiteIcon; readonly kind: "pixel" }
  | {
      readonly href: string;
      readonly kind: "repository";
      readonly mark: SiteMark;
      readonly name: string;
      /** The latest merged pull requests; none hides the list. */
      readonly pulls: readonly RepoPull[];
      readonly pullsLabel: string;
      readonly stars?: string | undefined;
      readonly starsLabel: string;
    };

interface FeatureCellContent {
  readonly icon: SiteIcon;
  readonly illustration?: FeatureIllustration | undefined;
  readonly label: string;
  /** The paragraph's first phrase, in ink. */
  readonly lead: string;
  readonly link?: { readonly href: string; readonly label: string } | undefined;
  /** The rest of the paragraph, in muted text. */
  readonly text: string;
}

const stateClass: Readonly<Record<MockState, string>> = {
  done: "bg-[#f0fdf4] text-[#166534]",
  pending: "bg-brand-tint text-brand-text",
  warning: "bg-[#fffbeb] text-[#92400e]",
};

/** A mono chip, such as `:: Publishing…`, in its state's tint. */
const MockChip = ({
  state,
  text,
}: {
  readonly state?: MockState | undefined;
  readonly text: string;
}) => (
  <span
    className={cn(
      "inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] tracking-[0.04em]",
      state === undefined ? "bg-muted text-muted-foreground" : stateClass[state]
    )}
  >
    {text}
  </span>
);

/** A window drawn from the app's own frame: a bar with its address, then rows. */
const MockWindow = ({
  rows,
  url,
}: {
  readonly rows: readonly MockRow[];
  readonly url: string;
}) => (
  <div aria-hidden="true" className="bg-card overflow-hidden rounded-md border">
    <div className="flex items-center gap-3 border-b px-3 py-2">
      <span className="flex gap-1">
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
      </span>
      <span className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded-sm px-2 py-0.5 font-mono text-[11px]">
        {url}
      </span>
    </div>
    <ul>
      {rows.map((row) => (
        <li
          key={`${row.label}${row.value}`}
          className="flex items-center justify-between gap-3 border-b px-3 py-2 text-[13px] last:border-b-0"
        >
          <span className="text-muted-foreground truncate">{row.label}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-foreground font-mono text-xs">
              {row.value}
            </span>
            {row.chip === undefined ? null : (
              <MockChip state={row.chip.state} text={row.chip.text} />
            )}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const RepositoryCard = ({
  illustration,
}: {
  readonly illustration: Extract<FeatureIllustration, { kind: "repository" }>;
}) => (
  <div className="bg-card overflow-hidden rounded-md border">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <a
        href={illustration.href}
        className="text-foreground focus-visible:ring-ring/50 flex min-w-0 items-center gap-2 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
      >
        <Mark mark={illustration.mark} />
        <span className="truncate">{illustration.name}</span>
      </a>
      {illustration.stars === undefined ? null : (
        <span className="text-foreground inline-flex items-center gap-1 font-mono text-xs tabular-nums">
          <StarIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5"
          />
          {illustration.stars}
          <span className="sr-only">{illustration.starsLabel}</span>
        </span>
      )}
    </div>
    {illustration.pulls.length === 0 ? null : (
      <div>
        <p className="text-muted-foreground px-4 pt-3 font-mono text-[11px] tracking-[0.04em]">
          {illustration.pullsLabel}
        </p>
        <ul>
          {illustration.pulls.map((pull) => (
            <li key={pull.number} className="border-b last:border-b-0">
              <a
                href={pull.href}
                className="hover:bg-accent focus-visible:ring-ring/50 flex items-start gap-2 px-4 py-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-inset"
              >
                <SiteIconView
                  icon="pull-request"
                  className="text-brand mt-0.5 size-3.5"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-foreground">{pull.title}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    #{pull.number}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const Illustration = ({
  illustration,
}: {
  readonly illustration: FeatureIllustration;
}) => {
  switch (illustration.kind) {
    case "window": {
      return <MockWindow rows={illustration.rows} url={illustration.url} />;
    }

    case "chips": {
      return (
        <div aria-hidden="true" className="flex flex-wrap gap-1.5">
          {illustration.chips.map((chip) => (
            <MockChip key={chip.text} state={chip.state} text={chip.text} />
          ))}
        </div>
      );
    }

    case "pixel": {
      return (
        <PixelFigure
          art={<SiteIconView icon={illustration.icon} />}
          className="h-40"
          tones={["--brand-tint", "--lavender", "--brand", "--sun"]}
        />
      );
    }

    case "repository": {
      return <RepositoryCard illustration={illustration} />;
    }

    default: {
      return null;
    }
  }
};

/**
 * A feature in a bordered cell (DESIGN.md, Site): a small icon and label,
 * a paragraph whose first phrase is ink and the rest muted, an optional
 * link with a chevron, and an illustration from Peal's own UI.
 */
const FeatureCell = ({
  cell,
  className,
  wide = false,
}: {
  readonly cell: FeatureCellContent;
  readonly className?: string | undefined;
  /** Across the whole grid, its words centred. */
  readonly wide?: boolean | undefined;
}) => (
  <div
    className={cn(
      "flex flex-col gap-6 p-6 sm:p-8",
      wide ? "md:items-center md:px-[18%] md:text-center" : undefined,
      className
    )}
  >
    <div
      className={cn(
        "flex flex-col gap-3",
        wide ? "md:items-center" : undefined
      )}
    >
      <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
        <SiteIconView icon={cell.icon} className="text-foreground" />
        {cell.label}
      </p>
      <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">
        <strong className="text-foreground font-semibold">{cell.lead}</strong>{" "}
        {cell.text}
      </p>
      {cell.link === undefined ? null : (
        <a
          href={cell.link.href}
          className="text-brand-text focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
        >
          {cell.link.label}
          <ChevronRightIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
        </a>
      )}
    </div>
    {cell.illustration === undefined ? null : (
      <div className={wide ? "w-full max-w-md" : undefined}>
        <Illustration illustration={cell.illustration} />
      </div>
    )}
  </div>
);

type GridCell = FeatureCellContent & { readonly wide?: boolean | undefined };

// Which column each cell sits in: a wide cell takes the whole row, and the
// next one starts on the left again.
const placed = (cells: readonly GridCell[]) => {
  let column = 0;

  return cells.map((cell) => {
    if (cell.wide === true) {
      column = 0;

      return { cell, left: false };
    }

    const left = column === 0;
    column = left ? 1 : 0;

    return { cell, left };
  });
};

/**
 * Feature cells on the blueprint: bordered cells in two columns, and a
 * cell marked wide across both, its words centred.
 */
const FeatureGrid = ({
  cells,
  className,
}: {
  readonly cells: readonly GridCell[];
  readonly className?: string | undefined;
}) => (
  <div
    className={cn("mx-auto grid max-w-6xl border-t md:grid-cols-2", className)}
  >
    {placed(cells).map(({ cell, left }) => (
      <FeatureCell
        key={cell.label}
        cell={cell}
        wide={cell.wide}
        className={cn(
          "border-b",
          left ? "md:border-e" : undefined,
          cell.wide === true ? "md:col-span-2" : undefined
        )}
      />
    ))}
  </div>
);

export { FeatureCell, FeatureGrid, MockChip, MockWindow };

export type {
  MockChipContent,
  FeatureCellContent,
  FeatureIllustration,
  MockRow,
  MockState,
  RepoPull,
};
