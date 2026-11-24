import { Atom } from "effect/reactivity";
import { maxInboxPageSize, forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The queries and mutations of the inbox's direct messages. A change to a
// conversation passes `reactivityKeys: conversationsChanged(workspaceId,
// conversationId)`, which reads the conversation and the list again.

/** What refreshes a workspace's list of conversations. */
export const conversationListChanged = (workspaceId: string) => [
  `inbox-messages:${workspaceId}`,
];

/** What refreshes one conversation. */
export const conversationChanged = (conversationId: string) => [
  `inbox-conversation:${conversationId}`,
];

/** What refreshes a conversation and its workspace's list once a change lands. */
export const conversationsChanged = (
  workspaceId: string,
  conversationId: string
) => [
  ...conversationListChanged(workspaceId),
  ...conversationChanged(conversationId),
];

/** The workspace's latest conversations: one page of the most. */
export const conversationList = Atom.family((workspaceId: string) =>
  PealApi.query("inbox.messages", "listConversations", {
    headers: forWorkspace(workspaceId),
    query: { limit: maxInboxPageSize },
    reactivityKeys: conversationListChanged(workspaceId),
  })
);

const conversations = Atom.family((key: string) => {
  const [workspaceId = "", conversationId = "", cursor = ""] = key.split("/");

  return PealApi.query("inbox.messages", "getConversation", {
    headers: forWorkspace(workspaceId),
    params: { conversationId },
    query: cursor === "" ? {} : { cursor },
    reactivityKeys: conversationChanged(conversationId),
  });
});

/**
 * A page of a conversation, the messages sent from Peal, its abilities:
 * the latest messages, or those before `cursor`.
 */
export const conversationDetail = (
  workspaceId: string,
  conversationId: string,
  cursor = ""
) => conversations(`${workspaceId}/${conversationId}/${cursor}`);

/** What refreshes the direct messages' settings. */
export const messageSettingsChanged = (workspaceId: string) => [
  `inbox-message-settings:${workspaceId}`,
  ...conversationListChanged(workspaceId),
];

/** The channels whose messages are on, and the applications let in. */
export const messageSettings = Atom.family((workspaceId: string) =>
  PealApi.query("inbox.messages", "getSettings", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: messageSettingsChanged(workspaceId),
  })
);

export const setChannelMessages = PealApi.mutation(
  "inbox.messages",
  "setChannel"
);

export const setMessageApplication = PealApi.mutation(
  "inbox.messages",
  "setApplication"
);

export const sendMessage = PealApi.mutation("inbox.messages", "send");

export const setConversationRead = PealApi.mutation(
  "inbox.messages",
  "setConversationRead"
);

export const confirmMessage = PealApi.mutation("inbox.messages", "confirm");
