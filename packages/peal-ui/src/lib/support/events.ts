// How a page talks with its `<peal-support>` without importing it: the
// app's account menu opens the chat with `openSupportChat`, and hears how
// many replies wait through `listenToSupportUnread`. Plain DOM events on
// the document, so the launcher's script stays apart.

const openEvent = "peal-support:open";
const unreadEvent = "peal-support:unread";

/** Asks the page's launcher to open the chat. */
export const openSupportChat = (): void => {
  document.dispatchEvent(new CustomEvent(openEvent));
};

/** Calls `open` each time something asks for the chat; returns a stop. */
export const listenToSupportOpen = (open: () => void): (() => void) => {
  document.addEventListener(openEvent, open);

  return () => {
    document.removeEventListener(openEvent, open);
  };
};

/** Tells the page how many replies wait unread. */
export const tellSupportUnread = (count: number): void => {
  document.dispatchEvent(new CustomEvent(unreadEvent, { detail: count }));
};

/** Calls `hear` with each new count of unread replies; returns a stop. */
export const listenToSupportUnread = (
  hear: (count: number) => void
): (() => void) => {
  const listener = (event: Event) => {
    const count = event instanceof CustomEvent ? Number(event.detail) : 0;

    hear(Number.isInteger(count) && count > 0 ? count : 0);
  };

  document.addEventListener(unreadEvent, listener);

  return () => {
    document.removeEventListener(unreadEvent, listener);
  };
};
