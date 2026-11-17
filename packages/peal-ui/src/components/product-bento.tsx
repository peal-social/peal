"use client";

import { ChevronRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { MockChip } from "./feature-cell";
import type { MockChipContent } from "./feature-cell";
import { PixelFigure } from "./pixel-figure";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

/** A post as one platform shows it, with its count against the limit. */
interface BentoPreview {
  readonly count: string;
  readonly fit: MockChipContent;
  readonly mark: SiteMark;
  readonly name: string;
  readonly text: string;
}

/** The page a reviewer opens from a review link, without an account. */
interface BentoReview {
  readonly approve: string;
  /** A reviewer's comment, with their name and badge. */
  readonly comment: {
    readonly badge: string;
    readonly initials: string;
    readonly name: string;
    readonly text: string;
  };
  readonly requestChanges: string;
  readonly status: MockChipContent;
  readonly text: string;
  readonly url: string;
}

type BentoIllustration =
  | { readonly kind: "previews"; readonly previews: readonly BentoPreview[] }
  | { readonly kind: "review"; readonly review: BentoReview };

interface BentoCard {
  readonly icon: SiteIcon;
  readonly illustration: BentoIllustration;
  readonly label: string;
  /** The paragraph's first phrase, in ink. */
  readonly lead: string;
  readonly link?: { readonly href: string; readonly label: string } | undefined;
  /** The rest of the paragraph, in muted text. */
  readonly text: string;
}

interface BentoTile {
  readonly href?: string | undefined;
  readonly icon: SiteIcon;
  readonly label: string;
  readonly text: string;
}

const Previews = ({
  previews,
}: {
  readonly previews: readonly BentoPreview[];
}) => (
  <ul aria-hidden="true" className="bg-card overflow-hidden rounded-md border">
    {previews.map((preview) => (
      <li
        key={preview.name}
        className="flex flex-col gap-1.5 border-b p-3 last:border-b-0"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-foreground me-auto flex items-center gap-1.5 text-[13px] font-medium">
            <Mark mark={preview.mark} />
            {preview.name}
          </span>
          <span className="text-foreground font-mono text-[11px] tabular-nums">
            {preview.count}
          </span>
          <MockChip state={preview.fit.state} text={preview.fit.text} />
        </span>
        <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {preview.text}
        </span>
      </li>
    ))}
  </ul>
);

const Review = ({ review }: { readonly review: BentoReview }) => (
  <div aria-hidden="true" className="bg-card overflow-hidden rounded-md border">
    <div className="flex items-center gap-3 border-b px-3 py-2">
      <span className="flex gap-1">
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
      </span>
      <span className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded-sm px-2 py-0.5 font-mono text-[11px]">
        {review.url}
      </span>
    </div>
    <div className="flex flex-col gap-3 p-3">
      <MockChip state={review.status.state} text={review.status.text} />
      <p className="text-foreground text-[13px] leading-relaxed">
        {review.text}
      </p>
      <div className="bg-muted flex gap-2 rounded-md p-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#ede7ff] text-[10px] font-semibold text-[#5b45c7]">
          {review.comment.initials}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground flex items-center gap-1.5 text-xs font-medium">
            {review.comment.name}
            <span className="bg-card text-muted-foreground rounded-sm border px-1 text-[10px]">
              {review.comment.badge}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {review.comment.text}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="bg-primary text-primary-foreground inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium">
          {review.approve}
        </span>
        <span className="bg-card text-foreground inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium">
          {review.requestChanges}
        </span>
      </div>
    </div>
  </div>
);

const Card = ({
  card,
  className,
}: {
  readonly card: BentoCard;
  readonly className?: string | undefined;
}) => (
  <div className={cn("flex flex-col gap-6 p-6 sm:p-8", className)}>
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
        <SiteIconView icon={card.icon} className="text-foreground" />
        {card.label}
      </p>
      <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">
        <strong className="text-foreground font-semibold">{card.lead}</strong>{" "}
        {card.text}
      </p>
      {card.link === undefined ? null : (
        <a
          href={card.link.href}
          className="text-brand-text focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
        >
          {card.link.label}
          <ChevronRightIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
        </a>
      )}
    </div>
    <div className="mt-auto">
      {card.illustration.kind === "previews" ? (
        <Previews previews={card.illustration.previews} />
      ) : (
        <Review review={card.illustration.review} />
      )}
    </div>
  </div>
);

const TileBody = ({ tile }: { readonly tile: BentoTile }) => (
  <>
    <PixelFigure
      art={<SiteIconView icon={tile.icon} />}
      className="h-20"
      tones={["--brand-tint", "--lavender", "--brand", "--sun"]}
    />
    <span className="flex flex-col gap-1">
      <span className="text-foreground flex items-center gap-2 text-[15px] font-semibold">
        <SiteIconView icon={tile.icon} />
        {tile.label}
      </span>
      <span className="text-muted-foreground text-[13px] leading-snug">
        {tile.text}
      </span>
    </span>
  </>
);

/**
 * A product's bento (DESIGN.md, Site): two large bordered cells, each a
 * feature cell with a mock drawn from the app, over a row of four tiles,
 * each still pixel art of its icon, a title and a line.
 */
const ProductBento = ({
  cards,
  className,
  tiles,
}: {
  readonly cards: readonly [BentoCard, BentoCard];
  readonly className?: string | undefined;
  readonly tiles: readonly BentoTile[];
}) => (
  <div className={cn("mx-auto max-w-6xl border-t", className)}>
    <div className="grid border-b md:grid-cols-2">
      <Card card={cards[0]} className="border-b md:border-e md:border-b-0" />
      <Card card={cards[1]} />
    </div>
    <ul className="grid grid-cols-2 border-b md:grid-cols-4 [&>li]:border-e [&>li]:border-b md:[&>li]:border-b-0 [&>li:nth-child(2n)]:border-e-0 md:[&>li:nth-child(2n)]:border-e md:[&>li:nth-child(4n)]:border-e-0 [&>li:nth-last-child(-n+2)]:border-b-0">
      {tiles.map((tile) => (
        <li key={tile.label}>
          {tile.href === undefined ? (
            <div className="flex h-full flex-col gap-4 p-5">
              <TileBody tile={tile} />
            </div>
          ) : (
            <a
              href={tile.href}
              className="hover:bg-accent/60 focus-visible:ring-ring/50 flex h-full flex-col gap-4 p-5 outline-none focus-visible:ring-3 focus-visible:ring-inset"
            >
              <TileBody tile={tile} />
            </a>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export { ProductBento };

export type {
  BentoCard,
  BentoIllustration,
  BentoPreview,
  BentoReview,
  BentoTile,
};
