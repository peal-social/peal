import { Option, Schema } from "effect";

// The floating panel's chats, as the bottom bar shows them: each chat
// open in the panel is a tab, one of them shown (or none, minimized). A
// new chat has no id until its first message: it is the `newChat` tab.
// The browser keeps this per workspace, never the server.

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
 * chat in it.
 */
export const toggleAgent = (state: PanelState): PanelState =>
  state.shown === null ? openChat(state, newChat) : minimize(state);

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

/** The new chat's tab takes the id the server gave the chat. */
export const adoptChat = (state: PanelState, id: string): PanelState => ({
  shown: state.shown === newChat ? id : state.shown,
  tabs: [...new Set(state.tabs.map((tab) => (tab === newChat ? id : tab)))],
});

const decodeStored = Schema.decodeUnknownOption(
  Schema.fromJsonString(PanelStateSchema)
);

/** The panel a stored value names, or a closed one for anything else. */
export const panelStateOf = (stored: string | null): PanelState =>
  Option.getOrElse(
    Option.fromNullishOr(stored).pipe(Option.flatMap(decodeStored)),
    () => closedPanel
  );

/** Where a workspace's panel is kept, in the browser's local storage. */
export const panelStorageKey = (workspaceId: string): string =>
  `peal.agent-panel.${workspaceId}`;
