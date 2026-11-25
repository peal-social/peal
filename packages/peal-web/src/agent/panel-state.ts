import { Option, Schema } from "effect";

import { personKeyOf } from "#auth/person-storage.ts";
import type { KeptFor } from "#auth/person-storage.ts";

// The floating panel's chats, as the bottom bar shows them: each chat
// open in the panel is a tab, one of them shown (or none, minimized). A
// new chat has no id until its first message: it is the `newChat` tab.
// The browser keeps this per person and workspace, never the server.

/** The tab of a chat not yet sent, which takes its id once made. */
export const newChat = "new";

/** The most tabs the bar holds: opening another drops the oldest. */
export const maxPanelTabs = 5;

export const PanelStateSchema = Schema.Struct({
  shown: Schema.NullOr(Schema.String),
  tabs: Schema.Array(Schema.String),
});

export type PanelState = typeof PanelStateSchema.Type;

export const closedPanel: PanelState = { shown: null, tabs: [] };

const withTab = (tabs: readonly string[], tab: string): readonly string[] => {
  if (tabs.includes(tab)) {
    return tabs;
  }

  const kept = [...tabs, tab];

  return kept.length > maxPanelTabs ? kept.slice(-maxPanelTabs) : kept;
};

/** Shows a chat in the panel, as a tab of its own. */
export const openChat = (state: PanelState, chat: string): PanelState => ({
  shown: chat,
  tabs: withTab(state.tabs, chat),
});

/**
 * **Agent**: hides the panel while it shows, and otherwise opens a new
 * chat in it, with no tab: a chat becomes a tab of the bar once its first
 * message makes it (`adoptChat`).
 */
export const toggleAgent = (state: PanelState): PanelState =>
  state.shown === null
    ? { shown: newChat, tabs: state.tabs.filter((tab) => tab !== newChat) }
    : minimize(state);

/** A tab of the bar: shows its chat, or hides it while it shows. */
export const pressTab = (state: PanelState, chat: string): PanelState =>
  state.shown === chat ? minimize(state) : openChat(state, chat);

/** Hides the panel; its tabs stay. */
export const minimize = (state: PanelState): PanelState => ({
  ...state,
  shown: null,
});

/** Closes a chat's tab, and the panel when it showed that chat. */
export const closeChat = (state: PanelState, chat: string): PanelState => ({
  shown: state.shown === chat ? null : state.shown,
  tabs: state.tabs.filter((tab) => tab !== chat),
});

/**
 * The new chat, once its first message made it, takes the id the server
 * gave it and its tab in the bar.
 */
export const adoptChat = (state: PanelState, id: string): PanelState => {
  const tabs = state.tabs.filter((tab) => tab !== newChat);

  return state.shown === newChat
    ? { shown: id, tabs: withTab(tabs, id) }
    : { ...state, tabs };
};

const decodeStored = Schema.decodeUnknownOption(
  Schema.fromJsonString(PanelStateSchema)
);

/** The panel a stored value names, or a closed one for anything else. */
export const panelStateOf = (stored: string | null): PanelState => {
  const state = Option.getOrElse(
    Option.fromNullishOr(stored).pipe(Option.flatMap(decodeStored)),
    () => closedPanel
  );

  // A new chat is never a tab, as an older browser may have kept it.
  return { ...state, tabs: state.tabs.filter((tab) => tab !== newChat) };
};

/**
 * Where the person's panel of a workspace is kept, in the browser's local
 * storage: theirs alone, as others may sign in on the same browser.
 */
export const panelStorageKey = (owner: KeptFor): string =>
  personKeyOf("agent-panel", owner);
