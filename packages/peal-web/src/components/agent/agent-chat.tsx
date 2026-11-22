"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useFormatter, useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import type { AgentStatus } from "peal-contract/agent";
import { Button } from "peal-ui/components/button";
import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { agentChats, agentStatus } from "#agent/atoms.ts";
import { transcriptOf } from "#agent/history.ts";
import { AgentComposer } from "#components/agent/agent-composer.tsx";
import { chatTitle } from "#components/agent/agent-views.tsx";
import {
  AgentOffView,
  TranscriptView,
  problemMessage,
} from "#components/agent/chat-views.tsx";
import type { useAgentChat } from "#components/agent/use-agent-chat.ts";
import {
  useChannelNames,
  useChatLinks,
  useCopy,
} from "#components/agent/use-agent-chat.ts";
import { AppLink } from "#components/shell/app-link.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useMounted } from "#posts/use-mounted.ts";

/** Whether the agent answers here, as the composer and its notices need it. */
export interface Availability {
  /** The composer takes messages. */
  readonly ready: boolean;
  /** Why it does not, with what to do; null while it does or is being read. */
  readonly notice: ReactNode;
}

/**
 * Whether the agent answers this person in the workspace: read once a
 * page, and said where it is off, with the way to turn it on.
 */
export const useAvailability = (
  workspaceId: string,
  permissions: readonly Permission[]
): Availability => {
  const t = useTranslations("Agent");
  const workspaceHref = useWorkspaceHref();
  const status = useAtomValue(agentStatus(workspaceId));
  const mounted = useMounted();
  const reread = useAtomRefresh(agentStatus(workspaceId));

  // The status needs the visitor's cookies, which the server's render has
  // not: it is read once the page has hydrated.
  if (!mounted) {
    return { notice: null, ready: false };
  }

  return AsyncResult.match(status, {
    onFailure: () => ({
      notice: (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-muted-foreground text-sm">
            {t("off.unreachable")}
          </p>
          <Button variant="outline" size="sm" onClick={reread}>
            {t("retry")}
          </Button>
        </div>
      ),
      ready: false,
    }),
    onInitial: () => ({ notice: null, ready: false }),
    onSuccess: ({ value }: { readonly value: AgentStatus }) =>
      value.available
        ? { notice: null, ready: true }
        : {
            notice: (
              <AgentOffView
                billingHref={
                  permissions.includes("billing:read")
                    ? workspaceHref(workspaceId, "/billing")
                    : null
                }
                link={AppLink}
                reason={value.reason}
                settingsHref={
                  permissions.includes("assistant:configure")
                    ? workspaceHref(workspaceId, "/settings/assistant")
                    : null
                }
              />
            ),
            ready: false,
          },
  });
};

/** The current time, once the page has hydrated, for dates and ages. */
export const useNow = (): DateTime.Utc | null =>
  useMounted() ? DateTime.nowUnsafe() : null;

/** The person's latest chats, or none while they are being read. */
export const useRecentChats = (workspaceId: string) =>
  AsyncResult.getOrElse(useAtomValue(agentChats(workspaceId)), () => ({
    chats: [],
    nextCursor: null,
  })).chats;

/**
 * Keeps the end of a chat in view as its answer comes, unless the person
 * scrolled up to read.
 */
const useFollow = (end: RefObject<HTMLDivElement | null>, writing: string) => {
  useEffect(() => {
    const element = end.current;

    // Nothing written yet: nothing to follow.
    if (element === null || writing === "") {
      return;
    }

    const box = element.getBoundingClientRect();

    // Within a screen of the end: follow it.
    if (box.top < window.innerHeight * 2) {
      element.scrollIntoView({ block: "end" });
    }
  }, [end, writing]);
};

/**
 * A chat's messages and its composer, as the page and the panel show it:
 * the composer at its foot.
 */
export const ChatBody = ({
  availability,
  chat,
  inputRef,
  keys,
  onEscape,
  placeholder,
  workspaceId,
}: {
  readonly availability: Availability;
  readonly chat: ReturnType<typeof useAgentChat>;
  readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Where the composer's keys act: the chat's page or the panel. */
  readonly keys?: "page" | "panel" | undefined;
  readonly onEscape?: () => void;
  readonly placeholder: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const ownInput = useRef<HTMLTextAreaElement>(null);
  const links = useChatLinks(workspaceId);
  const nameOf = useChannelNames(workspaceId);
  const copy = useCopy();
  const now = useNow();
  const end = useRef<HTMLDivElement>(null);
  const { state } = chat;
  const last = state.messages.at(-1);

  useFollow(end, `${String(state.messages.length)}:${last?.text.length ?? 0}`);

  // A chat opens at its latest messages, as it was left.
  useEffect(() => {
    // Once the messages read are drawn.
    const frame = state.loaded
      ? requestAnimationFrame(() => {
          end.current?.scrollIntoView({ block: "end" });
        })
      : null;

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [state.loaded]);

  return (
    <>
      <TranscriptView
        actions={{
          onCopy: (text) => {
            void copy(text);
          },
          onRate: (messageId, rating) => {
            void chat.rate(messageId, rating);
          },
        }}
        links={links}
        nameOf={nameOf}
        now={now}
        state={state}
        onAnswer={(callId, approved) => {
          chat.answer(callId, approved);
        }}
      />
      <div className="bg-card sticky bottom-0 z-10 mt-auto flex flex-col gap-2 pt-2 pb-3">
        {availability.notice}
        <AgentComposer
          disabled={!availability.ready}
          inputRef={inputRef ?? ownInput}
          keys={keys}
          label={t("composerLabel")}
          placeholder={placeholder}
          running={state.run !== null}
          skills={state.skills}
          value={state.draft}
          workspaceId={workspaceId}
          onSkills={(skills) => {
            chat.pick(skills);
          }}
          onChange={(text) => {
            chat.type(text);
          }}
          onEscape={onEscape}
          onSend={(text, media, skills) => {
            chat.send(text, media, skills);
          }}
          onStop={() => {
            chat.stop();
          }}
        />
      </div>
      {/* After the composer, which covers the end of the chat. */}
      <div ref={end} />
    </>
  );
};

/** What a chat's **…** copies: its messages as markdown, titled. */
export const useCopyTranscript = (chat: ReturnType<typeof useAgentChat>) => {
  const t = useTranslations("Agent");
  const shell = useTranslations("WorkspaceShell");
  const copy = useCopy();

  return () => {
    void copy(
      transcriptOf(chat.state.messages, {
        agent: shell("productName"),
        person: t("you"),
        title: chatTitle(t, chat.state.title),
      }),
      t("menu.copiedMarkdown")
    );
  };
};

/** The words of a problem shown outside a chat, as the new chat's. */
export const useProblemText = () => {
  const t = useTranslations("Agent");
  const format = useFormatter();

  return (problem: Parameters<typeof problemMessage>[2]) =>
    problemMessage(t, format, problem);
};
