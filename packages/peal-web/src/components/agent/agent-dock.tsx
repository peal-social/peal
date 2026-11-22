"use client";

import { useAtomValue } from "@effect/atom-react";
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { BotIcon, HistoryIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "peal-ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import { cn } from "peal-ui/lib/utils";
import { useRef, useState } from "react";

import { agentChat } from "#agent/atoms.ts";
import {
  adoptChat,
  closeChat,
  minimize,
  newChat,
  openChat,
  pressTab,
  toggleAgent,
} from "#agent/panel-state.ts";
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
  ChatRowContent,
  PanelEmptyView,
  PanelView,
  chatRowClass,
  chatTitle,
} from "#components/agent/agent-views.tsx";
import { ChatMoreMenu } from "#components/agent/chat-menus.tsx";
import { ComposerView } from "#components/agent/chat-views.tsx";
import {
  useAgentChat,
  useNewAgentChat,
} from "#components/agent/use-agent-chat.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { agentPanelKey } from "#shell/keys.ts";

const NewChatPanel = ({
  onClose,
  onFullPage,
  onMinimize,
  permissions,
  workspaceId,
}: {
  readonly onClose: () => void;
  readonly onFullPage: () => void;
  readonly onMinimize: () => void;
  readonly permissions: readonly Permission[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const panel = useAgentPanel();
  const availability = useAvailability(workspaceId, permissions);
  const problemText = useProblemText();
  const input = useRef<HTMLTextAreaElement>(null);

  const chat = useNewAgentChat(workspaceId, (chatId) => {
    panel.update((state) => adoptChat(state, chatId));
  });

  const send = (text: string) => {
    void chat.send(text);
  };

  return (
    <PanelView
      menu={null}
      title={t("newChat")}
      onClose={onClose}
      onFullPage={onFullPage}
      onMinimize={onMinimize}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PanelEmptyView disabled={!availability.ready} onPick={send} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        {availability.notice}
        {chat.state.problem === null ? null : (
          <p role="alert" className="text-destructive-text text-sm">
            {problemText(chat.state.problem)}
          </p>
        )}
        <ComposerView
          disabled={!availability.ready}
          inputRef={input}
          label={t("composerLabel")}
          placeholder={t("panelPlaceholder")}
          running={false}
          value={chat.state.draft}
          onChange={(text) => {
            chat.type(text);
          }}
          onEscape={() => {
            input.current?.blur();
          }}
          onSend={() => {
            send(chat.state.draft.trim());
          }}
          onStop={() => {
            // A new chat has no run to stop.
          }}
        />
      </div>
    </PanelView>
  );
};

const ChatPanel = ({
  chatId,
  onClose,
  onDeleted,
  onFullPage,
  onMinimize,
  permissions,
  workspaceId,
}: {
  readonly chatId: string;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
  readonly onFullPage: () => void;
  readonly onMinimize: () => void;
  readonly permissions: readonly Permission[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const availability = useAvailability(workspaceId, permissions);
  const chat = useAgentChat(workspaceId, chatId);
  const copyTranscript = useCopyTranscript(chat);
  const input = useRef<HTMLTextAreaElement>(null);
  const title = chatTitle(t, chat.state.title);

  const removeAndClose = async () => {
    if (await chat.remove()) {
      onDeleted();
    }
  };

  const empty =
    chat.state.loaded &&
    chat.state.messages.length === 0 &&
    chat.state.run === null &&
    chat.state.problem === null;

  return (
    <PanelView
      menu={
        <ChatMoreMenu
          title={title}
          onCopy={copyTranscript}
          onDelete={() => {
            void removeAndClose();
          }}
          onRename={async (renamed) => await chat.rename(renamed)}
        />
      }
      title={title}
      onClose={onClose}
      onFullPage={onFullPage}
      onMinimize={onMinimize}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        {chat.missing ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            {t("errors.chatGone")}
          </p>
        ) : null}
        {empty ? (
          <PanelEmptyView
            disabled={!availability.ready}
            onPick={(text) => {
              chat.send(text);
            }}
          />
        ) : null}
        {chat.missing ? null : (
          <ChatBody
            availability={availability}
            chat={chat}
            inputRef={input}
            placeholder={t("panelPlaceholder")}
            workspaceId={workspaceId}
            onEscape={() => {
              input.current?.blur();
            }}
          />
        )}
      </div>
    </PanelView>
  );
};

// A tab of the bar: the chat's title, truncated, pressed while it shows.
const PanelTab = ({
  chatId,
  onClose,
  onPress,
  shown,
  workspaceId,
}: {
  readonly chatId: string;
  readonly onClose: () => void;
  readonly onPress: () => void;
  readonly shown: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const { title } = useAtomValue(agentChat(chatId));
  // A chat minimized before a reload is not read until it shows: its
  // title is the history's meanwhile.
  const saved = useRecentChats(workspaceId).find(({ id }) => id === chatId);

  const name = chatTitle(
    t,
    chatId === newChat ? null : (title ?? saved?.title ?? null)
  );

  return (
    <li
      className={cn(
        "group/tab flex h-7.5 max-w-40 items-center rounded-lg text-xs",
        shown ? "bg-accent" : "hover:bg-accent"
      )}
    >
      <button
        type="button"
        aria-pressed={shown}
        className="focus-visible:ring-ring/50 min-w-0 flex-1 truncate rounded-lg px-2.5 text-left outline-none focus-visible:ring-3"
        onClick={onPress}
      >
        {name}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("dock.closeTab", { title: name })}
        onClick={onClose}
      >
        <XIcon aria-hidden />
      </Button>
    </li>
  );
};

const HistoryMenu = ({
  onChoose,
  workspaceId,
}: {
  readonly onChoose: (chatId: string) => void;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const [open, setOpen] = useState(false);
  const chats = useRecentChats(workspaceId);
  const now = useNow();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("dock.history")}
          />
        }
      >
        <HistoryIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80">
        <PopoverTitle>{t("dock.history")}</PopoverTitle>
        {chats.length === 0 ? (
          <p className="text-muted-foreground px-3 pb-3 text-sm">
            {t("dock.historyEmpty")}
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  className={cn(chatRowClass, "rounded-md px-3 py-2")}
                  onClick={() => {
                    setOpen(false);
                    onChoose(chat.id);
                  }}
                >
                  <ChatRowContent chat={chat} now={now} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

/**
 * The agent's place at the bottom bar's end (DESIGN.md, "The agent"):
 * each chat open in the panel as a tab, **Agent** (a new chat in the
 * panel, or hides it while it shows; ⌘J), **History**, and the floating
 * panel over the page, open across the workspace's pages.
 */
export const AgentDock = ({
  permissions,
}: {
  readonly permissions: readonly Permission[];
}) => {
  const t = useTranslations("Agent");
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const panel = useAgentPanel();
  const hint = useShortcutHint(agentPanelKey);
  const { state, update, workspaceId } = panel;

  useShortcut(
    agentPanelKey,
    () => {
      update(toggleAgent);
    },
    { description: t("dock.toggle"), when: () => panel.allowed }
  );

  if (!panel.allowed) {
    return null;
  }

  const { shown } = state;

  const close = (chatId: string) => {
    update((current) => closeChat(current, chatId));
  };

  const fullPage = (chatId: string) => {
    close(chatId);
    router.push(
      workspaceHref(
        workspaceId,
        chatId === newChat ? "/agent" : `/agent/${chatId}`
      )
    );
  };

  const hide = () => {
    update(minimize);
  };

  return (
    <>
      {state.tabs.length === 0 ? null : (
        <ul
          aria-label={t("dock.tabs")}
          className="hidden min-w-0 items-center gap-1 md:flex"
        >
          {state.tabs.map((tab) => (
            <PanelTab
              key={tab}
              chatId={tab}
              shown={tab === shown}
              workspaceId={workspaceId}
              onClose={() => {
                close(tab);
              }}
              onPress={() => {
                update((current) => pressTab(current, tab));
              }}
            />
          ))}
        </ul>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={shown !== null}
              aria-keyshortcuts={hint.ariaKeyshortcuts}
              onClick={() => {
                update(toggleAgent);
              }}
            />
          }
        >
          <BotIcon aria-hidden />
          {t("dock.agent")}
        </TooltipTrigger>
        <TooltipContent>
          {t("dock.toggle")} {hint.text}
        </TooltipContent>
      </Tooltip>
      <HistoryMenu
        workspaceId={workspaceId}
        onChoose={(chatId) => {
          update((current) => openChat(current, chatId));
        }}
      />
      {shown === newChat ? (
        <NewChatPanel
          permissions={permissions}
          workspaceId={workspaceId}
          onClose={() => {
            close(newChat);
          }}
          onFullPage={() => {
            fullPage(newChat);
          }}
          onMinimize={hide}
        />
      ) : null}
      {shown === null || shown === newChat ? null : (
        <ChatPanel
          key={shown}
          chatId={shown}
          permissions={permissions}
          workspaceId={workspaceId}
          onClose={() => {
            close(shown);
          }}
          onDeleted={() => {
            close(shown);
          }}
          onFullPage={() => {
            fullPage(shown);
          }}
          onMinimize={hide}
        />
      )}
    </>
  );
};
