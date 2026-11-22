"use client";

import { DateTime } from "effect";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDaysIcon,
  MaximizeIcon,
  MessageSquareReplyIcon,
  MinusIcon,
  SquarePenIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AgentChat } from "peal-contract/agent";
import { Button } from "peal-ui/components/button";
import { EmptyStateTitle } from "peal-ui/components/empty-state";
import type { ReactNode } from "react";

import { ageOf } from "#agent/history.ts";
import { PealMark } from "#components/shell/peal-mark.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";

type Translate = ReturnType<typeof useTranslations<"Agent">>;

/** The examples the agent page and an empty panel offer, in order. */
export const agentExamples = ["plan", "draft", "comments"] as const;

export type AgentExample = (typeof agentExamples)[number];

const exampleIcons: Readonly<Record<AgentExample, LucideIcon>> = {
  comments: MessageSquareReplyIcon,
  draft: SquarePenIcon,
  plan: CalendarDaysIcon,
};

/** A chat's name: its title, or "New chat" until the agent names it. */
export const chatTitle = (t: Translate, title: string | null): string =>
  title ?? t("newChat");

/** How long ago a chat moved: "just now", "2h ago". */
export const AgeText = ({
  at,
  now,
}: {
  readonly at: DateTime.Utc;
  readonly now: DateTime.Utc;
}) => {
  const t = useTranslations("Agent");
  const locale = useLocale();
  const age = ageOf(at, now);

  return (
    <time
      dateTime={DateTime.formatIso(at)}
      className="text-muted-foreground shrink-0 text-xs tabular-nums"
    >
      {age.unit === "now"
        ? t("justNow")
        : new Intl.RelativeTimeFormat(locale, {
            numeric: "auto",
            style: "narrow",
          }).format(age.value, age.unit)}
    </time>
  );
};

/** One chat of a list: its name, a star when favoured, and its age. */
export const ChatRowContent = ({
  chat,
  now,
}: {
  readonly chat: AgentChat;
  readonly now: DateTime.Utc | null;
}) => {
  const t = useTranslations("Agent");

  return (
    <>
      <span className="min-w-0 flex-1 truncate text-sm">
        {chatTitle(t, chat.title)}
      </span>
      {chat.starred ? (
        <StarIcon
          aria-label={t("menu.starred")}
          className="text-muted-foreground size-3.5 shrink-0 fill-current"
        />
      ) : null}
      {now === null ? null : <AgeText at={chat.updatedAt} now={now} />}
    </>
  );
};

/**
 * The examples under the agent page's composer, each sending its prompt
 * at once: an icon, a title and one muted line, three up.
 */
export const ExampleCardsView = ({
  disabled,
  onDismiss,
  onPick,
}: {
  readonly disabled: boolean;
  readonly onDismiss: () => void;
  readonly onPick: (prompt: string) => void;
}) => {
  const t = useTranslations("Agent");

  return (
    <section aria-labelledby="agent-examples" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="agent-examples"
          className="text-muted-foreground text-sm font-medium"
        >
          {t("examples.title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("examples.dismiss")}
          onClick={onDismiss}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {agentExamples.map((example) => {
          const Icon = exampleIcons[example];

          return (
            <li key={example} className="flex">
              <button
                type="button"
                disabled={disabled}
                className="bg-card hover:bg-muted focus-visible:ring-ring/50 flex flex-1 flex-col gap-2 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => {
                  onPick(t(`examples.${example}.prompt`));
                }}
              >
                <Icon aria-hidden className="text-muted-foreground size-4" />
                <span className="text-sm font-medium">
                  {t(`examples.${example}.title`)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t(`examples.${example}.line`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * The agent's page with no chat open: the mark as a faint watermark in
 * the upper half, the composer in the centre, the examples, then the
 * person's latest chats.
 */
export const AgentHomeView = ({
  composer,
  examples,
  notice,
  recent,
}: {
  readonly composer: ReactNode;
  /** The example cards, or null once dismissed. */
  readonly examples: ReactNode;
  /** Why the agent is off, or what stopped the last message. */
  readonly notice: ReactNode;
  /** The latest chats, or null while there are none. */
  readonly recent: ReactNode;
}) => {
  const t = useTranslations("Agent");

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 pt-24 pb-12 md:pt-40">
      <PealMark className="pointer-events-none absolute top-0 left-1/2 size-72 -translate-x-1/2 opacity-10 md:size-96" />
      <div className="relative flex flex-col gap-3">
        <h2 className="sr-only">{t("composerLabel")}</h2>
        {composer}
        {notice}
      </div>
      {examples}
      {recent}
    </div>
  );
};

/** The person's latest chats, in a bordered list, each opening its chat. */
export const RecentChatsView = ({
  chats,
  hrefOf,
  link: LinkTo,
  now,
}: {
  readonly chats: readonly AgentChat[];
  readonly hrefOf: (chatId: string) => string;
  readonly link: LinkComponent;
  readonly now: DateTime.Utc | null;
}) => {
  const t = useTranslations("Agent");

  return chats.length === 0 ? null : (
    <section aria-labelledby="agent-recent" className="flex flex-col gap-3">
      <h2
        id="agent-recent"
        className="text-muted-foreground text-sm font-medium"
      >
        {t("recent")}
      </h2>
      <ul className="bg-card divide-y overflow-hidden rounded-xl border">
        {chats.map((chat) => (
          <li key={chat.id}>
            <LinkTo href={hrefOf(chat.id)} className={chatRowClass}>
              <ChatRowContent chat={chat} now={now} />
            </LinkTo>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** A row of a list of chats, as a link or a button gives it. */
export const chatRowClass =
  "hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors";

/**
 * The floating panel (DESIGN.md, "The agent"): a white card at the
 * window's bottom right, above the bottom bar, its header naming the chat
 * with its menu, then minimize, open as a page and close.
 */
export const PanelView = ({
  children,
  menu,
  onClose,
  onFullPage,
  onMinimize,
  title,
}: {
  readonly children: ReactNode;
  readonly menu: ReactNode;
  readonly onClose: () => void;
  readonly onFullPage: () => void;
  readonly onMinimize: () => void;
  readonly title: string;
}) => {
  const t = useTranslations("Agent");

  return (
    <section
      aria-label={t("panel.label")}
      className="bg-card fixed inset-x-2 top-2 bottom-13 z-40 flex flex-col overflow-hidden rounded-xl border shadow-lg md:top-auto md:left-auto md:h-150 md:max-h-[calc(100svh-4.25rem)] md:w-100"
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h2>
        {menu}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("panel.minimize")}
          onClick={onMinimize}
        >
          <MinusIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("panel.fullPage")}
          onClick={onFullPage}
        >
          <MaximizeIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("panel.close")}
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </header>
      {children}
    </section>
  );
};

/**
 * An empty panel: the mark small, a welcome, one muted line, and the
 * examples as pills that send their prompt.
 */
export const PanelEmptyView = ({
  disabled,
  onPick,
}: {
  readonly disabled: boolean;
  readonly onPick: (prompt: string) => void;
}) => {
  const t = useTranslations("Agent");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <PealMark className="mb-2 size-10" />
      <EmptyStateTitle>{t("welcome")}</EmptyStateTitle>
      <p className="text-muted-foreground text-sm">{t("welcomeLine")}</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {agentExamples.map((example) => (
          <li key={example}>
            <Button
              variant="outline"
              size="xs"
              corners="round"
              disabled={disabled}
              onClick={() => {
                onPick(t(`examples.${example}.prompt`));
              }}
            >
              {t(`examples.${example}.title`)}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
