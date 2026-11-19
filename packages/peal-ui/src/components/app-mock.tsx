import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquarePenIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { MockChip } from "./feature-cell";
import type { MockChipContent, MockRow } from "./feature-cell";
import { PealMark } from "./peal-mark";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

interface AppMockNavItem {
  readonly current?: boolean | undefined;
  readonly icon: SiteIcon;
  readonly label: string;
}

interface AppMockNavGroup {
  /** The group's small label; the first group has none. */
  readonly label?: string | undefined;
  readonly items: readonly AppMockNavItem[];
}

/** A post on the mock calendar: its time, its channel's mark and its state. */
interface AppMockPost {
  readonly chip: MockChipContent;
  readonly mark: SiteMark;
  readonly time: string;
}

/** A white card of the content: a title, then rows as the app lists them. */
interface AppMockCard {
  /** A mono value beside the title, such as an endpoint's address. */
  readonly caption?: string | undefined;
  readonly rows: readonly MockRow[];
  readonly title: string;
}

type AppMockContent =
  | {
      readonly days: readonly {
        readonly label: string;
        readonly posts: readonly AppMockPost[];
      }[];
      readonly kind: "calendar";
    }
  | { readonly cards: readonly AppMockCard[]; readonly kind: "cards" };

type AppMode = "console" | "studio";

interface AppMockProps {
  /** The account's initial, in the bottom bar's round avatar. */
  readonly account: string;
  /** The page's actions, as small ghost buttons at the header's end. */
  readonly actions?: readonly string[] | undefined;
  readonly className?: string | undefined;
  readonly content: AppMockContent;
  readonly groups: readonly AppMockNavGroup[];
  readonly mode: AppMode;
  /** The switch's two labels, as the app names them: Studio and Console. */
  readonly modes: Readonly<Record<AppMode, string>>;
  /** The page's name, in the panel's header. */
  readonly page: string;
  /** The section the page drills down from, before its name. */
  readonly section?: string | undefined;
  /** The sidebar's foot. */
  readonly settings: string;
  /** The workspace's name, in the sidebar's head. */
  readonly workspace: string;
}

// The open mode's segment, as the app draws it: ink in PealAPI.
const currentModeClass: Readonly<Record<AppMode, string>> = {
  console: "bg-primary text-primary-foreground shadow-xs",
  studio: "bg-card text-foreground ring-border shadow-xs ring-1",
};

/**
 * The mode switch as the app's sidebar draws it (DESIGN.md, The frame):
 * the mark in a tile, white in Studio and ink in Console, beside the two
 * modes, the selected one lifted (ink in Console).
 */
const ModeSwitch = ({ mode, modes }: Pick<AppMockProps, "mode" | "modes">) => (
  <span className="bg-secondary ring-border flex items-center gap-0.5 rounded-md p-0.5 ring-1 ring-inset">
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-sm",
        mode === "console"
          ? "bg-primary"
          : "bg-card ring-border shadow-xs ring-1"
      )}
    >
      <PealMark className="size-4" />
    </span>
    {(["studio", "console"] as const).map((item) => (
      <span
        key={item}
        className={cn(
          "flex h-6 flex-1 items-center justify-center rounded-sm px-1 text-[11px] font-medium whitespace-nowrap",
          item === mode ? currentModeClass[item] : "text-muted-foreground"
        )}
      >
        {modes[item]}
      </span>
    ))}
  </span>
);

// An icon button of the frame, drawn: a ghost square around its icon.
const IconSpot = ({ children }: { readonly children: ReactNode }) => (
  <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center [&_svg]:size-3.5">
    {children}
  </span>
);

/**
 * The sidebar's head (DESIGN.md, The frame): the workspace switcher (its
 * tile, its name, a chevron), then Search and New post.
 */
const SidebarHead = ({ workspace }: Pick<AppMockProps, "workspace">) => (
  <span className="flex h-9 shrink-0 items-center gap-0.5">
    <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1">
      <span className="bg-brand-tint text-brand-text flex size-4 shrink-0 items-center justify-center rounded-sm text-[8px] font-semibold">
        {workspace.slice(0, 2).toUpperCase()}
      </span>
      <span className="text-foreground min-w-0 truncate text-xs font-medium">
        {workspace}
      </span>
      <ChevronDownIcon className="text-muted-foreground size-3 shrink-0" />
    </span>
    <IconSpot>
      <SearchIcon />
    </IconSpot>
    <IconSpot>
      <SquarePenIcon />
    </IconSpot>
  </span>
);

const navItemClass =
  "flex h-7 items-center gap-2 rounded-md px-2 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0";

const Calendar = ({
  days,
}: {
  readonly days: Extract<AppMockContent, { kind: "calendar" }>["days"];
}) => (
  <div className="bg-card grid flex-1 auto-cols-fr grid-flow-col rounded-md border">
    {days.map((day, index) => (
      <div
        key={day.label}
        className={cn(
          "flex min-w-0 flex-col gap-1.5 p-2",
          index > 0 ? "border-s" : undefined
        )}
      >
        <span className="text-muted-foreground font-mono text-[11px]">
          {day.label}
        </span>
        {day.posts.map((post) => (
          <span
            key={`${post.time}${post.chip.text}`}
            className="flex flex-col gap-1 rounded-sm border p-1.5"
          >
            <span className="text-foreground flex items-center gap-1.5 font-mono text-[11px]">
              <Mark mark={post.mark} className="size-3" />
              {post.time}
            </span>
            <span className="[&>span]:whitespace-nowrap">
              <MockChip state={post.chip.state} text={post.chip.text} />
            </span>
          </span>
        ))}
      </div>
    ))}
  </div>
);

const Cards = ({ cards }: { readonly cards: readonly AppMockCard[] }) => (
  <div className="flex flex-1 flex-col gap-3">
    {cards.map((card) => (
      <div key={card.title} className="bg-card rounded-md border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-foreground text-[13px] font-semibold">
            {card.title}
          </span>
          {card.caption === undefined ? null : (
            <span className="text-muted-foreground truncate font-mono text-[11px]">
              {card.caption}
            </span>
          )}
        </div>
        <ul>
          {card.rows.map((row) => (
            <li
              key={`${row.label}${row.value}`}
              className="flex items-center justify-between gap-3 border-b px-3 py-2 text-[13px] last:border-b-0"
            >
              <span className="text-foreground min-w-0 truncate font-mono text-xs">
                {row.label}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground font-mono text-[11px]">
                  {row.value}
                </span>
                {row.chip === undefined ? null : (
                  <MockChip state={row.chip.state} text={row.chip.text} />
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

/**
 * A page of the app in its frame (DESIGN.md, The frame), small enough to
 * sit beside another. On the page's background, the sidebar (its head with
 * the workspace switcher, Search and New post, the mode switch, the mode's
 * groups, Settings at its foot) and the page in a white panel, under its
 * 48 px header (the page's name and its actions), the content a calendar or
 * white cards; then the bottom bar, the account's avatar at its start and
 * Help at its end. Below 640 px the sidebar folds away and the switch moves
 * into the header. Decoration: screen readers skip it.
 */
const AppMock = ({
  account,
  actions,
  className,
  content,
  groups,
  mode,
  modes,
  page,
  section,
  settings,
  workspace,
}: AppMockProps) => (
  <div
    aria-hidden="true"
    data-slot="app-mock"
    className={cn(
      "bg-background flex min-w-0 flex-col overflow-hidden rounded-md border text-start",
      className
    )}
  >
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-44 shrink-0 flex-col gap-1 px-2 sm:flex">
        <SidebarHead workspace={workspace} />
        <ModeSwitch mode={mode} modes={modes} />
        <div className="flex flex-1 flex-col gap-3 py-2">
          {groups.map((group) => (
            <div key={group.label ?? ""} className="flex flex-col gap-px">
              {group.label === undefined ? null : (
                <span className="text-muted-foreground px-2 pb-0.5 text-[11px]">
                  {group.label}
                </span>
              )}
              {group.items.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    navItemClass,
                    item.current === true
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground"
                  )}
                >
                  <SiteIconView icon={item.icon} />
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
        <span className={cn(navItemClass, "text-sidebar-foreground")}>
          <SlidersHorizontalIcon />
          <span className="flex-1 truncate">{settings}</span>
          <ChevronRightIcon className="text-muted-foreground" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col sm:pe-1.5 sm:pt-1.5">
        <div className="bg-card flex flex-1 flex-col overflow-hidden border-b sm:rounded-lg sm:border">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
            <span className="sm:hidden">
              <ModeSwitch mode={mode} modes={modes} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
              {section === undefined ? null : (
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
                  {section}
                  <span className="text-muted-foreground/60">›</span>
                </span>
              )}
              <span className="text-foreground truncate font-medium">
                {page}
              </span>
            </span>
            {actions?.map((action) => (
              <span
                key={action}
                className="text-foreground flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium [&_svg]:size-3.5"
              >
                <PlusIcon />
                {action}
              </span>
            ))}
          </div>
          <div className="flex flex-1 p-3">
            {content.kind === "calendar" ? (
              <Calendar days={content.days} />
            ) : (
              <Cards cards={content.cards} />
            )}
          </div>
        </div>
      </div>
    </div>
    <div className="flex h-9 shrink-0 items-center justify-between px-2 sm:ps-3">
      <span className="bg-brand-tint text-brand-text flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
        {account}
      </span>
      <IconSpot>
        <CircleHelpIcon />
      </IconSpot>
    </div>
  </div>
);

/** One of the two products, by its name and a line. */
interface ProductSummary {
  readonly line: string;
  readonly name: string;
}

/**
 * The two products side by side (DESIGN.md, Site): their names and a line
 * each in two cells, then one framed panel on `muted` holding a page of
 * each side of the app, Studio's and Console's, next to each other.
 */
const ProductPair = ({
  className,
  mocks,
  products,
}: {
  readonly className?: string | undefined;
  readonly mocks: readonly [AppMockProps, AppMockProps];
  readonly products: readonly [ProductSummary, ProductSummary];
}) => (
  <div className={cn("mx-auto max-w-6xl border-t", className)}>
    <ul className="grid border-b md:grid-cols-2">
      {products.map((product, index) => (
        <li
          key={product.name}
          className={cn(
            "flex flex-col gap-1.5 p-6 sm:p-8",
            index === 0 ? "border-b md:border-e md:border-b-0" : undefined
          )}
        >
          <span className="text-foreground text-[15px] font-semibold">
            {product.name}
          </span>
          <span className="text-muted-foreground text-base sm:text-lg">
            {product.line}
          </span>
        </li>
      ))}
    </ul>
    <div className="bg-muted grid gap-3 border-b p-3 sm:p-6 lg:grid-cols-2">
      {mocks.map((mock) => (
        <AppMock key={mock.mode} {...mock} className="min-h-80" />
      ))}
    </div>
  </div>
);

export { AppMock, ProductPair };

export type {
  AppMockCard,
  AppMockContent,
  AppMockNavGroup,
  AppMockNavItem,
  AppMockPost,
  AppMockProps,
  AppMode,
  ProductSummary,
};
