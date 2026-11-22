import Cookies from "js-cookie";

import type { SupportPerson } from "./settings";

// Crisp's chatbox, behind Peal's own launcher (DESIGN.md, "Support chat").
// Nothing reaches Crisp until someone presses the launcher, or comes back
// with a conversation Crisp's cookie names: only then does the page load
// Crisp's script. Crisp's own button stays hidden; its window shows while
// open and hides again once closed. Its colours and type are Peal's, set
// over its variables in `support.css`.

type CrispCommand = readonly unknown[];

/** What Crisp's getters answer: a count, a text, a flag, or nothing. */
type CrispValue = boolean | number | string | null | undefined;

interface CrispQueue {
  readonly get?: (key: string) => CrispValue;
  readonly is?: (key: string) => boolean;
  readonly push: (command: CrispCommand) => void;
}

declare global {
  interface Window {
    $crisp?: CrispQueue;
    CRISP_COOKIE_EXPIRE?: number;
    CRISP_RUNTIME_CONFIG?: { locale?: string };
    CRISP_WEBSITE_ID?: string;
  }
}

/** Where Crisp's loader lives. */
export const crispScript = "https://client.crisp.chat/l.js";

/** The name of the cookie Crisp keeps a visitor's conversation under. */
export const sessionCookieName = (websiteId: string): string =>
  `crisp-client%2Fsession%2F${websiteId}`;

/**
 * How long Crisp keeps the cookie that names a conversation, in seconds:
 * the privacy policy's `supportCookie` (peal-contract's data-processing,
 * which a test compares it with, as importing it would weigh on every
 * page).
 */
export const conversationCookieSeconds = 183 * 86_400;

// The same names as js-cookie gives them, decoded.
const conversationCookiePrefix = "crisp-client/session/";

/**
 * Whether `cookies` (a `document.cookie`) names a conversation with
 * `websiteId`: the one case Crisp loads before the launcher is pressed,
 * so the person sees replies waiting.
 */
export const hasConversation = (
  cookies: string,
  websiteId: string
): boolean => {
  const name = sessionCookieName(websiteId);

  return cookies
    .split(";")
    .map((pair) => pair.trim())
    .some((pair) => {
      const separator = pair.indexOf("=");

      return (
        separator > 0 &&
        pair.slice(0, separator) === name &&
        pair.slice(separator + 1) !== ""
      );
    });
};

/** The session data Peal's team reads beside a signed-in person's chat. */
export const sessionDataOf = (
  person: SupportPerson
): readonly (readonly [string, string])[] => [
  ["user_id", person.userId],
  ["workspace_id", person.workspaceId],
];

/** What the launcher hears of Crisp. */
export type CrispNews =
  | { readonly kind: "closed" }
  | { readonly kind: "failed" }
  | { readonly kind: "opened" }
  | { readonly kind: "unread"; readonly count: number };

type State = "failed" | "idle" | "loading" | "ready";

// Crisp is one per page, whatever the launchers: the docs' client router
// makes a new `<peal-support>` on each page it shows, in the same document.
let state: State = "idle";
let openWhenReady = false;
let identified: string | undefined;
const listeners = new Set<(news: CrispNews) => void>();

const tell = (news: CrispNews) => {
  for (const listener of listeners) {
    listener(news);
  }
};

// Before Crisp loads, `$crisp` is a plain array of commands, which its
// loader plays once it starts; then Crisp's own object.
const queue = (): CrispQueue => {
  if (window.$crisp !== undefined) {
    return window.$crisp;
  }

  const pending: CrispCommand[] = [];
  window.$crisp = pending;

  return pending;
};

const push = (...command: unknown[]) => {
  queue().push(command);
};

// Read as a number, without Effect: the launcher's script stays small.
const unreadCount = (): number => {
  const count = Number(window.$crisp?.get?.("chat:unread:count") ?? 0);

  return Number.isInteger(count) && count > 0 ? count : 0;
};

/** Listens to Crisp; the returned function stops. */
export const listen = (listener: (news: CrispNews) => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/** Whether Crisp is loaded and its session ready. */
export const crispReady = (): boolean => state === "ready";

// Whether the launcher asked for the chat: Crisp brings back a chat left
// open on an earlier page by itself, which is closed again, so the chat
// opens only when someone presses the launcher.
let asked = false;

// Crisp tells `chat:opened` only when the chat was closed: one it kept
// open shows without it, so the launcher is told.
const show = () => {
  const alreadyOpen = window.$crisp?.is?.("chat:opened") === true;

  asked = true;
  push("do", "chat:show");
  push("do", "chat:open");

  if (alreadyOpen) {
    tell({ kind: "opened" });
  }
};

const closeUnasked = () => {
  if (!asked && window.$crisp?.is?.("chat:opened") === true) {
    push("do", "chat:close");
  }
};

/**
 * Loads Crisp, hidden, in `locale`. Once its session is ready, the chat
 * opens when it was asked to, and the launcher hears how many messages
 * wait unread.
 */
export const startCrisp = (websiteId: string, locale: string): void => {
  if (state !== "idle") {
    return;
  }

  state = "loading";
  window.CRISP_COOKIE_EXPIRE = conversationCookieSeconds;
  window.CRISP_WEBSITE_ID = websiteId;
  window.CRISP_RUNTIME_CONFIG = { locale };
  push("safe", true);
  push("do", "chat:hide");
  push("on", "session:loaded", () => {
    state = "ready";

    if (openWhenReady) {
      openWhenReady = false;
      show();
    } else {
      closeUnasked();
      tell({ count: unreadCount(), kind: "unread" });
    }
  });
  push("on", "chat:opened", () => {
    if (asked) {
      tell({ kind: "opened" });
    } else {
      closeUnasked();
    }
  });
  push("on", "chat:closed", () => {
    asked = false;
    push("do", "chat:hide");
    tell({ kind: "closed" });
  });
  push("on", "message:received", () => {
    tell({ count: unreadCount(), kind: "unread" });
  });

  const script = document.createElement("script");
  script.src = crispScript;
  script.async = true;
  script.addEventListener("error", () => {
    state = "failed";
    openWhenReady = false;
    tell({ kind: "failed" });
  });
  document.head.append(script);
};

/** Opens the chat, loading Crisp first where it is not yet. */
export const openCrisp = (websiteId: string, locale: string): void => {
  if (state === "ready") {
    show();

    return;
  }

  if (state === "failed") {
    // A blocker refused the script: the next press tries again.
    state = "idle";

    for (const script of document.querySelectorAll(
      `script[src="${crispScript}"]`
    )) {
      script.remove();
    }
  }

  openWhenReady = true;
  startCrisp(websiteId, locale);
};

/** Closes the chat, which then hides again. */
export const closeCrisp = (): void => {
  if (state === "ready") {
    push("do", "chat:close");
  }
};

/**
 * Names the signed-in person to Peal's team. Another person than the one
 * the chat last named starts a conversation of their own.
 */
export const identify = (person: SupportPerson): void => {
  if (identified !== undefined && identified !== person.userId) {
    push("do", "session:reset");
  }

  identified = person.userId;
  push("set", "user:email", [person.email]);
  push("set", "user:nickname", [person.name]);
  push("set", "session:data", [sessionDataOf(person)]);
};

/**
 * Forgets the conversation in this browser, at sign-out: through Crisp
 * where it is loaded, otherwise by expiring its cookie, which Crisp keeps
 * on the page's host or its parent domains.
 */
export const forgetConversation = (): void => {
  identified = undefined;

  if (state === "ready") {
    push("do", "session:reset");

    return;
  }

  const labels = location.hostname.split(".");

  // js-cookie reads and writes names decoded: Crisp's slashes come back
  // encoded as Crisp has them.
  for (const name of Object.keys(Cookies.get())) {
    if (name.startsWith(conversationCookiePrefix)) {
      Cookies.remove(name, { path: "/" });

      for (let index = 0; index < labels.length - 1; index += 1) {
        Cookies.remove(name, {
          domain: labels.slice(index).join("."),
          path: "/",
        });
      }
    }
  }
};
