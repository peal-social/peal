"use client";

import { CheckIcon, ChevronDownIcon, LanguagesIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface LanguageMenuLink {
  /** Marks the language of the page being read. */
  readonly current?: boolean | undefined;
  /** The same page in this language. */
  readonly href: string;
  readonly hrefLang: string;
  /** The language's own name, such as "Français". */
  readonly label: string;
  readonly lang: string;
}

interface LanguageMenuProps {
  readonly className?: string | undefined;
  /** The page's word for language, such as "Language" or "Langue". */
  readonly label: string;
  readonly links: readonly LanguageMenuLink[];
  /** Where the menu opens: above the trigger at a page's foot. */
  readonly side?: "bottom" | "top" | undefined;
}

const fallbackLinkClassName =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 aria-[current=page]:text-foreground aria-[current=page]:font-medium";

/**
 * Switches the page's language (DESIGN.md, Site): a small outline button
 * with the languages icon and the current language's name opens a menu of
 * the same page in each language, every item a link. The menu's popup is
 * only in the page once it opens, so the links are also in a `<noscript>`
 * for a reader without JavaScript, whose browser also hides the inert
 * trigger (`scripting: none`).
 */
const LanguageMenu = ({
  className,
  label,
  links,
  side = "bottom",
}: LanguageMenuProps) => {
  const current = links.find((link) => link.current === true) ?? links[0];

  return (
    <nav aria-label={label} className={cn("flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "text-muted-foreground aria-expanded:text-foreground h-7.5 gap-1.5 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-4 [@media(scripting:none)]:hidden"
          )}
          // The page's word, then the visible name, which the name keeps.
          aria-label={
            current === undefined ? label : `${label}, ${current.label}`
          }
        >
          <LanguagesIcon aria-hidden strokeWidth={1.75} />
          {current?.label}
          <ChevronDownIcon aria-hidden strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={side}
          sideOffset={6}
          className="w-auto min-w-40"
        >
          {links.map((link) => (
            <DropdownMenuItem
              key={link.href}
              className="pr-8"
              label={link.label}
              // The link's own children replace the item's (ui-sdk merges
              // the render element's props last).
              render={
                <a
                  href={link.href}
                  hrefLang={link.hrefLang}
                  lang={link.lang}
                  aria-current={link.current === true ? "page" : undefined}
                >
                  {link.label}
                  {link.current === true ? (
                    <CheckIcon
                      aria-hidden
                      strokeWidth={1.75}
                      className="absolute right-2"
                    />
                  ) : null}
                </a>
              }
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <noscript>
        <ul className="flex gap-3 text-sm">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                hrefLang={link.hrefLang}
                lang={link.lang}
                aria-current={link.current === true ? "page" : undefined}
                className={fallbackLinkClassName}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </noscript>
    </nav>
  );
};

export { LanguageMenu };

export type { LanguageMenuLink, LanguageMenuProps };
