import { ChevronRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Code } from "./code-demo";
import type { CodeBlock } from "./code-demo";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

/** A platform on the connect page: connected already, or a button. */
interface ConnectRow {
  readonly action: string;
  readonly connected: boolean;
  readonly mark: SiteMark;
  readonly name: string;
}

/** The page a connect link opens, hosted by Peal for a partner. */
interface ConnectPage {
  readonly asks: string;
  readonly heading: string;
  readonly partner: { readonly initials: string; readonly name: string };
  readonly rows: readonly ConnectRow[];
  readonly url: string;
}

type RowDemo =
  | { readonly blocks: readonly CodeBlock[]; readonly kind: "code" }
  | { readonly connect: ConnectPage; readonly kind: "connect" }
  | {
      readonly kind: "tiles";
      readonly tiles: readonly {
        readonly href: string;
        readonly mark: SiteMark;
        readonly title: string;
      }[];
    };

interface ProductRow {
  readonly demo: RowDemo;
  readonly icon: SiteIcon;
  readonly link?: { readonly href: string; readonly label: string } | undefined;
  readonly text: string;
  readonly title: string;
}

const Tiles = ({
  tiles,
}: {
  readonly tiles: Extract<RowDemo, { kind: "tiles" }>["tiles"];
}) => (
  <ul className="bg-card grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-4 [&>li]:border-e [&>li]:border-b [&>li:nth-child(2n)]:border-e-0 sm:[&>li:nth-child(2n)]:border-e sm:[&>li:nth-child(4n)]:border-e-0 [&>li:nth-last-child(-n+2)]:border-b-0 sm:[&>li:nth-last-child(-n+4)]:border-b-0">
    {tiles.map((tile) => (
      <li key={tile.title}>
        <a
          href={tile.href}
          className="hover:bg-accent/60 focus-visible:ring-ring/50 flex h-full items-center gap-2.5 p-3 outline-none focus-visible:ring-3 focus-visible:ring-inset"
        >
          <span className="bg-card text-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
            <Mark mark={tile.mark} />
          </span>
          <span className="text-foreground min-w-0 truncate text-sm font-medium">
            {tile.title}
          </span>
        </a>
      </li>
    ))}
  </ul>
);

const Connect = ({ connect }: { readonly connect: ConnectPage }) => (
  <div
    aria-hidden="true"
    className="bg-background flex flex-col gap-3 rounded-md border p-4 sm:p-6"
  >
    <span className="bg-card text-muted-foreground w-fit max-w-full truncate rounded-sm border px-2 py-0.5 font-mono text-[11px]">
      {connect.url}
    </span>
    <div className="bg-card overflow-hidden rounded-md border">
      {/* A partner's accent, a 4 px line along the card's top (DESIGN.md,
          Pages): blue here, one a partner could choose. */}
      <span className="bg-brand block h-1" />
      <div className="flex flex-col gap-3 p-4">
        <span className="flex items-center gap-2">
          <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-md text-[11px] font-semibold">
            {connect.partner.initials}
          </span>
          <span className="text-foreground text-[13px] font-medium">
            {connect.partner.name}
          </span>
        </span>
        <span className="text-foreground text-[15px] font-semibold">
          {connect.heading}
        </span>
        <span className="text-muted-foreground text-[13px]">
          {connect.asks}
        </span>
        <ul className="flex flex-col rounded-md border">
          {connect.rows.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <span className="text-foreground flex items-center gap-2 text-[13px]">
                <Mark mark={row.mark} />
                {row.name}
              </span>
              {row.connected ? (
                <span className="rounded-sm bg-[#f0fdf4] px-1.5 py-0.5 font-mono text-[11px] tracking-[0.04em] text-[#166534]">
                  {row.action}
                </span>
              ) : (
                <span className="bg-primary text-primary-foreground inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium">
                  {row.action}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const Demo = ({ demo }: { readonly demo: RowDemo }) => {
  switch (demo.kind) {
    case "code": {
      return (
        <div className="bg-card overflow-hidden rounded-md border">
          {demo.blocks.map((block, index) => (
            <Code
              key={block.label}
              block={block}
              className={index > 0 ? "border-t" : undefined}
            />
          ))}
        </div>
      );
    }

    case "tiles": {
      return <Tiles tiles={demo.tiles} />;
    }

    case "connect": {
      return <Connect connect={demo.connect} />;
    }

    default: {
      return null;
    }
  }
};

/**
 * A product's parts in rows (DESIGN.md, Site): each a bordered row on the
 * rails, its title and words on the left, and on the right its code, its
 * tiles or a mock drawn from the app.
 */
const ProductRows = ({
  className,
  rows,
}: {
  readonly className?: string | undefined;
  readonly rows: readonly ProductRow[];
}) => (
  <div className={cn("mx-auto max-w-6xl border-t", className)}>
    {rows.map((row) => (
      <section
        key={row.title}
        aria-label={row.title}
        className="grid border-b md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="flex flex-col gap-3 p-6 sm:p-8 md:border-e">
          <h3 className="text-foreground flex items-center gap-2 text-[15px] font-semibold">
            <SiteIconView icon={row.icon} />
            {row.title}
          </h3>
          <p className="text-muted-foreground text-base leading-relaxed">
            {row.text}
          </p>
          {row.link === undefined ? null : (
            <a
              href={row.link.href}
              className="text-brand-text focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
            >
              {row.link.label}
              <ChevronRightIcon
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
            </a>
          )}
        </div>
        <div className="min-w-0 p-3 sm:p-6">
          <Demo demo={row.demo} />
        </div>
      </section>
    ))}
  </div>
);

export { ProductRows };

export type { ConnectPage, ConnectRow, ProductRow, RowDemo };
