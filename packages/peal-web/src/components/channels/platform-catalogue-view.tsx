"use client";

import { LayoutGridIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChannelPlatform } from "peal-contract";
import { Badge } from "peal-ui/components/badge";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Input } from "peal-ui/components/input";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
  ListViews,
  viewTabClass,
} from "peal-ui/components/list-toolbar";
import { useId } from "react";

import {
  categoryOf,
  channelCategories,
  channelFeatures,
  featuresOf,
} from "#channels/platform-features.ts";
import type {
  ChannelCategory,
  ChannelFeature,
} from "#channels/platform-features.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";

/** What the catalogue shows: a type, features, and the text searched. */
export interface CatalogueFilter {
  readonly category: ChannelCategory | null;
  readonly features: readonly ChannelFeature[];
  readonly query: string;
}

/**
 * Whether a platform is shown: of the type chosen, with one of the
 * features chosen, and its name, its type or one of its features holding
 * what is typed, whatever the case.
 */
export const platformShown = (
  platform: ChannelPlatform,
  filter: CatalogueFilter,
  words: {
    readonly name: string;
    readonly category: string;
    readonly features: readonly string[];
  },
  counted?: ReadonlySet<ChannelPlatform>
): boolean => {
  const features = featuresOf(platform, counted);
  const needle = filter.query.trim().toLocaleLowerCase();

  return (
    (filter.category === null || categoryOf(platform) === filter.category) &&
    (filter.features.length === 0 ||
      filter.features.some((feature) => features.includes(feature))) &&
    (needle === "" ||
      [platform, words.name, words.category, ...words.features].some((word) =>
        word.toLocaleLowerCase().includes(needle)
      ))
  );
};

/**
 * The platforms a member may connect (DESIGN.md, "Lists: filters and
 * display"): a search, the types as views (All, Social network, Chat,
 * Website), Filter by feature with its chip, then a grid of tiles, each
 * the platform's mark, its name, its type, how many of the workspace's
 * channels it holds, and what Peal does there. A tile is the way to the
 * platform's form (`link` and `hrefOf`, so a test renders it without
 * Next).
 */
export const PlatformCatalogueView = ({
  connected,
  counted,
  filter,
  hrefOf,
  link: LinkTo,
  onFilter,
  platforms,
}: {
  /** How many of the workspace's channels each platform holds. */
  readonly connected: ReadonlyMap<ChannelPlatform, number>;
  readonly counted?: ReadonlySet<ChannelPlatform> | undefined;
  readonly filter: CatalogueFilter;
  /** Where a platform's form is. */
  readonly hrefOf: (platform: ChannelPlatform) => string;
  readonly link: LinkComponent;
  readonly onFilter: (filter: CatalogueFilter) => void;
  readonly platforms: readonly ChannelPlatform[];
}) => {
  const t = useTranslations("ChannelsPage");
  const lists = useTranslations("Lists");
  const menu = useFilterMenu();
  const searchId = useId();
  const offered = new Set(platforms.map(categoryOf));

  const featureName = (feature: ChannelFeature) =>
    t("list.feature", { feature });

  const wordsOf = (platform: ChannelPlatform) => ({
    category: t("list.category", { category: categoryOf(platform) }),
    features: featuresOf(platform, counted).map(featureName),
    name: t("platform", { platform }),
  });

  const shown = platforms.filter((platform) =>
    platformShown(platform, filter, wordsOf(platform), counted)
  );

  const featureProperty = {
    icon: SparklesIcon,
    id: "feature",
    label: t("list.featureFilter"),
    multiple: true,
    values: channelFeatures
      .filter((feature) =>
        platforms.some((platform) =>
          featuresOf(platform, counted).includes(feature)
        )
      )
      .map((feature) => ({ id: feature, label: featureName(feature) })),
  };

  const views: readonly (ChannelCategory | null)[] = [
    null,
    ...channelCategories.filter((category) => offered.has(category)),
  ];

  return (
    <div className="flex flex-col gap-4">
      <search className="flex flex-col gap-2">
        <ListToolbar>
          <ListViews aria-label={t("catalogue.types")}>
            {views.map((category) => (
              <button
                key={category ?? "all"}
                type="button"
                aria-pressed={filter.category === category}
                className={viewTabClass(filter.category === category)}
                onClick={() => {
                  onFilter({ ...filter, category });
                }}
              >
                {category === null
                  ? t("catalogue.allTypes")
                  : t("list.category", { category })}
              </button>
            ))}
          </ListViews>
          <ListToolbarEnd>
            <div className="flex w-56 items-center gap-2">
              <SearchIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
              <label htmlFor={searchId} className="sr-only">
                {t("catalogue.search")}
              </label>
              <Input
                id={searchId}
                type="search"
                value={filter.query}
                placeholder={t("catalogue.searchPlaceholder")}
                onChange={(event) => {
                  onFilter({ ...filter, query: event.target.value });
                }}
              />
            </div>
            <FilterMenu
              chosen={{ feature: filter.features }}
              properties={[featureProperty]}
              state={menu}
              onChoose={(_, values) => {
                onFilter({
                  ...filter,
                  features: channelFeatures.filter((feature) =>
                    values.includes(feature)
                  ),
                });
              }}
            />
          </ListToolbarEnd>
        </ListToolbar>
        {filter.features.length === 0 ? null : (
          <FilterChips aria-label={lists("filters")}>
            <FilterChip
              icon={<SparklesIcon aria-hidden />}
              join={filter.features.length > 1 ? lists("isAnyOf") : lists("is")}
              property={t("list.featureFilter")}
              removeLabel={lists("remove", {
                property: t("list.featureFilter"),
              })}
              value={filter.features.map(featureName).join(", ")}
              onEdit={() => {
                menu.openAt("feature");
              }}
              onRemove={() => {
                onFilter({ ...filter, features: [] });
              }}
            />
            <FilterChipsClear
              onClick={() => {
                onFilter({ ...filter, features: [] });
              }}
            >
              {lists("clear")}
            </FilterChipsClear>
          </FilterChips>
        )}
      </search>
      {shown.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={<LayoutGridIcon />} />
          <EmptyStateTitle>{t("catalogue.noMatchTitle")}</EmptyStateTitle>
          <EmptyStateDescription>
            {t("catalogue.noMatchHint")}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((platform) => {
            const words = wordsOf(platform);
            const count = connected.get(platform) ?? 0;

            return (
              <li key={platform}>
                <LinkTo
                  href={hrefOf(platform)}
                  className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-3"
                >
                  <span className="flex items-center gap-3">
                    <PlatformMark platform={platform} size="lg" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {words.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {words.category}
                        {count === 0
                          ? null
                          : ` · ${t("catalogue.connected", { count })}`}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {words.features.map((feature) => (
                      <Badge key={feature} variant="outline">
                        {feature}
                      </Badge>
                    ))}
                  </span>
                </LinkTo>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
