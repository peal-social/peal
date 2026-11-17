import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

interface Tile {
  readonly description?: string | undefined;
  readonly href: string;
  readonly icon?: SiteIcon | undefined;
  readonly mark?: SiteMark | undefined;
  readonly title: string;
}

interface TileGroup {
  readonly label: string;
  readonly tiles: readonly Tile[];
}

const TileLink = ({ tile }: { readonly tile: Tile }) => (
  <a
    href={tile.href}
    className="group/tile hover:bg-accent/60 focus-visible:ring-ring/50 flex h-full flex-col gap-3 p-5 outline-none focus-visible:ring-3 focus-visible:ring-inset"
  >
    <span className="flex items-center justify-between">
      <span className="bg-card text-foreground flex size-9 items-center justify-center rounded-md border">
        {tile.mark === undefined ? (
          <SiteIconView icon={tile.icon ?? "plug"} />
        ) : (
          <Mark mark={tile.mark} />
        )}
      </span>
      <ArrowUpRightIcon
        aria-hidden="true"
        strokeWidth={1.75}
        className="text-muted-foreground size-4 transition-transform group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5 motion-reduce:transition-none"
      />
    </span>
    <span className="flex flex-col gap-1">
      <span className="text-foreground text-[15px] font-semibold">
        {tile.title}
      </span>
      {tile.description === undefined ? null : (
        <span className="text-muted-foreground text-[13px] leading-snug">
          {tile.description}
        </span>
      )}
    </span>
  </a>
);

/**
 * Tiles in bordered cells (DESIGN.md, Site), in groups under a small label:
 * each an icon or a brand's mark, a title and an optional line, linking to
 * its page.
 */
const TileGrid = ({
  className,
  groups,
}: {
  readonly className?: string | undefined;
  readonly groups: readonly TileGroup[];
}) => (
  <div className={cn("mx-auto max-w-6xl border-t", className)}>
    {groups.map((group) => (
      <section key={group.label} aria-label={group.label}>
        <p className="text-muted-foreground border-b px-6 py-3 font-mono text-xs tracking-[0.04em]">
          {group.label}
        </p>
        <ul className="grid grid-cols-2 border-b md:grid-cols-4 [&>li]:border-e [&>li]:border-b md:[&>li]:border-b [&>li:nth-child(2n)]:border-e-0 md:[&>li:nth-child(2n)]:border-e md:[&>li:nth-child(4n)]:border-e-0 [&>li:nth-last-child(-n+2)]:border-b-0 md:[&>li:nth-last-child(-n+4)]:border-b-0">
          {group.tiles.map((tile) => (
            <li key={tile.href + tile.title}>
              <TileLink tile={tile} />
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export { TileGrid };

export type { Tile, TileGroup };
