import "../../styles/support.css";
import { defaultLocale, locales } from "../site/locales";
import type { Locale } from "../site/locales";
import {
  closeCrisp,
  hasConversation,
  identify,
  listen,
  openCrisp,
  startCrisp,
} from "./crisp";
import type { CrispNews } from "./crisp";
import { listenToSupportOpen, tellSupportUnread } from "./events";
import { createLauncherArt } from "./launcher-art";
import type { LauncherArt, LauncherState } from "./launcher-art";
import { launcherLabel, supportMessages } from "./messages";
import type { SupportPerson, SupportPlacement } from "./settings";

// `<peal-support>`, the support chat's launcher (DESIGN.md, "Support
// chat"): a pixel speech bubble at the bottom right that opens Crisp's
// chat, which loads only then. Built in its light DOM, so the page's
// styles and fonts apply. Any `[data-support-open]` on the page opens the
// chat too (the app's Help menu, the site's footer), keeping its own link
// for a click that opens a new tab.

// lucide's `message-circle` (ISC), as peal-ui's icons draw it: 16 px,
// stroke 1.75, in the text's colour.
const chatIconPath =
  "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719";

const svgNamespace = "http://www.w3.org/2000/svg";

const chatIcon = (): SVGSVGElement => {
  const svg = document.createElementNS(svgNamespace, "svg");

  for (const [name, value] of [
    ["viewBox", "0 0 24 24"],
    ["fill", "none"],
    ["stroke", "currentColor"],
    ["stroke-width", "1.75"],
    ["stroke-linecap", "round"],
    ["stroke-linejoin", "round"],
    ["aria-hidden", "true"],
    ["class", "peal-support__icon"],
  ] as const) {
    svg.setAttribute(name, value);
  }

  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", chatIconPath);
  svg.append(path);

  return svg;
};

// Where the launcher stands: floating, in a bar, or, in the app, nowhere
// to see, the account menu's Support opening the chat.
const placementOf = (value: string | undefined): SupportPlacement =>
  value === "bar" || value === "menu" ? value : "float";

// The count on the pixel bubble's tile, which holds two characters.
const countOf = (unread: number) => (unread > 9 ? "9+" : String(unread));

const localeOf = (value: string | undefined): Locale =>
  locales.find((locale) => locale === value) ?? defaultLocale;

const presentOrUndefined = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
};

/** The launcher, which start.ts (or the app) defines once a page needs it. */
export class PealSupport extends HTMLElement {
  static readonly observedAttributes = [
    "data-website-id",
    "data-email",
    "data-name",
    "data-user-id",
    "data-workspace-id",
  ];

  #art: LauncherArt | undefined;
  #button: HTMLButtonElement | undefined;
  #badge: HTMLSpanElement | undefined;
  #hovered = false;
  #loading = false;
  #open = false;
  #returnFocus = false;
  #stop: (() => void) | undefined;
  #unread = 0;

  get #websiteId(): string | undefined {
    return presentOrUndefined(this.dataset["websiteId"]);
  }

  get #locale(): Locale {
    return localeOf(this.dataset["locale"]);
  }

  connectedCallback(): void {
    this.#start();
  }

  disconnectedCallback(): void {
    this.#dismissible(false);
    this.#stop?.();
    this.#stop = undefined;
    this.#art?.dispose();
    this.#art = undefined;
    this.#button?.remove();
    this.#button = undefined;
    this.#badge = undefined;
    document.removeEventListener("click", this.#opens);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.#start();
      this.#identify();
    }
  }

  // Once connected with a website: an element made by script may get it
  // after it was attached.
  #start() {
    const websiteId = this.#websiteId;

    if (websiteId === undefined || this.#button !== undefined) {
      return;
    }

    this.#build();
    const stopHearing = listen(this.#hear);

    const stopOpening = listenToSupportOpen(() => {
      this.open();
    });

    this.#stop = () => {
      stopHearing();
      stopOpening();
    };

    document.addEventListener("click", this.#opens);
    this.#identify();

    // Someone who already wrote sees the replies waiting for them.
    if (hasConversation(document.cookie, websiteId)) {
      startCrisp(websiteId, this.#locale);
    }
  }

  /** Opens the chat, loading Crisp first where it is not yet. */
  open(): void {
    const websiteId = this.#websiteId;

    if (websiteId === undefined) {
      return;
    }

    this.#loading = true;
    this.#returnFocus = this.contains(document.activeElement);
    this.#show();
    openCrisp(websiteId, this.#locale);
  }

  #person(): SupportPerson | undefined {
    const email = presentOrUndefined(this.dataset["email"]);
    const userId = presentOrUndefined(this.dataset["userId"]);
    const workspaceId = presentOrUndefined(this.dataset["workspaceId"]);

    return email === undefined ||
      userId === undefined ||
      workspaceId === undefined
      ? undefined
      : {
          email,
          name: presentOrUndefined(this.dataset["name"]) ?? email,
          userId,
          workspaceId,
        };
  }

  #identify() {
    const person = this.#person();

    if (person !== undefined) {
      identify(person);
    }
  }

  #build() {
    if (this.#button !== undefined) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "peal-support";
    button.dataset["placement"] = placementOf(this.dataset["placement"]);

    const pixel = this.dataset["art"] === "pixel";
    button.dataset["art"] = pixel ? "pixel" : "icon";

    const badge = document.createElement("span");
    badge.className = "peal-support__badge";
    badge.setAttribute("aria-hidden", "true");
    badge.hidden = true;

    if (pixel) {
      const canvas = document.createElement("canvas");
      canvas.className = "peal-support__art";
      canvas.setAttribute("aria-hidden", "true");
      button.append(canvas, badge);
      this.#art = createLauncherArt(canvas);
    } else {
      button.append(chatIcon(), badge);
    }

    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      if (this.#open) {
        closeCrisp();
      } else {
        this.open();
      }
    });

    const hover = (on: boolean) => () => {
      this.#hovered = on;
      this.#show();
    };

    button.addEventListener("pointerenter", hover(true));
    button.addEventListener("pointerleave", hover(false));
    button.addEventListener("focus", hover(true));
    button.addEventListener("blur", hover(false));

    this.append(button);
    this.#button = button;
    this.#badge = badge;
    this.#show();
  }

  #state(): LauncherState {
    if (this.#loading) {
      return "loading";
    }

    if (this.#unread > 0) {
      return "unread";
    }

    return this.#hovered ? "active" : "idle";
  }

  #show() {
    const button = this.#button;
    const badge = this.#badge;

    if (button === undefined || badge === undefined) {
      return;
    }

    const t = supportMessages[this.#locale];
    button.setAttribute(
      "aria-label",
      this.#loading ? t.opening : launcherLabel(t, this.#unread)
    );
    button.setAttribute("aria-busy", String(this.#loading));
    button.setAttribute("aria-expanded", String(this.#open));
    badge.hidden = this.#unread === 0;
    // The pixel bubble shows the count; the icon a dot, as the app's
    // account shows unread notifications.
    badge.textContent = this.#art === undefined ? "" : countOf(this.#unread);
    this.#art?.set(this.#state());
  }

  readonly #hear = (news: CrispNews) => {
    switch (news.kind) {
      case "opened": {
        this.#loading = false;
        this.#unread = 0;
        this.#open = true;
        this.#dismissible(true);
        break;
      }

      case "closed": {
        this.#open = false;
        this.#dismissible(false);

        if (this.#returnFocus) {
          this.#button?.focus();
        }

        break;
      }

      case "failed": {
        this.#loading = false;
        break;
      }

      case "unread": {
        this.#unread = news.count;
        break;
      }

      default: {
        break;
      }
    }

    this.#show();
    tellSupportUnread(this.#unread);
  };

  // While the chat is open, Escape or a press outside it closes it, as a
  // popover does: Crisp's window has no close of its own on a computer.
  #dismissible(on: boolean) {
    if (on) {
      document.addEventListener("keydown", this.#onKey);
      document.addEventListener("pointerdown", this.#onPointer, true);
    } else {
      document.removeEventListener("keydown", this.#onKey);
      document.removeEventListener("pointerdown", this.#onPointer, true);
    }
  }

  readonly #onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.#returnFocus = true;
      closeCrisp();
    }
  };

  readonly #onPointer = (event: PointerEvent) => {
    const inside =
      event.target instanceof Element &&
      (event.target.closest(".crisp-client") !== null ||
        this.contains(event.target));

    if (!inside) {
      closeCrisp();
    }
  };

  readonly #opens = (event: MouseEvent) => {
    const opener =
      event.target instanceof Element
        ? event.target.closest("[data-support-open]")
        : null;

    // A click that opens a new tab or window keeps its link's own way.
    const modified =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;

    if (opener === null || modified) {
      return;
    }

    event.preventDefault();
    this.open();
  };
}

if (customElements.get("peal-support") === undefined) {
  customElements.define("peal-support", PealSupport);
}
