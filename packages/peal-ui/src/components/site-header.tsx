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

/** A row of a mega menu: an icon, a title and a one-line description. */
interface SiteMenuLink {
  readonly description: string;
  readonly href: string;
  readonly icon: SiteIcon;
  readonly title: string;
}

interface SiteMenuGroup {
  readonly label: string;
  readonly links: readonly SiteMenuLink[];
}

/** The card that closes a mega menu on the right. */
interface SiteMenuFeature {
  readonly caption: string;
  readonly description: string;
  readonly href: string;
  readonly title: string;
}

interface SiteMenu {
  readonly feature?: SiteMenuFeature | undefined;
  readonly groups: readonly SiteMenuGroup[];
  readonly kind: "menu";
  readonly label: string;
  /** A row under the groups, across them, such as every platform. */
  readonly more?: SiteMenuLink | undefined;
  readonly value: string;
}

interface SiteNavLink extends SiteLink {
  readonly current?: boolean | undefined;
  readonly kind: "link";
}

type SiteNavItem = SiteMenu | SiteNavLink;

interface SiteHeaderProps {
  readonly className?: string | undefined;
  readonly discord?: SiteLink | undefined;
  /** The drawer's names, in the reader's language, for screens below 1024 px. */
  readonly drawer: {
    readonly close: string;
    readonly open: string;
    readonly title: string;
  };
  readonly getStarted?: SiteLink | undefined;
  readonly github?:
    | (SiteLink & {
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

const RowIcon = ({ icon }: { readonly icon: SiteIcon }) => {
  const Icon = siteIcons[icon];

  return (
    <span className="bg-card text-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </span>
  );
};

const MenuRow = ({ link }: { readonly link: SiteMenuLink }) => (
  <NavigationMenuLink href={link.href} className="items-start">
    <RowIcon icon={link.icon} />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-foreground font-medium">{link.title}</span>
      <span className="text-muted-foreground text-[13px] leading-snug">
        {link.description}
      </span>
    </span>
  </NavigationMenuLink>
);

const MenuGroup = ({ group }: { readonly group: SiteMenuGroup }) => {
  const id = useId();

  return (
    <section
      aria-labelledby={id}
      className="bg-card flex w-72 flex-col gap-1 rounded-md border p-2"
    >
      <h2 id={id} className="text-muted-foreground px-2 pt-1 text-xs">
        {group.label}
      </h2>
      <ul className="flex flex-col">
        {group.links.map((link) => (
          <li key={link.href}>
            <MenuRow link={link} />
          </li>
        ))}
      </ul>
    </section>
  );
};

const MenuPanel = ({ menu }: { readonly menu: SiteMenu }) => (
  <div className="flex gap-2">
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {menu.groups.map((group) => (
          <MenuGroup key={group.label} group={group} />
        ))}
      </div>
      {menu.more === undefined ? null : (
        <div className="bg-card rounded-md border p-2">
          <MenuRow link={menu.more} />
        </div>
      )}
    </div>
    {menu.feature === undefined ? null : (
      <NavigationMenuLink
        href={menu.feature.href}
        className="bg-muted hover:bg-accent group/feature w-60 flex-col justify-between gap-6 border p-4"
      >
        <span className="text-muted-foreground font-mono text-xs tracking-[0.04em] lowercase">
          {menu.feature.caption}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-foreground text-[15px] font-semibold">
            {menu.feature.title}
          </span>
          <span className="text-muted-foreground text-[13px] leading-snug">
            {menu.feature.description}
          </span>
          <ArrowRightIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="text-foreground mt-2 size-4 transition-transform group-hover/feature:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </NavigationMenuLink>
    )}
  </div>
);

const GitHubLink = ({
  className,
  github,
}: {
  readonly className?: string | undefined;
  readonly github: NonNullable<SiteHeaderProps["github"]>;
}) => (
  <a
    href={github.href}
    className={cn(navigationMenuTriggerClassName, "gap-1.5", className)}
  >
    {github.label}
    {github.stars === undefined ? null : (
      <span className="text-foreground inline-flex items-center gap-1 font-mono text-xs tabular-nums">
        <StarIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
        {github.stars}
        <span className="sr-only">{github.starsLabel}</span>
      </span>
    )}
  </a>
);

const MobileMenu = ({
  discord,
  drawer,
  getStarted,
  github,
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
              {[
                ...item.groups,
                ...(item.more === undefined
                  ? []
                  : [{ label: "", links: [item.more] }]),
              ].map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  {group.label === "" ? null : (
                    <p className="text-muted-foreground text-xs">
                      {group.label}
                    </p>
                  )}
                  <ul className="flex flex-col">
                    {group.links.map((link) => {
                      const Icon = siteIcons[link.icon];

                      return (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            className="hover:bg-accent -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5"
                          >
                            <Icon
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="text-muted-foreground size-4"
                            />
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
          {github === undefined ? null : (
            <GitHubLink github={github} className="-ms-2.5" />
          )}
          {github === undefined || discord === undefined ? null : (
            <Separator orientation="vertical" className="h-5 self-center!" />
          )}
          {discord === undefined ? null : (
            <a href={discord.href} className={navigationMenuTriggerClassName}>
              {discord.label}
            </a>
          )}
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
          {github === undefined ? null : <GitHubLink github={github} />}
          {github === undefined || discord === undefined ? null : (
            <Separator
              orientation="vertical"
              className="mx-1 h-5 self-center!"
            />
          )}
          {discord === undefined ? null : (
            <a href={discord.href} className={navigationMenuTriggerClassName}>
              {discord.label}
            </a>
          )}
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
  SiteNavItem,
  SiteNavLink,
};
