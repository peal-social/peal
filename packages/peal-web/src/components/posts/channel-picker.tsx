"use client";

import {
  BookmarkPlusIcon,
  CableIcon,
  LayersIcon,
  PlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChannelSet, SocialChannel } from "peal-contract";
import { buttonVariants } from "peal-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemCheck,
  CommandItemEnd,
  CommandItemHint,
  CommandItemIcon,
  CommandItemText,
  CommandList,
  CommandSeparator,
} from "peal-ui/components/command";
import { FilterMenuContent } from "peal-ui/components/list-toolbar";
import { Popover, PopoverTrigger } from "peal-ui/components/popover";
import {
  Property,
  PropertyLabel,
  PropertyValue,
} from "peal-ui/components/property";
import { useId, useState } from "react";

import { connectedChannels } from "#channel-sets/selection.ts";
import { channelTitle } from "#channels/channel-name.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import {
  ChannelAvatar,
  ChannelAvatarStack,
} from "#components/posts/channel-avatar.tsx";
import { Link } from "#i18n/navigation.ts";
import {
  answersSearch,
  groupChoiceOf,
  platformGroupsOf,
  withGroup,
} from "#posts/channel-groups.ts";
import { everyChannel } from "#posts/channel-selection.ts";

/** What the menu matches a search against: an item's name and keywords. */
interface Searched {
  readonly keywords?: readonly string[] | undefined;
  readonly label: string;
}

// Every word typed is in the item's name or its keywords, in any case:
// "insta bakery" finds the bakery's Instagram.
const matches = ({ keywords = [], label }: Searched, query: string) => {
  const names = [label, ...keywords].join(" ").toLocaleLowerCase();

  return query
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== "")
    .every((word) => names.includes(word));
};

// A channel's handle beside its name, unless the name is the handle.
const hintOf = (handle: string, title: string): string | null =>
  handle === title ? null : handle;

const checkOf = (choice: "all" | "none" | "some"): boolean | "mixed" => {
  if (choice === "some") {
    return "mixed";
  }

  return choice === "all";
};

interface ChannelChoicesProps {
  readonly channels: readonly SocialChannel[];
  readonly onApplySet: (set: ChannelSet) => void;
  readonly onChange: (channelIds: readonly string[]) => void;
  /** Saves the channels chosen as a set; none for who may not. */
  readonly onSaveSet?: (() => void) | undefined;
  readonly selected: readonly string[];
  /** The workspace's channel sets, to start from one. */
  readonly sets: readonly ChannelSet[];
}

/**
 * The menu that picks where the post goes, open while ticking: a
 * search, then "All channels", the channel sets, and the channels under
 * their platform, each platform's line ticking all of its channels that
 * publish (those the search shows, while searching). It stays open while
 * channels are ticked; the selection keeps the list's order.
 */
export const ChannelChoices = ({
  channels,
  onApplySet,
  onChange,
  onSaveSet,
  selected,
  sets,
}: ChannelChoicesProps) => {
  const t = useTranslations("Posts");
  const tSets = useTranslations("ChannelSets");
  const [query, setQuery] = useState("");
  const all = everyChannel(channels, selected);
  const allChosen = all.length > 0 && all.every((id) => selected.includes(id));

  const toggle = (channelId: string) => {
    onChange(
      channels
        .map(({ id }) => id)
        .filter((id) =>
          id === channelId ? !selected.includes(id) : selected.includes(id)
        )
    );
  };

  let everyCheck: boolean | "mixed" = false;

  if (allChosen) {
    everyCheck = true;
  } else if (selected.length > 0) {
    everyCheck = "mixed";
  }

  return (
    <Command
      loop
      query={query}
      onQueryChange={setQuery}
      filter={(item, typed) => matches(item, typed)}
    >
      <CommandInput
        aria-label={t("Composer.searchChannels")}
        placeholder={t("Composer.pickChannels")}
      />
      <CommandEmpty>
        {(found) => t("Composer.noChannelFound", { query: found.query })}
      </CommandEmpty>
      <CommandList>
        <CommandGroup aria-label={t("Composer.everyChannel")}>
          <CommandItem
            value="every"
            label={t("Composer.everyChannel")}
            onSelect={() => {
              onChange(allChosen ? [] : all);
            }}
          >
            <CommandItemCheck checked={everyCheck} />
            <CommandItemText>{t("Composer.everyChannel")}</CommandItemText>
            <CommandItemEnd>
              <span className="tabular-nums">
                {t("Composer.groupChosen", {
                  chosen: selected.length,
                  total: channels.length,
                })}
              </span>
            </CommandItemEnd>
          </CommandItem>
        </CommandGroup>
        {sets.length === 0 ? null : (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandGroupLabel>{tSets("pickerTrigger")}</CommandGroupLabel>
              {sets.map((set) => (
                <CommandItem
                  key={set.id}
                  value={`set:${set.id}`}
                  label={set.name}
                  onSelect={() => {
                    onApplySet(set);
                  }}
                >
                  <CommandItemIcon>
                    <LayersIcon />
                  </CommandItemIcon>
                  <CommandItemText>{set.name}</CommandItemText>
                  <CommandItemEnd>
                    <span className="tabular-nums">
                      {connectedChannels(set, channels).length}
                    </span>
                  </CommandItemEnd>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {platformGroupsOf(channels).map((group) => {
          const platformName = t("platform", { platform: group.platform });

          // The platform's line acts on its channels the search shows.
          const shown = group.channels.filter((channel) =>
            answersSearch(channel, platformName, query)
          );

          return (
            <CommandGroup key={group.platform} aria-label={platformName}>
              <CommandSeparator />
              <CommandItem
                value={`platform:${group.platform}`}
                label={platformName}
                onSelect={() => {
                  onChange(
                    withGroup(
                      channels,
                      selected,
                      shown,
                      groupChoiceOf(shown, selected) !== "all"
                    )
                  );
                }}
              >
                <CommandItemCheck
                  checked={checkOf(groupChoiceOf(shown, selected))}
                />
                <CommandItemIcon>
                  <PlatformMark platform={group.platform} />
                </CommandItemIcon>
                <CommandItemText>{platformName}</CommandItemText>
                <CommandItemEnd>
                  <span className="tabular-nums">
                    {t("Composer.groupChosen", {
                      chosen: group.channels.filter(({ id }) =>
                        selected.includes(id)
                      ).length,
                      total: group.channels.length,
                    })}
                  </span>
                </CommandItemEnd>
              </CommandItem>
              {group.channels.map((channel) => {
                const title = channelTitle(channel);

                // Beside the name: why it does not post, else its handle
                // where the name is not it.
                const hint =
                  channel.status._tag === "active"
                    ? hintOf(channel.handle, title)
                    : t(
                        channel.status._tag === "disabled"
                          ? "Composer.channelDisabled"
                          : "Composer.channelNeedsReconnect"
                      );

                return (
                  <CommandItem
                    key={channel.id}
                    value={`channel:${channel.id}`}
                    label={title}
                    keywords={[
                      channel.handle,
                      platformName,
                      channel.label ?? "",
                      channel.displayName ?? "",
                    ]}
                    onSelect={() => {
                      toggle(channel.id);
                    }}
                  >
                    <CommandItemCheck checked={selected.includes(channel.id)} />
                    <ChannelAvatar channel={channel} />
                    {/* The name keeps its room; the handle takes what is
                        left. */}
                    <CommandItemText className="max-w-[70%] shrink-0">
                      {title}
                    </CommandItemText>
                    {hint === null ? null : (
                      <CommandItemHint>{hint}</CommandItemHint>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
        {onSaveSet === undefined ? null : (
          <CommandGroup aria-label={tSets("saveSelection")}>
            <CommandSeparator />
            <CommandItem
              value="save-set"
              label={tSets("saveSelection")}
              disabled={selected.length === 0}
              onSelect={onSaveSet}
            >
              <CommandItemIcon>
                <BookmarkPlusIcon />
              </CommandItemIcon>
              <CommandItemText>{tSets("saveSelection")}</CommandItemText>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
};

interface ChannelsPropertyProps extends ChannelChoicesProps {
  /** New channel's page, for a member who may connect one. */
  readonly connectHref: string | null;
  readonly disabled: boolean;
}

/**
 * Where the post goes, as a property of the composer's column: the
 * channels chosen (their pictures and how many), which opens the menu
 * that picks them. A workspace without a channel leads to New channel.
 */
export const ChannelsProperty = ({
  connectHref,
  disabled,
  onSaveSet,
  ...choices
}: ChannelsPropertyProps) => {
  const t = useTranslations("Posts.Composer");
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const { channels, selected } = choices;

  const chosen = selected.flatMap((id) =>
    channels.filter((channel) => channel.id === id)
  );

  const [first] = chosen;

  if (channels.length === 0) {
    return (
      <Property aria-labelledby={labelId}>
        <PropertyLabel id={labelId}>{t("channelsLegend")}</PropertyLabel>
        <p className="text-muted-foreground px-2 py-1 text-sm">
          {t("channelsEmpty")}
        </p>
        {connectHref === null ? null : (
          <Link
            href={connectHref}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            <PlusIcon aria-hidden />
            {t("connectChannel")}
          </Link>
        )}
      </Property>
    );
  }

  return (
    <Property aria-labelledby={labelId}>
      <PropertyLabel id={labelId}>{t("channelsLegend")}</PropertyLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <PropertyValue
              aria-labelledby={`${labelId} ${labelId}-value`}
              {...(first === undefined ? { "data-empty": "" } : {})}
            />
          }
        >
          {first === undefined ? (
            <>
              <CableIcon aria-hidden />
              <span id={`${labelId}-value`}>{t("addChannels")}</span>
            </>
          ) : (
            <>
              <ChannelAvatarStack channels={chosen} />
              <span id={`${labelId}-value`} className="min-w-0 truncate">
                {chosen.length === 1
                  ? channelTitle(first)
                  : t("channelsCount", { count: chosen.length })}
              </span>
            </>
          )}
        </PopoverTrigger>
        <FilterMenuContent align="end" className="w-80">
          <ChannelChoices
            {...choices}
            onSaveSet={
              onSaveSet === undefined
                ? undefined
                : () => {
                    setOpen(false);
                    onSaveSet();
                  }
            }
          />
        </FilterMenuContent>
      </Popover>
    </Property>
  );
};
