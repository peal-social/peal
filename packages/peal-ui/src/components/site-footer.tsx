import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { useId } from "react";

import { cn } from "../lib/utils";
import { PealMark } from "./peal-mark";

interface SiteFooterLink {
  /** Marks the link to the page being read, such as its own language. */
  readonly current?: boolean | undefined;
  readonly href: string;
  /** The language the linked page is in, for a language link. */
  readonly hrefLang?: string | undefined;
  readonly label: string;
  /** The language of the label itself, for a language link. */
  readonly lang?: string | undefined;
  /** Such as `me`, which a Mastodon profile checks for. */
  readonly rel?: string | undefined;
}

interface SiteFooterColumn {
  readonly label: string;
  readonly links: readonly SiteFooterLink[];
}

type SiteFooterProps = Omit<PartProps<"footer">, "children" | "className"> & {
  /** Mono captions in the footer's last row, at its start and its end. */
  readonly captions?:
    | { readonly end?: string | undefined; readonly start?: string | undefined }
    | undefined;
  readonly className?: string | undefined;
  /** A bordered cell per column of links. */
  readonly columns: readonly SiteFooterColumn[];
  readonly home: {
    readonly href: string;
    /** The link's name for screen readers, such as "Peal home page". */
    readonly label: string;
    readonly name: string;
  };
  /** The language links, under the licence's line. */
  readonly languages?: SiteFooterColumn | undefined;
  /** A line under the mark, such as the licence's. */
  readonly note: string;
};

const linkClassName =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 aria-[current=page]:text-foreground aria-[current=page]:font-medium";

const FooterLink = ({ link }: { readonly link: SiteFooterLink }) => (
  <a
    href={link.href}
    rel={link.rel}
    hrefLang={link.hrefLang}
    lang={link.lang}
    aria-current={link.current === true ? "page" : undefined}
    className={linkClassName}
  >
    {link.label}
  </a>
);

const Column = ({ column }: { readonly column: SiteFooterColumn }) => {
  const id = useId();

  return (
    <nav
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t p-6 sm:odd:border-s md:flex-1 md:border-s md:border-t-0"
    >
      <h2 id={id} className="text-foreground text-xs font-medium">
        {column.label}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {column.links.map((link) => (
          <li key={link.href}>
            <FooterLink link={link} />
          </li>
        ))}
      </ul>
    </nav>
  );
};

/**
 * The marketing site's footer (DESIGN.md, Site): the mark, the licence's
 * line and the language links, then a bordered cell per column of links,
 * and a row of captions. Every link and label comes from the page.
 */
const SiteFooter = ({
  captions,
  className,
  columns,
  home,
  languages,
  note,
  render,
  ...props
}: SiteFooterProps) => {
  const languagesId = useId();

  return renderElement(
    "footer",
    {
      ...props,
      children: (
        <div className="mx-auto max-w-6xl">
          <div className="grid sm:grid-cols-2 md:flex">
            <div className="flex flex-col gap-4 p-6 sm:col-span-2 md:flex-[1.5]">
              <a
                href={home.href}
                aria-label={home.label}
                className="text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-3"
              >
                <PealMark className="size-6" />
                {home.name}
              </a>
              <p className="text-muted-foreground max-w-xs text-[13px]">
                {note}
              </p>
              {languages === undefined ? null : (
                <nav aria-labelledby={languagesId}>
                  <h2 id={languagesId} className="sr-only">
                    {languages.label}
                  </h2>
                  <ul className="flex gap-3 text-sm">
                    {languages.links.map((link) => (
                      <li key={link.href}>
                        <FooterLink link={link} />
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
            {columns.map((column) => (
              <Column key={column.label} column={column} />
            ))}
          </div>
          {captions === undefined ? null : (
            <div className="text-muted-foreground flex flex-wrap justify-between gap-2 border-t px-6 py-4 font-mono text-xs tracking-[0.04em] lowercase">
              <span>{captions.start}</span>
              <span>{captions.end}</span>
            </div>
          )}
        </div>
      ),
      className: cn("bg-background border-t", className),
      "data-slot": "site-footer",
    },
    render
  );
};

export { SiteFooter };

export type { SiteFooterColumn, SiteFooterLink, SiteFooterProps };
