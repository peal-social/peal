"use client";

import {
  CircleDashedIcon,
  CircleCheckBigIcon,
  ListOrderedIcon,
  RadioTowerIcon,
  TagIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { PostOutcomeSchema, PostStatusSchema } from "peal-contract";
import type { Queue, SocialChannel, Tag } from "peal-contract";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
} from "peal-ui/components/list-toolbar";
import { TagDot } from "peal-ui/components/tag";
import type { ReactNode } from "react";

import { useChannelLabel } from "#components/channels/channel-label.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { DisplayMenu } from "#components/lists/display-menu.tsx";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { FilterProperty } from "#components/lists/filter-menu.tsx";
import {
  byTime,
  isViewStatus,
  noFilters,
  orderingOf,
  sortOf,
  withFilter,
} from "#posts/post-list-filter.ts";
import type {
  FilterName,
  PostListFilters,
  PostOrdering,
} from "#posts/post-list-filter.ts";

const statuses = PostStatusSchema.literals;
const outcomes = PostOutcomeSchema.literals;

// The menu's properties, by the query string's names.
type PostProperty = Exclude<FilterName, "sort">;

const valueOf = (
  filters: PostListFilters,
  property: PostProperty
): string | undefined => {
  if (property === "status") {
    return filters.status;
  }

  if (property === "outcome") {
    return filters.outcome;
  }

  if (property === "channel") {
    return filters.channelId;
  }

  return property === "tag" ? filters.tagId : filters.queueId;
};

/**
 * The posts list's toolbar (DESIGN.md, "Filters and display"): `views`
 * at its start, then Filter (F) over status, outcome, channel, tag and
 * queue, Display (the order), and the page's `actions`; under it, a chip
 * for each filter and Clear. A chip for a channel, tag or queue the
 * workspace no longer has says so, never "every". An outcome goes with
 * finished posts only, so choosing one chooses them too.
 */
// The menu's values of a filter: one at most, as the API takes one.
const valuesOf = (value: string | undefined): readonly string[] =>
  value === undefined ? [] : [value];

export const PostListToolbar = ({
  actions,
  channels,
  filters,
  onChange,
  queues,
  tags,
  views = null,
}: {
  readonly actions: ReactNode;
  readonly channels: readonly SocialChannel[];
  readonly filters: PostListFilters;
  readonly onChange: (filters: PostListFilters) => void;
  readonly queues: readonly Queue[];
  readonly tags: readonly Tag[];
  readonly views?: ReactNode;
}) => {
  const t = useTranslations("Posts.List");
  const lists = useTranslations("Lists");
  const tPosts = useTranslations("Posts");

  const channelLabel = useChannelLabel();
  const menu = useFilterMenu();

  const properties: (FilterProperty & { readonly id: PostProperty })[] = [
    {
      icon: CircleDashedIcon,
      id: "status",
      label: t("status"),
      values: statuses.map((status) => ({
        id: status,
        label: tPosts("status", { status }),
      })),
    },
    {
      icon: CircleCheckBigIcon,
      id: "outcome",
      label: t("outcome"),
      values: outcomes.map((outcome) => ({
        id: outcome,
        label: tPosts("outcome", { outcome }),
      })),
    },
    ...(channels.length === 0
      ? []
      : [
          {
            icon: RadioTowerIcon,
            id: "channel" as const,
            label: t("channel"),
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
            label: t("tag"),
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
            label: t("queue"),
            values: queues.map((queue) => ({
              id: queue.id,
              label: queue.name,
            })),
          },
        ]),
  ];

  const choose = (property: PostProperty, value: string | null) => {
    // An outcome is of finished posts: choosing one chooses them.
    const base =
      property === "outcome" && value !== null
        ? withFilter(filters, "status", "finished")
        : filters;

    onChange(withFilter(base, property, value ?? undefined));
  };

  // What a chip shows of its value: its name, or that it is gone.
  const shownValue = (property: PostProperty, value: string): ReactNode => {
    if (property === "status") {
      return tPosts("status", { status: filters.status ?? "draft" });
    }

    if (property === "outcome") {
      return tPosts("outcome", { outcome: filters.outcome ?? "failed" });
    }

    if (property === "channel") {
      const channel = channels.find(({ id }) => id === value);

      return channel === undefined
        ? t("unknownChannel")
        : channelLabel(channel);
    }

    if (property === "tag") {
      const tag = tags.find(({ id }) => id === value);

      return tag === undefined ? (
        t("unknownTag")
      ) : (
        <>
          <TagDot colour={tag.colour} />
          {tag.name}
        </>
      );
    }

    return queues.find(({ id }) => id === value)?.name ?? t("unknownQueue");
  };

  const names: Readonly<Record<PostProperty, string>> = {
    channel: t("channel"),
    outcome: t("outcome"),
    queue: t("queue"),
    status: t("status"),
    tag: t("tag"),
  };

  const icons = {
    channel: RadioTowerIcon,
    outcome: CircleCheckBigIcon,
    queue: ListOrderedIcon,
    status: CircleDashedIcon,
    tag: TagIcon,
  } satisfies Readonly<Record<PostProperty, LucideIcon>>;

  const chips = (
    ["status", "outcome", "channel", "tag", "queue"] as const
  ).flatMap((property) => {
    const value = valueOf(filters, property);

    // A status a tab shows is said by the tab, not a chip.
    const shownByView =
      views !== null && property === "status" && isViewStatus(filters.status);

    return value === undefined || shownByView ? [] : [{ property, value }];
  });

  const ordering = orderingOf(filters.sort);

  const chosen = {
    channel: valuesOf(filters.channelId),
    outcome: valuesOf(filters.outcome),
    queue: valuesOf(filters.queueId),
    status: valuesOf(filters.status),
    tag: valuesOf(filters.tagId),
  };

  return (
    <div className="flex flex-col gap-2">
      <ListToolbar>
        {views}
        <ListToolbarEnd>
          <FilterMenu
            active={chips.length > 0}
            chosen={chosen}
            properties={properties}
            state={menu}
            onChoose={(property, values) => {
              const known = properties.find(({ id }) => id === property);

              if (known !== undefined) {
                choose(known.id, values[0] ?? null);
              }
            }}
          />
          <DisplayMenu
            active={filters.sort !== noFilters.sort}
            direction={ordering.direction}
            field={ordering.field}
            fields={[
              { id: "created", label: t("orderCreated") },
              { id: "scheduled", label: t("orderScheduled") },
            ]}
            onChange={(field, direction) => {
              const ordered: PostOrdering =
                field === "scheduled" ? "scheduled" : "created";

              onChange(withFilter(filters, "sort", sortOf(ordered, direction)));
            }}
          />
          {actions}
        </ListToolbarEnd>
      </ListToolbar>
      {chips.length === 0 ? null : (
        <FilterChips aria-label={lists("filters")}>
          {chips.map(({ property, value }) => {
            const Icon = icons[property];

            return (
              <FilterChip
                key={property}
                icon={<Icon aria-hidden />}
                join={lists("is")}
                property={names[property]}
                removeLabel={lists("remove", { property: names[property] })}
                value={shownValue(property, value)}
                onEdit={() => {
                  menu.openAt(property);
                }}
                onRemove={() => {
                  choose(property, null);
                }}
              />
            );
          })}
          <FilterChipsClear
            onClick={() => {
              onChange({ sort: filters.sort });
            }}
          >
            {lists("clear")}
          </FilterChipsClear>
        </FilterChips>
      )}
      {byTime(filters.sort) ? (
        <p className="text-muted-foreground text-sm">{t("byTimeNote")}</p>
      ) : null}
    </div>
  );
};
