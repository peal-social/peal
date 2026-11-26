"use client";

import { ChevronRightIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { SocialChannel } from "peal-contract";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { channelName, channelTitle } from "#channels/channel-name.ts";
import { ChannelAvatar } from "#components/posts/channel-avatar.tsx";
import { useFitProblems } from "#components/posts/channel-fit-badges.tsx";
import { FitSummary } from "#components/posts/character-counters.tsx";
import { platformGroupsOf } from "#posts/channel-groups.ts";
import type { ChannelFit } from "#posts/character-count.ts";
import type { MediaFit } from "#posts/media-fit.ts";
import type { OptionsText } from "#posts/target-options.ts";

/** What the composer knows of one channel the post goes to. */
export interface ChannelEntry {
  /** Something there keeps the post from being saved or scheduled. */
  readonly attention: boolean;
  readonly channel: SocialChannel;
  readonly fit: ChannelFit;
  /** How the images and videos it shows fit. */
  readonly media: MediaFit;
  /** Its platform's fields scheduling needs that are still empty. */
  readonly missing: readonly OptionsText[];
  /** How many of its platform's options hold a choice of the member's. */
  readonly optionsChosen: number;
  /** It shows images and videos of its own instead of the post's. */
  readonly ownMedia: boolean;
  /** It has a text of its own instead of the post's. */
  readonly ownText: boolean;
}

/** How a row's line reads: as something to fix, or quietly. */
type Tone = "destructive" | "muted";

// The one line a row says beside the channel's name: what its platform
// would refuse, else what it still needs, else what it has of its own,
// else nothing.
const useLineOf = () => {
  const t = useTranslations("Posts.Composer");
  const tOptions = useTranslations("Posts.Options");
  const { list } = useFormatter();

  return (
    entry: ChannelEntry,
    problems: readonly string[]
  ): { readonly text: string; readonly tone: Tone } | null => {
    if (problems.length > 0) {
      return { text: problems.join(" · "), tone: "destructive" };
    }

    if (entry.attention) {
      return { text: t("needsAttention"), tone: "destructive" };
    }

    if (entry.missing.length > 0) {
      return {
        text: t("needsFields", {
          fields: list(
            entry.missing.map((label) => tOptions(label)),
            { type: "conjunction" }
          ),
        }),
        tone: "muted",
      };
    }

    const own = [
      ...(entry.ownText ? [t("ownTextShort")] : []),
      ...(entry.ownMedia ? [t("ownMediaShort")] : []),
      ...(entry.optionsChosen > 0
        ? [t("optionsChosen", { count: entry.optionsChosen })]
        : []),
    ];

    return own.length === 0 ? null : { text: own.join(" · "), tone: "muted" };
  };
};

const toneClass: Readonly<Record<Tone, string>> = {
  destructive: "text-destructive-text",
  muted: "text-muted-foreground",
};

const ChannelItem = ({
  body,
  entry,
  onToggle,
  open,
  unwritten,
  visited,
}: {
  readonly body: ReactNode;
  readonly entry: ChannelEntry;
  readonly onToggle: () => void;
  readonly open: boolean;
  /** Nothing is written yet, anywhere: no channel says it has nothing. */
  readonly unwritten: boolean;
  /**
   * The row was open once: its fields stay on the page, hidden, so what
   * they hold (an upload on its way) outlives closing it.
   */
  readonly visited: boolean;
}) => {
  const t = useTranslations("Posts.Composer");
  const problemsOf = useFitProblems();
  const lineOf = useLineOf();
  const id = useId();
  const { channel, fit } = entry;
  const problems = problemsOf(fit, entry.media, unwritten);
  const line = lineOf(entry, problems);
  const title = channelTitle(channel);
  const { tightest } = fit;

  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="group/channel hover:bg-accent/60 focus-visible:ring-ring/50 aria-expanded:bg-accent/40 flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset"
        onClick={onToggle}
      >
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-aria-expanded/channel:rotate-90 motion-reduce:transition-none"
        />
        <ChannelAvatar channel={channel} marked />
        <span className="flex max-w-[45%] min-w-0 shrink-0 basis-auto items-baseline gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {channel.handle === title ? null : (
            <span className="text-muted-foreground truncate text-xs max-sm:hidden">
              {channel.handle}
            </span>
          )}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-end text-xs ${line === null ? "" : toneClass[line.tone]}`}
        >
          {line?.text}
        </span>
        {tightest === undefined || fit.textNotSent === true ? null : (
          <span
            className={`shrink-0 text-xs tabular-nums ${tightest.remaining < 0 ? "text-destructive-text" : "text-muted-foreground"}`}
          >
            {t("countShort", {
              length: tightest.length,
              maximum: tightest.maximum,
              unit: tightest.unit,
            })}
          </span>
        )}
      </button>
      <section
        id={`${id}-panel`}
        aria-label={channelName(channel)}
        hidden={!open}
        className="flex flex-col gap-3 border-t px-4 py-4 sm:ps-12"
      >
        {/* In full, as the line may cut them short. */}
        {problems.length === 0 ? null : (
          <ul className="text-destructive-text flex flex-col gap-1 text-xs">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {visited ? body : null}
      </section>
    </li>
  );
};

// A TikTok channel's row is open until the member closes it.
const startsOpen = ({ channel }: ChannelEntry): boolean =>
  channel.platform === "tiktok";

/**
 * The channels the post goes to, as an item lists the items under it:
 * one line each, ordered by platform, the platform's mark on the
 * channel's picture, then what keeps the post back there (or what the
 * channel still needs, or has of its own) and its counter. A row opens
 * in place to the channel's own text, media and options (`bodyOf`), as
 * a property list. A row opens by itself when its channel joins `opens`
 * (a request refused its options, or an option filled in is one the API
 * would refuse), and stays open until the member closes it. A TikTok
 * channel's row starts open: TikTok asks that the creator's name and the
 * consent line show before the post goes (`TikTokChannelOptions`).
 */
export const ChannelCustomizations = ({
  bodyOf,
  entries,
  opens,
  unwritten,
}: {
  readonly bodyOf: (channel: SocialChannel) => ReactNode;
  readonly entries: readonly ChannelEntry[];
  /** The channels whose options need fixing, in any order. */
  readonly opens: readonly string[];
  /**
   * The post holds no text and no image or video yet: the rows leave out
   * that there is nothing to publish, which every channel would say.
   */
  readonly unwritten: boolean;
}) => {
  const tFormats = useTranslations("Posts.Formats");

  // Whether each row the member opened or closed, or that opened by
  // itself, is open now; the others are as they start (`startsOpen`).
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});

  // The channels that needed fixing at the last render: only one that
  // joins them opens, so a row the member closed stays closed.
  const [needing, setNeeding] = useState<readonly string[]>([]);
  const joined = opens.filter((id) => !needing.includes(id));

  if (joined.length > 0 || needing.some((id) => !opens.includes(id))) {
    setNeeding(opens);
    setToggled((current) => ({
      ...current,
      ...Object.fromEntries(joined.map((id) => [id, true])),
    }));
  }

  // A channel taken off the post forgets its row: chosen again, it starts
  // as a new one does (a TikTok row open).
  const chosen = new Set(entries.map(({ channel }) => channel.id));

  if (Object.keys(toggled).some((id) => !chosen.has(id))) {
    setToggled((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => chosen.has(id))
      )
    );
  }

  const ordered = platformGroupsOf(
    entries.map((entry) => ({ ...entry, platform: entry.channel.platform }))
  ).flatMap(({ channels }) => channels);

  return (
    <div className="flex flex-col gap-2">
      <FitSummary fits={entries} />
      <ul className="divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
        {ordered.map((entry) => {
          const { id } = entry.channel;
          const open = toggled[id] ?? startsOpen(entry);

          return (
            <ChannelItem
              key={id}
              body={bodyOf(entry.channel)}
              entry={entry}
              open={open}
              unwritten={unwritten}
              visited={id in toggled || startsOpen(entry)}
              onToggle={() => {
                setToggled((current) => ({ ...current, [id]: !open }));
              }}
            />
          );
        })}
      </ul>
      {entries.some(({ fit }) => fit.textNotSent === true) ? (
        <p className="text-muted-foreground text-xs">
          {tFormats("textNotSent")}
        </p>
      ) : null}
    </div>
  );
};
