"use client";

import { ChevronDownIcon } from "lucide-react";

import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface PolicyMenuLink {
  readonly href: string;
  readonly label: string;
}

interface PolicyMenuProps {
  readonly className?: string | undefined;
  /** The menu's name, such as "Policies". */
  readonly label: string;
  readonly links: readonly PolicyMenuLink[];
}

const fallbackLinkClassName =
  "hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3";

/**
 * The footer's policies (DESIGN.md, Site): a quiet text trigger with a
 * chevron, as the last entry of a footer column, that opens upward a menu
 * of the legal documents and the contract's functions, every item a link.
 * The popup is only in the page once it opens, so the links are also in a
 * `<noscript>` for a reader without JavaScript, whose browser hides the
 * inert trigger. It sits in the column's own navigation, so it is no
 * landmark of its own.
 */
const PolicyMenu = ({ className, label, links }: PolicyMenuProps) => (
  <div className={cn("flex", className)}>
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:text-foreground aria-expanded:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-3 [@media(scripting:none)]:hidden">
        {label}
        <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        sideOffset={6}
        className="w-auto min-w-48"
      >
        {links.map((link) => (
          <DropdownMenuItem
            key={link.href}
            label={link.label}
            render={<a href={link.href}>{link.label}</a>}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    <noscript>
      <ul className="flex flex-wrap gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className={fallbackLinkClassName}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </noscript>
  </div>
);

export { PolicyMenu };

export type { PolicyMenuLink, PolicyMenuProps };
