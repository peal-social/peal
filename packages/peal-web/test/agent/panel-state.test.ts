import { describe, expect, it } from "@effect/vitest";

import {
  adoptChat,
  closeChat,
  closedPanel,
  maxPanelTabs,
  minimize,
  newChat,
  openChat,
  panelStateOf,
  pressTab,
  toggleAgent,
} from "#agent/panel-state.ts";

describe("the agent's panel", () => {
  it("opens a new chat from Agent with no tab, and hides it on a second press", () => {
    const opened = toggleAgent(closedPanel);

    expect(opened).toStrictEqual({ shown: newChat, tabs: [] });
    expect(toggleAgent(opened)).toStrictEqual({ shown: null, tabs: [] });
  });

  it("leaves the open chats' tabs alone when a new chat opens", () => {
    const again = toggleAgent(minimize(openChat(closedPanel, "c1")));

    expect(again).toStrictEqual({ shown: newChat, tabs: ["c1"] });
  });

  it("opens a chat from History as a tab, once", () => {
    const state = openChat(openChat(closedPanel, "c1"), "c1");

    expect(state).toStrictEqual({ shown: "c1", tabs: ["c1"] });
  });

  it("shows a tab when pressed, and hides it when pressed while shown", () => {
    const state = openChat(openChat(closedPanel, "c1"), "c2");

    expect(pressTab(state, "c1").shown).toBe("c1");
    expect(pressTab(state, "c2")).toStrictEqual({
      shown: null,
      tabs: ["c1", "c2"],
    });
  });

  it("closes a tab, and the panel with it when it showed that chat", () => {
    const state = openChat(openChat(closedPanel, "c1"), "c2");

    expect(closeChat(state, "c2")).toStrictEqual({ shown: null, tabs: ["c1"] });
    expect(closeChat(state, "c1")).toStrictEqual({ shown: "c2", tabs: ["c2"] });
  });

  it("makes the new chat a tab once its first message made it", () => {
    expect(adoptChat(toggleAgent(closedPanel), "c9")).toStrictEqual({
      shown: "c9",
      tabs: ["c9"],
    });
    // Made while another chat shows: it stays out of the bar.
    expect(
      adoptChat(openChat(toggleAgent(closedPanel), "c1"), "c9")
    ).toStrictEqual({ shown: "c1", tabs: ["c1"] });
  });

  it("keeps the latest tabs only", () => {
    const ids = Array.from(
      { length: maxPanelTabs + 2 },
      (_, index) => `c${index}`
    );

    let state = closedPanel;

    for (const id of ids) {
      state = openChat(state, id);
    }

    expect(state.tabs).toStrictEqual(ids.slice(-maxPanelTabs));
  });

  it("reads what the browser kept, and a closed panel for anything else", () => {
    expect(panelStateOf('{"shown":"c1","tabs":["c1"]}')).toStrictEqual({
      shown: "c1",
      tabs: ["c1"],
    });
    // A new chat an older browser kept as a tab is not one.
    expect(panelStateOf('{"shown":"new","tabs":["new","c1"]}')).toStrictEqual({
      shown: newChat,
      tabs: ["c1"],
    });
    expect(
      ["", "null", "{", '{"tabs":[1]}', null].map((stored) =>
        panelStateOf(stored)
      )
    ).toStrictEqual(Array.from({ length: 5 }, () => closedPanel));
  });
});
