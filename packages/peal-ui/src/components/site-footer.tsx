import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { useId } from "react";

import { cn } from "../lib/utils";
import { LanguageMenu } from "./language-menu";
import type { LanguageMenuLink } from "./language-menu";
import { PealMark } from "./peal-mark";

interface SiteFooterLink {
  /** Marks the link to the page being read. */
  readonly current?: boolean | undefined;
  readonly href: string;
  readonly label: string;
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
  /**
   * The language menu, under the licence's line: the page's word for
   * language, and the same page in each language.
   */
  readonly languages?:
    | {
        readonly label: string;
        readonly links: readonly LanguageMenuLink[];
      }
    | undefined;
  /** A line under the mark, such as the licence's. */
  readonly note: string;
};

const linkClassName =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 aria-[current=page]:text-foreground aria-[current=page]:font-medium";

const FooterLink = ({ link }: { readonly link: SiteFooterLink }) => (
  <a
    href={link.href}
    rel={link.rel}
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
 * line and the language menu, then a bordered cell per column of links,
 * and a row of captions. Every link and label comes from the page. The
 * language menu opens in the browser, so a page hydrates the footer.
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
}: SiteFooterProps) =>
  renderElement(
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
                <LanguageMenu
                  label={languages.label}
                  links={languages.links}
                  side="top"
                />
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

export { SiteFooter };

export type { SiteFooterColumn, SiteFooterLink, SiteFooterProps };
