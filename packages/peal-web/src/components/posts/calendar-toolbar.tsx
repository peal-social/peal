"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ListOrderedIcon,
  RadioTowerIcon,
  TagIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Queue, SocialChannel, Tag } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
  ListViews,
  viewTabClass,
} from "peal-ui/components/list-toolbar";
import { TagDot } from "peal-ui/components/tag";
import type { ComponentType, ReactNode } from "react";

import { useChannelLabel } from "#components/channels/channel-label.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { DisplayMenu } from "#components/lists/display-menu.tsx";
import type { Layouts } from "#components/lists/display-menu.tsx";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { FilterProperty } from "#components/lists/filter-menu.tsx";
import { isFiltering, noFilter } from "#posts/calendar-filter.ts";
import type { CalendarFilter } from "#posts/calendar-filter.ts";
import type { CalendarView } from "#posts/calendar-query.ts";

// The calendar's properties, by the address's names.
type CalendarProperty = "channel" | "queue" | "tag";

const keyOf = {
  channel: "channelIds",
  queue: "queueIds",
  tag: "tagIds",
} as const satisfies Readonly<Record<CalendarProperty, keyof CalendarFilter>>;

const icons = {
  channel: RadioTowerIcon,
  queue: ListOrderedIcon,
  tag: TagIcon,
} satisfies Readonly<Record<CalendarProperty, LucideIcon>>;

const views: readonly CalendarView[] = ["day", "week", "month"];

/** A link of the app, which the screen gives, so tests render without Next. */
export type ViewLink = ComponentType<{
  readonly "aria-current"?: "page";
  readonly children: ReactNode;
  readonly className: string;
  readonly href: string;
}>;

/**
 * The calendar's toolbar (DESIGN.md, "Filters and display"): its views
 * (Day, Week, Month) as tabs, then the way through time (the period
 * before, Today, the one after), Filter, whose channels, tags and queues
 * each keep several at once, and Display with the posts page's layouts;
 * under it, a chip for each, Clear and how many posts on screen the
 * filter hides. A kind the workspace has none of is left out.
 */
export const CalendarToolbar = ({
  channels,
  filter,
  hidden,
  hrefOf,
  layouts,
  link: Link,
  labels,
  onFilter,
  onStep,
  onToday,
  queues,
  tags,
  view,
}: {
  readonly channels: readonly SocialChannel[];
  readonly filter: CalendarFilter;
  /** How many of the posts on screen the filter hides. */
  readonly hidden: number;
  /** The address of the calendar in another view. */
  readonly hrefOf: (view: CalendarView) => string;
  /** The posts page's layouts, which Display offers. */
  readonly layouts?: Layouts;
  /** The app's link, which keeps the page where it is. */
  readonly link: ViewLink;
  /** The names of the period before and the one after, for the arrows. */
  readonly labels: { readonly next: string; readonly previous: string };
  readonly onFilter: (filter: CalendarFilter) => void;
  readonly onStep: (direction: -1 | 1) => void;
  readonly onToday: () => void;
  readonly queues: readonly Queue[];
  readonly tags: readonly Tag[];
  readonly view: CalendarView;
}) => {
  const t = useTranslations("Posts.Calendar");
  const list = useTranslations("Posts.List");
  const lists = useTranslations("Lists");
  const channelLabel = useChannelLabel();
  const menu = useFilterMenu();

  const properties: (FilterProperty & { readonly id: CalendarProperty })[] = [
    ...(channels.length === 0
      ? []
      : [
          {
            icon: RadioTowerIcon,
            id: "channel" as const,
            label: list("channel"),
            multiple: true,
            values: channels.map((channel) => ({
              id: channel.id,
              label: channelLabel(channel),
              mark: <PlatformMark platform={channel.platform} />,
            })),
          },
        ]),
    ...(tags.length === 0
      ? []
      : [
          {
            icon: TagIcon,
            id: "tag" as const,
            label: list("tag"),
            multiple: true,
            values: tags.map((tag) => ({
              id: tag.id,
              label: tag.name,
              mark: <TagDot colour={tag.colour} />,
            })),
          },
        ]),
    ...(queues.length === 0
      ? []
      : [
          {
            icon: ListOrderedIcon,
            id: "queue" as const,
            label: list("queue"),
            multiple: true,
            values: queues.map((queue) => ({
              id: queue.id,
              label: queue.name,
            })),
          },
        ]),
  ];

  const chosen = {
    channel: filter.channelIds,
    queue: filter.queueIds,
    tag: filter.tagIds,
  } satisfies Readonly<Record<CalendarProperty, readonly string[]>>;

  // What a chip shows of its values: their names, joined.
  const shownValues = (property: CalendarProperty): ReactNode => {
    const known = properties.find(({ id }) => id === property)?.values ?? [];

    return chosen[property]
      .map((id) => known.find((value) => value.id === id)?.label ?? id)
      .join(", ");
  };

  const choose = (property: CalendarProperty, values: readonly string[]) => {
    onFilter({ ...filter, [keyOf[property]]: values });
  };

  const chips = (["channel", "tag", "queue"] as const).filter(
    (property) => chosen[property].length > 0
  );

  return (
    <div className="flex flex-col gap-2">
      <ListToolbar>
        <ListViews aria-label={t("views")}>
          {views.map((each) => (
            <Link
              key={each}
              href={hrefOf(each)}
              className={viewTabClass(each === view)}
              {...(each === view ? { "aria-current": "page" as const } : {})}
            >
              {t(each)}
            </Link>
          ))}
        </ListViews>
        <ListToolbarEnd>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels.previous}
            onClick={() => {
              onStep(-1);
            }}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels.next}
            onClick={() => {
              onStep(1);
            }}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
          {properties.length === 0 ? null : (
            <FilterMenu
              chosen={chosen}
              properties={properties}
              state={menu}
              onChoose={(property, values) => {
                const known = properties.find(({ id }) => id === property);

                if (known !== undefined) {
                  choose(known.id, values);
                }
              }}
            />
          )}
          {layouts === undefined ? null : (
            <DisplayMenu active={false} layouts={layouts} />
          )}
        </ListToolbarEnd>
      </ListToolbar>
      {isFiltering(filter) ? (
        <FilterChips aria-label={lists("filters")}>
          {chips.map((property) => {
            const Icon = icons[property];
            const name = properties.find(({ id }) => id === property)?.label;

            return (
              <FilterChip
                key={property}
                icon={<Icon aria-hidden />}
                join={
                  chosen[property].length > 1 ? lists("isAnyOf") : lists("is")
                }
                property={name ?? property}
                removeLabel={lists("remove", { property: name ?? property })}
                value={shownValues(property)}
                onEdit={() => {
                  menu.openAt(property);
                }}
                onRemove={() => {
                  choose(property, []);
                }}
              />
            );
          })}
          <FilterChipsClear
            onClick={() => {
              onFilter(noFilter);
            }}
          >
            {lists("clear")}
          </FilterChipsClear>
          {hidden === 0 ? null : (
            <output className="text-muted-foreground text-sm">
              {t("hiddenByFilters", { count: hidden })}
            </output>
          )}
        </FilterChips>
      ) : null}
    </div>
  );
};
