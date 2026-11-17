"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";

import { cn } from "../lib/utils";
import { MockChip } from "./feature-cell";
import type { MockChipContent } from "./feature-cell";
import { Mark } from "./site-icons";
import type { SiteMark } from "./site-icons";

/** One channel of the mock post: its tab, its count and its preview. */
interface ComposerMockChannel {
  /** The count against the platform's limit, such as `67 / 300`. */
  readonly count: string;
  /** Whether the text fits, as a chip beside the count. */
  readonly fit: MockChipContent;
  /** The account the preview shows, such as `@peal_example`. */
  readonly handle: string;
  readonly mark: SiteMark;
  readonly name: string;
  /** The channel's text, its own or the post's. */
  readonly text: string;
  readonly value: string;
}

interface ComposerMockProps {
  /** The action's label, drawn as the app's primary button, such as "Schedule". */
  readonly action: string;
  /** The preview's author, by name and two letters. */
  readonly author: { readonly initials: string; readonly name: string };
  readonly channels: readonly ComposerMockChannel[];
  /** The channel tabs' name, such as "Channels". */
  readonly channelsLabel: string;
  readonly className?: string | undefined;
  readonly previewLabel: string;
  readonly textLabel: string;
  /** When it goes out, in Geist Mono, such as `Tue 09:00 · Europe/Paris`. */
  readonly time: string;
  /** The address in the window's bar. */
  readonly url: string;
}

/**
 * The composer drawn from the app (DESIGN.md, Pages): one post with a tab
 * per channel, each platform's count against its limit, and a preview of
 * the post on the selected channel. The tabs are ui-sdk's and switch the
 * count and the preview; nothing else in it acts.
 */
const ComposerMock = ({
  action,
  author,
  channels,
  channelsLabel,
  className,
  previewLabel,
  textLabel,
  time,
  url,
}: ComposerMockProps) => (
  <div
    data-slot="composer-mock"
    className={cn("bg-card overflow-hidden rounded-md border", className)}
  >
    <div
      aria-hidden="true"
      className="flex items-center gap-3 border-b px-3 py-2"
    >
      <span className="flex gap-1">
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
        <span className="size-2 rounded-full border" />
      </span>
      <span className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded-sm px-2 py-0.5 font-mono text-[11px]">
        {url}
      </span>
    </div>
    <Tabs defaultValue={channels[0]?.value}>
      <div className="flex items-center gap-2 overflow-x-auto border-b px-2 py-2">
        <TabsList aria-label={channelsLabel} className="flex gap-1">
          {channels.map((channel) => (
            <TabsTab
              key={channel.value}
              value={channel.value}
              className="text-muted-foreground hover:text-foreground data-[selected]:bg-muted data-[selected]:text-foreground focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3"
            >
              <Mark mark={channel.mark} />
              {channel.name}
            </TabsTab>
          ))}
        </TabsList>
      </div>
      {channels.map((channel) => (
        <TabsPanel
          key={channel.value}
          value={channel.value}
          className="grid outline-none md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
        >
          <div className="flex min-w-0 flex-col border-b md:border-e md:border-b-0">
            <p className="text-muted-foreground px-4 pt-3 text-xs">
              {textLabel}
            </p>
            <p className="text-foreground min-h-28 flex-1 px-4 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
              {channel.text}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
              <span className="flex items-center gap-2">
                <span className="text-foreground font-mono text-xs tabular-nums">
                  {channel.count}
                </span>
                <MockChip state={channel.fit.state} text={channel.fit.text} />
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">
                  {time}
                </span>
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium"
                >
                  {action}
                </span>
              </span>
            </div>
          </div>
          <div className="bg-muted flex min-w-0 flex-col gap-3 p-4">
            <p className="text-muted-foreground font-mono text-xs tracking-[0.04em]">
              [ {previewLabel} ]
            </p>
            <div className="bg-card flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-brand-tint text-brand-text flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                >
                  {author.initials}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-[13px] font-medium">
                    {author.name}
                  </span>
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    {channel.handle}
                  </span>
                </span>
                <Mark
                  mark={channel.mark}
                  className="text-muted-foreground ms-auto"
                />
              </div>
              <p className="text-foreground text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                {channel.text}
              </p>
            </div>
          </div>
        </TabsPanel>
      ))}
    </Tabs>
  </div>
);

export { ComposerMock };

export type { ComposerMockChannel, ComposerMockProps };
