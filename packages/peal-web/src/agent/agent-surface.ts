// Which chat the keys of a chat (rename, delete) act on when the page and
// the panel both show one: the one the person last clicked or focused in.
// The panel marks itself with `data-agent-panel`.

/** Where the agent's panel draws itself, for `closest`. */
export const agentPanelSelector = "[data-agent-panel]";

let panelLast = false;

const noted = (event: Event) => {
  panelLast =
    event.target instanceof Element &&
    event.target.closest(agentPanelSelector) !== null;
};

/**
 * Follows where the person clicks and focuses, once a page: whether the
 * panel was the last place. Answers how to stop.
 */
export const followAgentSurface = (): (() => void) => {
  document.addEventListener("pointerdown", noted, true);
  document.addEventListener("focusin", noted, true);

  return () => {
    document.removeEventListener("pointerdown", noted, true);
    document.removeEventListener("focusin", noted, true);
  };
};

/** Whether the person last clicked or focused in the panel. */
export const panelWasLast = (): boolean =>
  panelLast && document.querySelector(agentPanelSelector) !== null;
