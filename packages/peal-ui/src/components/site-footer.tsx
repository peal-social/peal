import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { Option, Schema } from "effect";
import { ActivityIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { StatusChecksSchema, statusOf } from "../lib/site/status";
import type { SiteStatus } from "../lib/site/status";
import { cn } from "../lib/utils";
import { LanguageMenu } from "./language-menu";
import type { LanguageMenuLink } from "./language-menu";
import { PealMark } from "./peal-mark";

interface SiteFooterLink {
  /** Marks the link to the page being read. */
  readonly current?: boolean | undefined;
  readonly href: string;
  readonly label: string;
  /** What a click opens in place, where the page has it: the consent notice. */
  readonly opens?: "consent" | undefined;
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
   * The language menu, under the mark: the page's word for language, and
   * the same page in each language.
   */
  readonly languages?:
    | {
        readonly label: string;
        readonly links: readonly LanguageMenuLink[];
      }
    | undefined;
  /**
   * The status page, at the foot of the mark's cell, as far from its
   * bottom as the mark is from its top; its icon takes the colour of what
   * the page's API says, once the browser has read it.
   */
  readonly status?: FooterStatus | undefined;
};

interface FooterStatus {
  /** Where the status page lists its checks, each with its last result. */
  readonly api: string;
  readonly href: string;
  readonly label: string;
  /** Each status's meaning, for the icon's tooltip and screen readers. */
  readonly states: Readonly<Record<SiteStatus, string>>;
}

const linkClassName =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 aria-[current=page]:text-foreground aria-[current=page]:font-medium";

// The status icon's colour: a post state's dot (DESIGN.md, States), green
// when up, amber when some checks fail, red when all do.
const statusColour: Readonly<Record<SiteStatus, string>> = {
  degraded: "text-[#E0A800]",
  down: "text-[#D92D20]",
  up: "text-[#16A34A]",
};

// The status page's link: its icon stays muted until the page's API has
// answered, then takes the status's colour and beats like a heart (still
// with reduced motion); an answer the browser cannot read leaves it muted.
const StatusLink = ({ status }: { readonly status: FooterStatus }) => {
  const [state, setState] = useState<SiteStatus | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    const read = async () => {
      try {
        const response = await fetch(status.api, {
          credentials: "omit",
          signal: controller.signal,
        });

        if (response.ok) {
          const checks = Schema.decodeUnknownOption(StatusChecksSchema)(
            await response.json()
          );

          setState(
            Option.getOrUndefined(
              checks.pipe(Option.flatMapNullishOr(statusOf))
            )
          );
        }
      } catch {
        // Unreachable, or not readable from this page: the icon stays muted.
      }
    };

    void read();

    return () => {
      controller.abort();
    };
  }, [status.api]);

  const meaning = state === undefined ? undefined : status.states[state];

  return (
    <a
      href={status.href}
      title={meaning}
      className={cn(
        linkClassName,
        "inline-flex items-center gap-1.5 text-sm md:mt-auto"
      )}
    >
      <ActivityIcon
        aria-hidden="true"
        strokeWidth={2}
        className={cn(
          "size-3.5",
          state === undefined
            ? undefined
            : cn(
                statusColour[state],
                "animate-heartbeat motion-reduce:animate-none"
              )
        )}
      />
      {status.label}
      {meaning === undefined ? null : (
        <span className="sr-only">{`: ${meaning}`}</span>
      )}
    </a>
  );
};

const FooterLink = ({ link }: { readonly link: SiteFooterLink }) => (
  <a
    href={link.href}
    rel={link.rel}
    data-consent-open={link.opens === "consent" ? "" : undefined}
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
 * The marketing site's footer (DESIGN.md, Site): the mark and the
 * language menu, the status page at the cell's foot, then a bordered cell
 * per column of links, and a row of captions. Every link and label comes from the page. The language menu
 * opens in the browser, so a page hydrates the footer.
 */
const SiteFooter = ({
  captions,
  className,
  columns,
  home,
  languages,
  render,
  status,
  ...props
}: SiteFooterProps) =>
  renderElement(
    "footer",
    {
      ...props,
      children: (
        <div className="mx-auto max-w-6xl">
          <div className="grid sm:grid-cols-2 md:flex">
            <div className="flex flex-col items-start gap-4 p-6 sm:col-span-2 md:flex-1">
              <a
                href={home.href}
                aria-label={home.label}
                className="text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-3"
              >
                <PealMark className="size-6" />
                {home.name}
              </a>
              {languages === undefined ? null : (
                <LanguageMenu
                  label={languages.label}
                  links={languages.links}
                  side="top"
                />
              )}
              {status === undefined ? null : <StatusLink status={status} />}
            </div>
            {columns.map((column) => (
              <Column key={column.label} column={column} />
            ))}
          </div>
          {captions === undefined ? null : (
            <div className="text-muted-foreground flex flex-wrap justify-between gap-2 border-t px-6 py-4 font-mono text-xs tracking-[0.04em]">
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
