import { ChannelPlatformSchema } from "peal-contract";
import type { Channel, ChannelPlatform, ChannelStatus } from "peal-contract";

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

/**
 * The Channels page's views: every channel, those whose account must be
 * reconnected, and those turned off.
 */
export const channelViews = ["all", "attention", "off"] as const;

export type ChannelView = (typeof channelViews)[number];

/**
 * What the Channels page orders by: when each channel was connected (the
 * default, oldest first), its name, its platform's name, or its state
 * (those that need a hand first).
 */
export const channelOrders = ["added", "name", "platform", "status"] as const;

export type ChannelOrder = (typeof channelOrders)[number];

const directions = ["asc", "desc"] as const;

export type ChannelDirection = (typeof directions)[number];

/** What the Channels page shows, and in which order, as its address says. */
export interface ChannelFilter {
  readonly view: ChannelView;
  readonly platforms: readonly ChannelPlatform[];
  readonly categories: readonly ChannelCategory[];
  readonly features: readonly ChannelFeature[];
  readonly order: ChannelOrder;
  readonly direction: ChannelDirection;
}

export const noChannelFilter: ChannelFilter = {
  categories: [],
  direction: "asc",
  features: [],
  order: "added",
  platforms: [],
  view: "all",
};

/** The filter with its properties taken off, its view and order kept. */
export const withoutFilters = (filter: ChannelFilter): ChannelFilter => ({
  ...filter,
  categories: [],
  features: [],
  platforms: [],
});

/** Whether the list is ordered other than by default. */
export const isReordered = (filter: ChannelFilter): boolean =>
  filter.order !== noChannelFilter.order ||
  filter.direction !== noChannelFilter.direction;

interface Params {
  readonly get: (name: string) => string | null;
}

// The values of a comma-separated parameter that are among `known`, once
// each, in `known`'s order.
const listOf = <A extends string>(
  value: string | null,
  known: readonly A[]
): readonly A[] => {
  const given = new Set((value ?? "").split(","));

  return known.filter((each) => given.has(each));
};

/** The filter an address asks for; what it does not know is left out. */
export const channelFilterOf = (params: Params): ChannelFilter => ({
  categories: listOf(params.get("type"), channelCategories),
  direction:
    directions.find((direction) => direction === params.get("direction")) ??
    noChannelFilter.direction,
  features: listOf(params.get("feature"), channelFeatures),
  order:
    channelOrders.find((order) => order === params.get("order")) ??
    noChannelFilter.order,
  platforms: listOf(params.get("platform"), ChannelPlatformSchema.literals),
  view: channelViews.find((view) => view === params.get("view")) ?? "all",
});

/** The query string of a filter, its defaults left out. */
export const channelQueryOf = (filter: ChannelFilter): string => {
  const query = new URLSearchParams();

  if (filter.view !== "all") {
    query.set("view", filter.view);
  }

  for (const [name, values] of [
    ["platform", filter.platforms],
    ["type", filter.categories],
    ["feature", filter.features],
  ] as const) {
    if (values.length > 0) {
      query.set(name, values.join(","));
    }
  }

  if (filter.order !== noChannelFilter.order) {
    query.set("order", filter.order);
  }

  if (filter.direction !== noChannelFilter.direction) {
    query.set("direction", filter.direction);
  }

  // Commas read better than %2C in an address, and mean the same here.
  return query.toString().replaceAll("%2C", ",");
};

/** Whether the filter narrows the list beyond its view. */
export const isNarrowed = (filter: ChannelFilter): boolean =>
  filter.platforms.length > 0 ||
  filter.categories.length > 0 ||
  filter.features.length > 0;

const viewOfStatus = {
  active: null,
  disabled: "off",
  refreshNeeded: "attention",
} as const satisfies Record<
  ChannelStatus["_tag"],
  Exclude<ChannelView, "all"> | null
>;

/** The view a channel belongs to, besides All. */
export const viewOfChannel = (channel: Channel): "attention" | "off" | null =>
  viewOfStatus[channel.status._tag];

/**
 * Whether a channel is shown: in the view, and, for each property chosen,
 * with one of its values ("Feature is any of Analytics, Ads").
 */
export const channelMatches = (
  channel: Channel,
  filter: ChannelFilter,
  counted?: ReadonlySet<ChannelPlatform>
): boolean => {
  const features = featuresOf(channel.platform, counted);

  return (
    (filter.view === "all" || viewOfChannel(channel) === filter.view) &&
    (filter.platforms.length === 0 ||
      filter.platforms.includes(channel.platform)) &&
    (filter.categories.length === 0 ||
      filter.categories.includes(categoryOf(channel.platform))) &&
    (filter.features.length === 0 ||
      filter.features.some((feature) => features.includes(feature)))
  );
};

// Those that need a hand first: to reconnect, then turned off.
const statusRank = {
  active: 2,
  disabled: 1,
  refreshNeeded: 0,
} as const satisfies Record<ChannelStatus["_tag"], number>;

// Oldest first: a channel's id grows with the time it was connected.
const byAdded = (one: Channel, other: Channel) => {
  if (one.id === other.id) {
    return 0;
  }

  return one.id < other.id ? -1 : 1;
};

/**
 * The channels in the filter's order: by when each was connected, its
 * name or its platform's name as the reader's language sorts them
 * (`nameOf`, `platformNameOf`), or its state; ties keep the order they
 * were connected in. Descending turns the whole list.
 */
export const orderedChannels = (
  channels: readonly Channel[],
  filter: Pick<ChannelFilter, "direction" | "order">,
  words: {
    readonly locale: string;
    readonly nameOf: (channel: Channel) => string;
    readonly platformNameOf: (platform: ChannelPlatform) => string;
  }
): readonly Channel[] => {
  const collator = new Intl.Collator(words.locale, { sensitivity: "base" });

  const by: Readonly<
    Record<ChannelOrder, (one: Channel, other: Channel) => number>
  > = {
    added: byAdded,
    name: (one, other) =>
      collator.compare(words.nameOf(one), words.nameOf(other)),
    platform: (one, other) =>
      collator.compare(
        words.platformNameOf(one.platform),
        words.platformNameOf(other.platform)
      ),
    status: (one, other) =>
      statusRank[one.status._tag] - statusRank[other.status._tag],
  };

  const sorted = channels.toSorted(
    (one, other) => by[filter.order](one, other) || byAdded(one, other)
  );

  return filter.direction === "asc" ? sorted : sorted.toReversed();
};
