"use client";

import {
  BlocksIcon,
  CableIcon,
  LayoutGridIcon,
  SparklesIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ChannelPlatformSchema } from "peal-contract";
import type { Channel, ChannelPlatform } from "peal-contract";
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateHidden,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
  ListViews,
  viewTabClass,
} from "peal-ui/components/list-toolbar";
import type { ReactNode } from "react";

import {
  channelMatches,
  channelOrders,
  channelViews,
  isNarrowed,
  isReordered,
  orderedChannels,
  viewOfChannel,
  withoutFilters,
} from "#channels/channel-filter.ts";
import type { ChannelFilter, ChannelView } from "#channels/channel-filter.ts";
import { channelTitle } from "#channels/channel-name.ts";
import {
  categoryOf,
  channelCategories,
  channelFeatures,
  featuresOf,
} from "#channels/platform-features.ts";
import { ChannelRow } from "#components/channels/channel-row.tsx";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { DisplayMenu } from "#components/lists/display-menu.tsx";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { FilterProperty } from "#components/lists/filter-menu.tsx";

// The count the strip sets in bold.
const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;

type PropertyId = "feature" | "platform" | "type";

const propertyIcons: Readonly<Record<PropertyId, LucideIcon>> = {
  feature: SparklesIcon,
  platform: LayoutGridIcon,
  type: BlocksIcon,
};

// Each property's values in the filter, by the property's id.
const chosenOf = (filter: ChannelFilter) => ({
  feature: filter.features,
  platform: filter.platforms,
  type: filter.categories,
});

// Both kinds of WordPress site are one platform to a reader.
const everyPlatform = ChannelPlatformSchema.literals;

// The section of the docs' guide to channels each view's empty state
// links to.
const docsSections: Readonly<Record<ChannelView, string>> = {
  all: "connect",
  attention: "reconnect",
  off: "turn-off",
};

/**
 * The Channels page's toolbar (DESIGN.md, "Filters and display"): its
 * views (All, Needs reconnecting, Turned off) with how many each holds,
 * then Filter, whose Platform, Type and Feature each keep several,
 * offering the values the workspace's channels have (every one while it
 * has none), and Display, its ordering; under it a chip for each
 * property chosen, with Clear.
 */
export const ChannelsToolbarView = ({
  channels,
  counted,
  filter,
  onFilter,
}: {
  readonly channels: readonly Channel[];
  /** The platforms this server reads counts on. */
  readonly counted?: ReadonlySet<ChannelPlatform> | undefined;
  readonly filter: ChannelFilter;
  readonly onFilter: (filter: ChannelFilter) => void;
}) => {
  const t = useTranslations("ChannelsPage");
  const lists = useTranslations("Lists");
  const menu = useFilterMenu();

  const offered: readonly ChannelPlatform[] =
    channels.length === 0
      ? everyPlatform
      : [...new Set(channels.map(({ platform }) => platform))];

  const categories = new Set(offered.map(categoryOf));

  const features = new Set(
    offered.flatMap((platform) => featuresOf(platform, counted))
  );

  const platformName = (platform: ChannelPlatform) =>
    t("platform", { platform });

  const properties: readonly (FilterProperty & { readonly id: PropertyId })[] =
    [
      {
        icon: propertyIcons.platform,
        id: "platform",
        label: t("list.platformFilter"),
        multiple: true,
        values: offered
          .toSorted((one, other) =>
            platformName(one).localeCompare(platformName(other))
          )
          .map((platform) => ({
            id: platform,
            label: platformName(platform),
            mark: <PlatformMark platform={platform} />,
          })),
      },
      {
        icon: propertyIcons.type,
        id: "type",
        label: t("list.typeFilter"),
        multiple: true,
        values: channelCategories
          .filter((category) => categories.has(category))
          .map((category) => ({
            id: category,
            label: t("list.category", { category }),
          })),
      },
      {
        icon: propertyIcons.feature,
        id: "feature",
        label: t("list.featureFilter"),
        multiple: true,
        values: channelFeatures
          .filter((feature) => features.has(feature))
          .map((feature) => ({
            id: feature,
            label: t("list.feature", { feature }),
          })),
      },
    ];

  const chosen = chosenOf(filter);

  const choose = (property: string, values: readonly string[]) => {
    const next = {
      ...chosenOf(filter),
      [property]: values,
    };

    onFilter({
      ...filter,
      categories: channelCategories.filter((each) => next.type.includes(each)),
      features: channelFeatures.filter((each) => next.feature.includes(each)),
      platforms: everyPlatform.filter((each) => next.platform.includes(each)),
    });
  };

  const countIn = (view: (typeof channelViews)[number]) =>
    view === "all"
      ? channels.length
      : channels.filter((channel) => viewOfChannel(channel) === view).length;

  return (
    <div className="flex flex-col gap-2">
      <ListToolbar>
        <ListViews aria-label={t("list.views")}>
          {channelViews.map((view) => {
            const count = countIn(view);

            return (
              <button
                key={view}
                type="button"
                aria-pressed={filter.view === view}
                className={viewTabClass(filter.view === view)}
                onClick={() => {
                  onFilter({ ...filter, view });
                }}
              >
                {t("list.view", { view })}
                {view === "all" || count === 0 ? null : (
                  <span className="text-muted-foreground tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </ListViews>
        <ListToolbarEnd>
          <FilterMenu
            chosen={chosen}
            properties={properties}
            state={menu}
            onChoose={choose}
          />
          <DisplayMenu
            active={isReordered(filter)}
            ordering={{
              direction: filter.direction,
              field: filter.order,
              fields: channelOrders.map((order) => ({
                id: order,
                label: t("list.order", { order }),
              })),
              onChange: (field, direction) => {
                onFilter({
                  ...filter,
                  direction,
                  order:
                    channelOrders.find((order) => order === field) ??
                    filter.order,
                });
              },
            }}
          />
        </ListToolbarEnd>
      </ListToolbar>
      {isNarrowed(filter) ? (
        <FilterChips aria-label={lists("filters")}>
          {properties.flatMap((property) => {
            const values = chosen[property.id];

            if (values.length === 0) {
              return [];
            }

            const Icon = property.icon;

            const names = values.map(
              (id) =>
                property.values.find((value) => value.id === id)?.label ?? id
            );

            return [
              <FilterChip
                key={property.id}
                icon={<Icon aria-hidden />}
                join={values.length > 1 ? lists("isAnyOf") : lists("is")}
                property={property.label}
                removeLabel={lists("remove", { property: property.label })}
                value={names.join(", ")}
                onEdit={() => {
                  menu.openAt(property.id);
                }}
                onRemove={() => {
                  choose(property.id, []);
                }}
              />,
            ];
          })}
          <FilterChipsClear
            onClick={() => {
              onFilter(withoutFilters(filter));
            }}
          >
            {lists("clear")}
          </FilterChipsClear>
        </FilterChips>
      ) : null}
    </div>
  );
};

/**
 * The workspace's channels as the filter shows and orders them, under the
 * toolbar, in one bordered list (DESIGN.md, "Lists"); with none, the
 * empty state under the same toolbar: the view's own (what it is for, New
 * channel for a member who may connect, `newChannel`, and Documentation,
 * the guide's section about it), or, while the filters hide what the
 * view holds, how many with Clear.
 */
export const ChannelListView = ({
  canConnect,
  canDisconnect,
  channels,
  counted,
  docsHref = null,
  filter,
  newChannel,
  onFilter,
  workspaceId,
}: {
  readonly canConnect: boolean;
  readonly canDisconnect: boolean;
  readonly channels: readonly Channel[];
  readonly counted?: ReadonlySet<ChannelPlatform> | undefined;
  /** The docs' guide to channels, when the operator publishes the docs. */
  readonly docsHref?: string | null;
  readonly filter: ChannelFilter;
  /** The way to New channel, for a member who may connect. */
  readonly newChannel: ReactNode;
  readonly onFilter: (filter: ChannelFilter) => void;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const lists = useTranslations("Lists");
  const locale = useLocale();

  const shown = orderedChannels(
    channels.filter((channel) => channelMatches(channel, filter, counted)),
    filter,
    {
      locale,
      nameOf: channelTitle,
      platformNameOf: (platform) => t("platform", { platform }),
    }
  );

  const inView = channels.filter((channel) =>
    channelMatches(channel, withoutFilters(filter), counted)
  );

  const empty =
    isNarrowed(filter) && inView.length > 0 ? (
      // The filters hide what the view holds: how many, and Clear.
      <EmptyState>
        <EmptyStateIcon icon={<CableIcon />} />
        <EmptyStateTitle>{t("list.noMatchTitle")}</EmptyStateTitle>
        <EmptyStateHidden>
          <span>
            {t.rich("list.hiddenByFilters", {
              count: inView.length,
              strong,
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onFilter(withoutFilters(filter));
            }}
          >
            {lists("clear")}
          </Button>
        </EmptyStateHidden>
      </EmptyState>
    ) : (
      // The view holds nothing: what it is for, New channel and the docs'
      // section about it.
      <EmptyState>
        <EmptyStateIcon icon={<CableIcon />} />
        <EmptyStateTitle>
          {t("list.viewTitle", { view: filter.view })}
        </EmptyStateTitle>
        <EmptyStateDescription>
          {t("list.viewText", { view: filter.view })}
          {canConnect ? null : ` ${t("noPermission")}`}
        </EmptyStateDescription>
        {canConnect || docsHref !== null ? (
          <EmptyStateActions>
            {canConnect ? newChannel : null}
            {docsHref === null ? null : (
              <a
                href={`${docsHref}#${docsSections[filter.view]}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                {t("list.docs")}
              </a>
            )}
          </EmptyStateActions>
        ) : null}
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-3">
      <ChannelsToolbarView
        channels={channels}
        counted={counted}
        filter={filter}
        onFilter={onFilter}
      />
      {shown.length === 0 ? (
        empty
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {shown.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              workspaceId={workspaceId}
              canConnect={canConnect}
              canDisconnect={canDisconnect}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
