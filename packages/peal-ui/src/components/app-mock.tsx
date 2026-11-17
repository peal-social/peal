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
  readonly breadcrumb: string;
  readonly className?: string | undefined;
  readonly content: AppMockContent;
  readonly groups: readonly AppMockNavGroup[];
  readonly mode: AppMode;
  /** The switch's two labels, as the app names them: Studio and Console. */
  readonly modes: Readonly<Record<AppMode, string>>;
}

/**
 * The mode switch as the app's sidebar draws it (DESIGN.md, The frame):
 * the mark in a tile, white in Studio and ink in Console, beside the two
 * modes, the selected one lifted.
 */
const ModeSwitch = ({ mode, modes }: Pick<AppMockProps, "mode" | "modes">) => (
  <span className="bg-muted flex items-center gap-0.5 rounded-md border p-0.5">
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-sm",
        mode === "console" ? "bg-foreground" : "bg-card border"
      )}
    >
      <PealMark className="size-4" />
    </span>
    {(["studio", "console"] as const).map((item) => (
      <span
        key={item}
        className={cn(
          "flex h-6 flex-1 items-center justify-center rounded-sm px-1 text-[11px] font-medium whitespace-nowrap",
          item === mode
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground"
        )}
      >
        {modes[item]}
      </span>
    ))}
  </span>
);

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
 * sit beside another: the sidebar with the mode switch and the mode's
 * groups, the 56 px top bar with the breadcrumb, and the content, a
 * calendar or white cards. Decoration: screen readers skip it.
 */
const AppMock = ({
  breadcrumb,
  className,
  content,
  groups,
  mode,
  modes,
}: AppMockProps) => (
  <div
    aria-hidden="true"
    data-slot="app-mock"
    className={cn(
      "bg-background flex min-w-0 overflow-hidden rounded-md border text-start",
      className
    )}
  >
    <div className="hidden w-44 shrink-0 flex-col gap-3 border-e p-2 sm:flex">
      <ModeSwitch mode={mode} modes={modes} />
      {groups.map((group) => (
        <div key={group.label ?? ""} className="flex flex-col gap-0.5">
          {group.label === undefined ? null : (
            <span className="text-muted-foreground px-2 pb-0.5 text-[11px]">
              {group.label}
            </span>
          )}
          {group.items.map((item) => (
            <span
              key={item.label}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-xs",
                item.current === true
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <SiteIconView icon={item.icon} className="size-3.5" />
              {item.label}
            </span>
          ))}
        </div>
      ))}
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-3">
        <span className="sm:hidden">
          <ModeSwitch mode={mode} modes={modes} />
        </span>
        <span className="text-foreground truncate text-[13px] font-medium">
          {breadcrumb}
        </span>
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
