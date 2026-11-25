"use client";

import { createContext, use, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { closedPanel, panelStateOf } from "#agent/panel-state.ts";
import type { PanelState } from "#agent/panel-state.ts";
import { makePanelStore } from "#agent/panel-store.ts";

interface AgentPanel {
  /** Whether the person may talk to the agent here (`assistant:use`). */
  readonly allowed: boolean;
  readonly state: PanelState;
  readonly update: (change: (state: PanelState) => PanelState) => void;
  readonly workspaceId: string;
}

const PanelContext = createContext<AgentPanel>({
  allowed: false,
  state: closedPanel,
  update: () => {
    // Outside a workspace, there is no panel.
  },
  workspaceId: "",
});

/**
 * The agent's panel of a workspace, open across its pages: which chats
 * are tabs and which one shows, kept in the browser for the person
 * (`makePanelStore`).
 */
export const AgentPanelProvider = ({
  allowed,
  children,
  userId,
  workspaceId,
}: {
  readonly allowed: boolean;
  readonly children: ReactNode;
  /** The signed-in person: the browser keeps each person's panel apart. */
  readonly userId: string;
  readonly workspaceId: string;
}) => {
  const store = useMemo(
    () => makePanelStore({ userId, workspaceId }),
    [userId, workspaceId]
  );

  // The server knows nothing of the browser's panel: closed until hydrated.
  const stored = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    () => null
  );

  const value = useMemo(
    () => ({
      allowed,
      state: panelStateOf(stored),
      update: store.update,
      workspaceId,
    }),
    [allowed, store, stored, workspaceId]
  );

  return <PanelContext value={value}>{children}</PanelContext>;
};

/** The workspace's agent panel, and how to change it. */
export const useAgentPanel = (): AgentPanel => use(PanelContext);
