"use client";

import {
  ActivityIcon,
  ArrowRightIcon,
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  BracesIcon,
  CalendarDaysIcon,
  ChartLineIcon,
  CheckCheckIcon,
  GlobeIcon,
  HistoryIcon,
  InboxIcon,
  MenuIcon,
  MessagesSquareIcon,
  PackageIcon,
  PanelsTopLeftIcon,
  PenLineIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareTerminalIcon,
  StarIcon,
  WebhookIcon,
} from "lucide-react";
import { useId } from "react";

import { cn } from "../lib/utils";
import { Button, buttonVariants } from "./button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerClassName,
} from "./navigation-menu";
import { PealMark } from "./peal-mark";
import { Separator } from "./separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// The icons a site menu's rows may show, by name: the props cross from an
// Astro page to a React island as JSON, which cannot carry a component.
const siteIcons = {
  activity: ActivityIcon,
  blocks: BlocksIcon,
  "book-open": BookOpenIcon,
  bot: BotIcon,
  braces: BracesIcon,
  calendar: CalendarDaysIcon,
  chart: ChartLineIcon,
  "check-check": CheckCheckIcon,
  globe: GlobeIcon,
  history: HistoryIcon,
  inbox: InboxIcon,
  messages: MessagesSquareIcon,
  package: PackageIcon,
  panels: PanelsTopLeftIcon,
  pen: PenLineIcon,
  server: ServerIcon,
  shield: ShieldCheckIcon,
  sparkles: SparklesIcon,
  terminal: SquareTerminalIcon,
  webhook: WebhookIcon,
} as const;

type SiteIcon = keyof typeof siteIcons;

interface SiteLink {
  readonly href: string;
  readonly label: string;
}

/**
 * A brand's own mark (DESIGN.md, Icons): a simple-icons path, drawn in
 * currentColor, or the letters of a lettered tile for a brand that has no
 * mark there. The page passes the path, so the header holds no logo.
 */
type SiteMark =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "letters"; readonly letters: string };

/**
 * A row of a mega menu: an icon or a brand's mark, a title, and a one-line
 * description where the title alone does not say enough.
 */
interface SiteMenuLink {
  readonly description?: string | undefined;
  readonly href: string;
  readonly icon?: SiteIcon | undefined;
  readonly mark?: SiteMark | undefined;
  readonly title: string;
}

interface SiteMenuGroup {
  /** Rows side by side in the group's cell, for long lists of names. */
  readonly columns?: 1 | 2 | undefined;
  /** Stacks the cell under the previous group's, in one column. */
  readonly stack?: boolean | undefined;
  readonly label: string;
  readonly links: readonly SiteMenuLink[];
}

/** The card that closes a mega menu on the right, sized to its content. */
interface SiteMenuFeature {
  readonly caption: string;
  readonly description: string;
  readonly href: string;
  /** Brands' marks shown at the card's top, as its picture. */
  readonly marks?: readonly SiteMark[] | undefined;
  readonly title: string;
}

interface SiteMenu {
  readonly feature?: SiteMenuFeature | undefined;
  readonly groups: readonly SiteMenuGroup[];
  readonly kind: "menu";
  readonly label: string;
  readonly value: string;
}

interface SiteNavLink extends SiteLink {
  readonly current?: boolean | undefined;
  readonly kind: "link";
}

type SiteNavItem = SiteMenu | SiteNavLink;

interface SiteHeaderProps {
  readonly className?: string | undefined;
  /** An icon-only button: `label` is its name for screen readers. */
  readonly discord?: (SiteLink & { readonly mark: SiteMark }) | undefined;
  /** The drawer's names, in the reader's language, for screens below 1024 px. */
  readonly drawer: {
    readonly close: string;
    readonly open: string;
    readonly title: string;
  };
  readonly getStarted?: SiteLink | undefined;
  /** The repository: its mark, then its star count; `label` names it. */
  readonly github?:
    | (SiteLink & {
        readonly mark: SiteMark;
        /** The star count as shown, or nothing when it is unknown. */
        readonly stars?: string | undefined;
        /** What the count is, for screen readers, such as "stars". */
        readonly starsLabel: string;
      })
    | undefined;
  readonly home: {
    readonly href: string;
    /** The link's name for screen readers, such as "Peal home page". */
    readonly label: string;
    readonly name: string;
  };
  readonly items: readonly SiteNavItem[];
  /** The main navigation's name, such as "Main". */
  readonly label: string;
  readonly signIn?: SiteLink | undefined;
}

const Mark = ({
  className,
  mark,
}: {
  readonly className?: string | undefined;
  readonly mark: SiteMark;
}) =>
  mark.kind === "path" ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
    >
      <path d={mark.path} />
    </svg>
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        className,
        "bg-foreground text-background flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] leading-none font-semibold"
      )}
    >
      {mark.letters}
    </span>
  );

const RowIcon = ({ link }: { readonly link: SiteMenuLink }) => {
  if (link.mark !== undefined) {
    return (
      <span className="bg-card text-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
        <Mark mark={link.mark} />
      </span>
    );
  }

  const Icon = siteIcons[link.icon ?? "globe"];

  return (
    <span className="bg-card text-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </span>
  );
};

// Every row has its icon or mark in a 32 px tile; a name alone, such as a
// platform's, sits beside it without a description.
const MenuRow = ({ link }: { readonly link: SiteMenuLink }) =>
  link.description === undefined ? (
    <NavigationMenuLink href={link.href} className="items-center">
      <RowIcon link={link} />
      <span className="text-foreground font-medium">{link.title}</span>
    </NavigationMenuLink>
  ) : (
    <NavigationMenuLink href={link.href} className="items-start">
      <RowIcon link={link} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground font-medium">{link.title}</span>
        <span className="text-muted-foreground text-[13px] leading-snug">
          {link.description}
        </span>
      </span>
    </NavigationMenuLink>
  );

const groupWidth = (group: SiteMenuGroup) => {
  if (group.columns === 2) {
    return "w-[26rem]";
  }

  return group.links.every((link) => link.description === undefined)
    ? "w-52"
    : "w-72";
};

const MenuGroup = ({ group }: { readonly group: SiteMenuGroup }) => {
  const id = useId();

  return (
    <section
      aria-labelledby={id}
      className={cn(
        "bg-card flex flex-col gap-1 rounded-md border p-2 last:flex-1",
        groupWidth(group)
      )}
    >
      <h2 id={id} className="text-muted-foreground px-2 pt-1 text-xs">
        {group.label}
      </h2>
      <ul
        className={group.columns === 2 ? "grid grid-cols-2" : "flex flex-col"}
      >
        {group.links.map((link) => (
          <li key={link.href}>
            <MenuRow link={link} />
          </li>
        ))}
      </ul>
    </section>
  );
};

// The groups in columns: a group starts a column unless it stacks under
// the previous one. Columns share the panel's height, so the cells of a
// row are as tall as each other.
const columnsOf = (groups: readonly SiteMenuGroup[]) => {
  const columns: SiteMenuGroup[][] = [];

  for (const group of groups) {
    const last = columns.at(-1);

    if (group.stack === true && last !== undefined) {
      last.push(group);
    } else {
      columns.push([group]);
    }
  }

  return columns;
};

const FeatureCard = ({ feature }: { readonly feature: SiteMenuFeature }) => (
  <NavigationMenuLink
    href={feature.href}
    className="bg-muted hover:bg-accent group/feature w-60 flex-col gap-4 self-start border p-4"
  >
    <span className="text-muted-foreground font-mono text-xs tracking-[0.04em] lowercase">
      {feature.caption}
    </span>
    {feature.marks === undefined || feature.marks.length === 0 ? null : (
      <span className="flex gap-2">
        {feature.marks.map((mark) => (
          <span
            key={mark.kind === "path" ? mark.path : mark.letters}
            className="bg-card text-foreground flex size-10 items-center justify-center rounded-md border"
          >
            <Mark mark={mark} className="size-5" />
          </span>
        ))}
      </span>
    )}
    <span className="flex flex-col gap-1">
      <span className="text-foreground text-[15px] font-semibold">
        {feature.title}
      </span>
      <span className="text-muted-foreground text-[13px] leading-snug">
        {feature.description}
      </span>
    </span>
    <ArrowRightIcon
      aria-hidden="true"
      strokeWidth={1.75}
      className="text-foreground size-4 transition-transform group-hover/feature:translate-x-0.5 motion-reduce:transition-none"
    />
  </NavigationMenuLink>
);

const MenuPanel = ({ menu }: { readonly menu: SiteMenu }) => (
  <div className="flex gap-2">
    {columnsOf(menu.groups).map((column) => (
      <div key={column[0]?.label} className="flex flex-col gap-2">
        {column.map((group) => (
          <MenuGroup key={group.label} group={group} />
        ))}
      </div>
    ))}
    {menu.feature === undefined ? null : <FeatureCard feature={menu.feature} />}
  </div>
);

const RepositoryLink = ({
  className,
  repository,
}: {
  readonly className?: string | undefined;
  readonly repository: NonNullable<SiteHeaderProps["github"]>;
}) => (
  <a
    href={repository.href}
    className={cn(navigationMenuTriggerClassName, "gap-1.5", className)}
  >
    <Mark mark={repository.mark} className="text-foreground" />
    <span className="sr-only">{repository.label}</span>
    {repository.stars === undefined ? null : (
      <span className="text-foreground inline-flex items-center gap-1 font-mono text-xs tabular-nums">
        <StarIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
        {repository.stars}
        <span className="sr-only">{repository.starsLabel}</span>
      </span>
    )}
  </a>
);

const DiscordLink = ({
  discord,
}: {
  readonly discord: NonNullable<SiteHeaderProps["discord"]>;
}) => (
  <a
    href={discord.href}
    aria-label={discord.label}
    className={cn(navigationMenuTriggerClassName, "w-8 px-0")}
  >
    <Mark mark={discord.mark} className="text-foreground" />
  </a>
);

const MobileMenu = ({
  discord,
  drawer,
  getStarted,
  github: repository,
  items,
  label,
  signIn,
}: SiteHeaderProps) => (
  <Sheet side="right">
    <SheetTrigger
      render={
        <Button variant="ghost" size="icon" className="ms-auto lg:hidden" />
      }
    >
      <MenuIcon aria-hidden="true" strokeWidth={1.75} />
      <span className="sr-only">{drawer.open}</span>
    </SheetTrigger>
    <SheetContent closeLabel={drawer.close} className="gap-0 overflow-y-auto">
      <SheetHeader className="border-b">
        <SheetTitle>{drawer.title}</SheetTitle>
      </SheetHeader>
      <nav aria-label={label} className="flex flex-col gap-6 p-4">
        {items.map((item) =>
          item.kind === "link" ? (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.current === true ? "page" : undefined}
              className="text-foreground text-[15px] font-semibold"
            >
              {item.label}
            </a>
          ) : (
            <section key={item.value} className="flex flex-col gap-3">
              <h2 className="text-foreground text-[15px] font-semibold">
                {item.label}
              </h2>
              {item.groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-xs">{group.label}</p>
                  <ul
                    className={
                      group.columns === 2 ? "grid grid-cols-2" : "flex flex-col"
                    }
                  >
                    {group.links.map((link) => {
                      const Icon = siteIcons[link.icon ?? "globe"];

                      return (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            className="hover:bg-accent -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5"
                          >
                            {link.mark === undefined ? (
                              <Icon
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="text-muted-foreground size-4"
                              />
                            ) : (
                              <Mark
                                mark={link.mark}
                                className="text-muted-foreground"
                              />
                            )}
                            {link.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )
        )}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t p-4">
        <div className="flex items-center gap-1">
          {repository === undefined ? null : (
            <RepositoryLink repository={repository} className="-ms-2.5" />
          )}
          {repository === undefined || discord === undefined ? null : (
            <Separator orientation="vertical" className="h-5 self-center!" />
          )}
          {discord === undefined ? null : <DiscordLink discord={discord} />}
        </div>
        {signIn === undefined ? null : (
          <a
            href={signIn.href}
            className={buttonVariants({
              className: "w-full",
              variant: "outline",
            })}
          >
            {signIn.label}
          </a>
        )}
        {getStarted === undefined ? null : (
          <a
            href={getStarted.href}
            className={buttonVariants({ className: "w-full" })}
          >
            {getStarted.label}
          </a>
        )}
      </div>
    </SheetContent>
  </Sheet>
);

/**
 * The marketing site's header (DESIGN.md, Site): the mark, the main
 * navigation with its mega menus, GitHub and Discord, and the way into the
 * app. Every link and label comes from the page, in its language.
 */
const SiteHeader = (props: SiteHeaderProps) => {
  const { className, discord, getStarted, github, home, items, label, signIn } =
    props;

  return (
    <header
      data-slot="site-header"
      className={cn("bg-background relative z-40 border-b", className)}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <a
          href={home.href}
          aria-label={home.label}
          className="text-foreground focus-visible:ring-ring/50 -ms-1 flex items-center gap-2 rounded-md px-1 text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-3"
        >
          <PealMark className="size-6" />
          {home.name}
        </a>
        <NavigationMenu aria-label={label} className="hidden lg:flex">
          <NavigationMenuList>
            {items.map((item) =>
              item.kind === "link" ? (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                    href={item.href}
                    current={item.current === true}
                    className={cn(navigationMenuTriggerClassName, "p-0 px-2.5")}
                  >
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={item.value} value={item.value}>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent keepMounted>
                    <MenuPanel menu={item} />
                  </NavigationMenuContent>
                </NavigationMenuItem>
              )
            )}
          </NavigationMenuList>
          <NavigationMenuViewport />
        </NavigationMenu>
        <div className="ms-auto hidden items-center gap-1 lg:flex">
          {github === undefined ? null : <RepositoryLink repository={github} />}
          {github === undefined || discord === undefined ? null : (
            <Separator
              orientation="vertical"
              className="mx-1 h-5 self-center!"
            />
          )}
          {discord === undefined ? null : <DiscordLink discord={discord} />}
          {signIn === undefined ? null : (
            <a
              href={signIn.href}
              className={buttonVariants({
                className: "ms-2",
                variant: "ghost",
              })}
            >
              {signIn.label}
            </a>
          )}
          {getStarted === undefined ? null : (
            <a href={getStarted.href} className={buttonVariants()}>
              {getStarted.label}
            </a>
          )}
        </div>
        <MobileMenu {...props} />
      </div>
    </header>
  );
};

export { SiteHeader };

export type {
  SiteHeaderProps,
  SiteIcon,
  SiteLink,
  SiteMenu,
  SiteMenuFeature,
  SiteMenuGroup,
  SiteMenuLink,
  SiteMark,
  SiteNavItem,
  SiteNavLink,
};
