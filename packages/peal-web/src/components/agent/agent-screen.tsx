"use client";

import { PanelBottomOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { useSyncExternalStore } from "react";

import { openChat } from "#agent/panel-state.ts";
import {
  ChatBody,
  useAvailability,
  useCopyTranscript,
  useNow,
  useProblemText,
  useRecentChats,
} from "#components/agent/agent-chat.tsx";
import { useAgentPanel } from "#components/agent/agent-panel-context.tsx";
import {
  AgentHomeView,
  ExampleCardsView,
  RecentChatsView,
  chatTitle,
} from "#components/agent/agent-views.tsx";
import {
  ChatMoreMenu,
  ChatSwitcher,
  StarButton,
} from "#components/agent/chat-menus.tsx";
import { ComposerView } from "#components/agent/chat-views.tsx";
import {
  useAgentChat,
  useNewAgentChat,
} from "#components/agent/use-agent-chat.ts";
import { AppLink } from "#components/shell/app-link.tsx";
import { PageActions, PageTitle } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useRouter } from "#i18n/navigation.ts";

// Whether this browser hid the examples under the agent page's composer:
// a convenience of the browser, as the hour format is.
const examplesKey = "peal.agent-examples-hidden";
const examplesChanged = "peal:agent-examples";

const examplesHidden = (): boolean => {
  try {
    return window.localStorage.getItem(examplesKey) === "1";
  } catch {
    return false;
  }
};

const hideExamples = (): void => {
  try {
    window.localStorage.setItem(examplesKey, "1");
  } catch {
    // Storage is closed to this page: they come back on the next visit.
  }

  window.dispatchEvent(new Event(examplesChanged));
};

const subscribeExamples = (listener: () => void) => {
  window.addEventListener(examplesChanged, listener);

  return () => {
    window.removeEventListener(examplesChanged, listener);
  };
};

/** The most chats the agent page lists under its examples. */
const recentCount = 8;

/**
 * The agent's page (`…/agent`): a new chat's composer in the centre, the
 * examples, and the person's latest chats. Sending opens the chat's page.
 */
export const AgentHomeScreen = ({
  permissions,
  workspaceId,
}: {
  readonly permissions: readonly Permission[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const availability = useAvailability(workspaceId, permissions);
  const problemText = useProblemText();
  const now = useNow();
  const recent = useRecentChats(workspaceId).slice(0, recentCount);

  const hidden = useSyncExternalStore(
    subscribeExamples,
    examplesHidden,
    () => true
  );

  const chat = useNewAgentChat(workspaceId, (chatId) => {
    router.push(workspaceHref(workspaceId, `/agent/${chatId}`));
  });

  const send = (text: string) => {
    void chat.send(text);
  };

  return (
    <AgentHomeView
      composer={
        <ComposerView
          disabled={!availability.ready}
          label={t("composerLabel")}
          placeholder={t("placeholder")}
          running={false}
          value={chat.state.draft}
          onChange={(text) => {
            chat.type(text);
          }}
          onSend={() => {
            send(chat.state.draft.trim());
          }}
          onStop={() => {
            // A new chat has no run to stop.
          }}
        />
      }
      examples={
        hidden ? null : (
          <ExampleCardsView
            disabled={!availability.ready}
            onDismiss={hideExamples}
            onPick={send}
          />
        )
      }
      notice={
        <>
          {availability.notice}
          {chat.state.problem === null ? null : (
            <p role="alert" className="text-destructive-text text-sm">
              {problemText(chat.state.problem)}
            </p>
          )}
        </>
      }
      recent={
        <RecentChatsView
          chats={recent}
          hrefOf={(chatId) => workspaceHref(workspaceId, `/agent/${chatId}`)}
          link={AppLink}
          now={now}
        />
      }
    />
  );
};

/**
 * A chat's page (`…/agent/[chatId]`): its title in the panel's header,
 * with the switcher, the star, **…** and **Move to panel**, then its
 * messages and the composer.
 */
export const AgentChatScreen = ({
  chatId,
  permissions,
  workspaceId,
}: {
  readonly chatId: string;
  readonly permissions: readonly Permission[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const panel = useAgentPanel();
  const availability = useAvailability(workspaceId, permissions);
  const chat = useAgentChat(workspaceId, chatId);
  const copyTranscript = useCopyTranscript(chat);
  const now = useNow();
  const chats = useRecentChats(workspaceId);
  const title = chatTitle(t, chat.state.title);
  const home = workspaceHref(workspaceId, "/agent");

  const removeAndLeave = async () => {
    if (await chat.remove()) {
      router.push(home);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageTitle>{title}</PageTitle>
      <PageActions>
        <ChatSwitcher
          chats={chats}
          current={chatId}
          now={now}
          onChoose={(id) => {
            router.push(workspaceHref(workspaceId, `/agent/${id}`));
          }}
          onNewChat={() => {
            router.push(home);
          }}
        />
        <StarButton
          starred={chat.state.starred}
          onStar={(starred) => {
            void chat.star(starred);
          }}
        />
        <ChatMoreMenu
          keys="page"
          title={title}
          onCopy={copyTranscript}
          onDelete={() => {
            void removeAndLeave();
          }}
          onRename={async (renamed) => await chat.rename(renamed)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            panel.update((state) => openChat(state, chatId));
            router.push(home);
          }}
        >
          <PanelBottomOpenIcon aria-hidden />
          {t("menu.moveToPanel")}
        </Button>
      </PageActions>
      {chat.missing ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {t("errors.chatGone")}
          </p>
          <AppLink
            href={home}
            className="text-brand-text text-sm hover:underline"
          >
            {t("newChat")}
          </AppLink>
        </div>
      ) : (
        <ChatBody
          availability={availability}
          chat={chat}
          placeholder={t("placeholder")}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
};
