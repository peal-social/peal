"use client";

import {
  RegistryContext,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type { AgentRating } from "peal-contract/agent";
import { toast } from "peal-ui/components/toast";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

import {
  agentChat,
  agentChatDetail,
  agentChats,
  agentRun,
  createAgentChat,
  deleteAgentChat,
  newChatKey,
  rateAgentAnswer,
  updateAgentChat,
} from "#agent/atoms.ts";
import { closeChat } from "#agent/panel-state.ts";
import { refusalOf, rereadsChat } from "#agent/refusal.ts";
import { emptyChat, foldChat } from "#agent/run-state.ts";
import type { ChatAction, ChatState } from "#agent/run-state.ts";
import { limitOfFailure } from "#billing/upgrade.ts";
import { channelName } from "#channels/channel-name.ts";
import { channelsOf } from "#channels/channels-api.ts";
import { useAgentPanel } from "#components/agent/agent-panel-context.tsx";
import type {
  ChannelNameOf,
  ChatLinks,
} from "#components/agent/chat-views.tsx";
import { useUpgradePrompt } from "#components/billing/upgrade-prompt.tsx";
import { AppLink } from "#components/shell/app-link.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useMounted } from "#posts/use-mounted.ts";

/** Folds actions into a chat's state, shared by every place showing it. */
const useDispatch = (key: string) => {
  const registry = useContext(RegistryContext);

  return useCallback(
    (action: ChatAction) => {
      const atom = agentChat(key);

      registry.set(atom, foldChat(registry.get(atom), action));
    },
    [key, registry]
  );
};

// A plan's refusal opens the upgrade dialog, once: a problem already
// there when the place opened was offered where it came.
const useOfferOnRefusal = (state: ChatState, workspaceId: string) => {
  const prompt = useUpgradePrompt();
  const seen = useRef(state.problem);

  useEffect(() => {
    const { problem } = state;

    if (problem === seen.current) {
      return;
    }

    seen.current = problem;

    if (problem?._tag === "refused") {
      const reached = limitOfFailure(problem.refusal);

      if (Option.isSome(reached)) {
        prompt(reached.value, workspaceId);
      }
    }
  }, [prompt, state, workspaceId]);
};

/** Copies an answer's text, saying how it went. */
export const useCopy = () => {
  const t = useTranslations("Agent");

  return useCallback(
    async (text: string, done = t("copied")) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(done);
      } catch {
        toast.error(t("copyFailed"));
      }
    },
    [t]
  );
};

/** Where the chat's cards and approvals link, in the workspace. */
export const useChatLinks = (workspaceId: string): ChatLinks => {
  const workspaceHref = useWorkspaceHref();

  return useMemo(
    () => ({
      link: AppLink,
      post: (postId: string) => workspaceHref(workspaceId, `/posts/${postId}`),
      thread: (threadId: string) =>
        workspaceHref(workspaceId, `/inbox/${threadId}`),
    }),
    [workspaceHref, workspaceId]
  );
};

/** The workspace's channels by name, for cards and approvals. */
export const useChannelNames = (workspaceId: string): ChannelNameOf => {
  const channels = useAtomValue(channelsOf(workspaceId));

  return useMemo(() => {
    const names = new Map(
      AsyncResult.getOrElse(channels, () => []).map((channel) => [
        channel.id,
        channelName(channel),
      ])
    );

    return (id: string) => names.get(id) ?? null;
  }, [channels]);
};

/**
 * A chat the server holds: its state, read in once, and what the person
 * does in it. The page and the panel call it for the same chat and show
 * the same state.
 */
export const useAgentChat = (workspaceId: string, chatId: string) => {
  const state = useAtomValue(agentChat(chatId));
  const detailAtom = agentChatDetail(workspaceId, chatId);
  const detail = useAtomValue(detailAtom);
  const reread = useAtomRefresh(detailAtom);
  const refreshChats = useAtomRefresh(agentChats(workspaceId));
  const registry = useContext(RegistryContext);
  const dispatch = useDispatch(chatId);
  const rate = useAtomSet(rateAgentAnswer, { mode: "promiseExit" });
  const update = useAtomSet(updateAgentChat, { mode: "promiseExit" });
  const remove = useAtomSet(deleteAgentChat, { mode: "promiseExit" });
  const panel = useAgentPanel();
  // The server renders without the person's cookies, so it never reads
  // the chat: only the browser says one is missing.
  const mounted = useMounted();

  useOfferOnRefusal(state, workspaceId);

  useEffect(() => {
    if (state.loaded || state.run !== null) {
      return;
    }

    if (AsyncResult.isSuccess(detail) && !detail.waiting) {
      dispatch({ _tag: "loaded", detail: detail.value });
    }
  }, [detail, dispatch, state.loaded, state.run]);

  // A tab shown again reads the chat again: another tab may have written
  // in it meanwhile. Never during a run, which holds more than the server.
  const running = state.run !== null;

  useEffect(() => {
    const shown = () => {
      if (document.visibilityState === "visible" && !running) {
        dispatch({ _tag: "stale" });
        reread();
      }
    };

    document.addEventListener("visibilitychange", shown);

    return () => {
      document.removeEventListener("visibilitychange", shown);
    };
  }, [dispatch, reread, running]);

  // An approval answered elsewhere, or a chat gone: read it again.
  useEffect(() => {
    const { problem } = state;

    if (problem?._tag === "refused" && rereadsChat(problem.refusal)) {
      dispatch({ _tag: "stale" });
      reread();
    }
  }, [dispatch, reread, state]);

  const run = agentRun(chatId);

  return {
    answer: (callId: string, approved: boolean) => {
      registry.set(run, {
        ask: { _tag: "answer", approved, callId },
        chatId,
        workspaceId,
      });
    },
    detail,
    /** The chat could not be read: deleted, expired, or the network. */
    missing:
      mounted &&
      AsyncResult.isFailure(detail) &&
      !state.loaded &&
      state.run === null,
    remove: async (): Promise<boolean> => {
      const exit = await remove({ params: { chatId, workspaceId } });

      refreshChats();

      // A deleted chat leaves the panel and the tab's memory too.
      if (Exit.isSuccess(exit)) {
        panel.update((current) => closeChat(current, chatId));
        registry.set(agentChat(chatId), emptyChat);
      }

      return Exit.isSuccess(exit);
    },
    rate: async (messageId: string, rating: AgentRating | null) => {
      const before = state.messages.find(({ id }) => id === messageId)?.rating;

      dispatch({ _tag: "rated", messageId, rating });

      const exit = await rate({
        params: { chatId, messageId, workspaceId },
        payload: { rating },
      });

      // The rating was not kept: show the one the server has.
      if (Exit.isFailure(exit)) {
        dispatch({ _tag: "rated", messageId, rating: before ?? null });
      }
    },
    rename: async (title: string): Promise<boolean> => {
      const exit = await update({
        params: { chatId, workspaceId },
        payload: { title },
      });

      if (Exit.isSuccess(exit)) {
        dispatch({ _tag: "renamed", title: exit.value.title ?? title });
        refreshChats();
      }

      return Exit.isSuccess(exit);
    },
    send: (text: string) => {
      registry.set(run, { ask: { _tag: "send", text }, chatId, workspaceId });
    },
    star: async (starred: boolean) => {
      dispatch({ _tag: "starred", starred });

      const exit = await update({
        params: { chatId, workspaceId },
        payload: { starred },
      });

      if (Exit.isFailure(exit)) {
        dispatch({ _tag: "starred", starred: !starred });
      } else {
        refreshChats();
      }
    },
    state,
    stop: () => {
      registry.set(run, Atom.Interrupt);
    },
    type: (text: string) => {
      dispatch({ _tag: "typed", text });
    },
  };
};

/**
 * A chat not yet sent: its draft, and Send, which makes the chat, starts
 * its run and hands its id to `onCreated` (the page opens it, the panel's
 * tab takes it).
 */
export const useNewAgentChat = (
  workspaceId: string,
  onCreated: (chatId: string) => void
) => {
  const key = newChatKey(workspaceId);
  const state = useAtomValue(agentChat(key));
  const registry = useContext(RegistryContext);
  const dispatch = useDispatch(key);
  const create = useAtomSet(createAgentChat, { mode: "promiseExit" });
  const refreshChats = useAtomRefresh(agentChats(workspaceId));

  useOfferOnRefusal(state, workspaceId);

  return {
    send: async (text: string) => {
      dispatch({ _tag: "typed", text: "" });

      const exit = await create({ params: { workspaceId } });

      if (Exit.isFailure(exit)) {
        dispatch({ _tag: "refused", refusal: refusalOf(exit), text });

        return;
      }

      const chat = exit.value;

      registry.set(agentChat(chat.id), {
        ...emptyChat,
        loaded: true,
        starred: chat.starred,
        title: chat.title,
      });
      registry.set(agentRun(chat.id), {
        ask: { _tag: "send", text },
        chatId: chat.id,
        workspaceId,
      });
      registry.set(agentChat(key), emptyChat);
      refreshChats();
      onCreated(chat.id);
    },
    state,
    type: (text: string) => {
      dispatch({ _tag: "typed", text });
    },
  };
};
