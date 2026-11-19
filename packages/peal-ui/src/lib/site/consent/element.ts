import "../../../styles/consent.css";
import Cookies from "js-cookie";

import { defaultLocale, locales } from "../locales";
import type { Locale } from "../locales";
import { browserSignals, dayOf, givenAnswerOf, modeOf } from "./answer";
import { ConsentAnswered } from "./consent-answered";
import {
  artCellSize,
  createCookieArt,
  drawCells,
  exitMs,
  gridSize,
  smallFrame,
} from "./cookie-art";
import type { CookieArt } from "./cookie-art";
import { answerCookie } from "./cookies";
import { forgetVisitor } from "./forget";
import { consentMessages } from "./messages";
import type { ConsentMessages } from "./messages";

// `<peal-consent>`, the consent notice of the site, the docs and the blog
// (DESIGN.md, Site): a region, not a dialog, fixed to the bottom right
// (a sheet along the bottom on a phone). It asks once, takes no focus
// when it does, and leaves once answered; `[data-consent-open]` (Cookie
// settings) opens it again with the answer and its date. Built with
// `document.createElement` in its light DOM, so the page's own styles and
// fonts apply.

const element = <Name extends keyof HTMLElementTagNameMap>(
  name: Name,
  className: string,
  text?: string
): HTMLElementTagNameMap[Name] => {
  const made = document.createElement(name);
  made.className = className;

  if (text !== undefined) {
    made.textContent = text;
  }

  return made;
};

const localeOf = (value: string | undefined): Locale =>
  locales.find((locale) => locale === value) ?? defaultLocale;

const presentOrUndefined = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
};

// Whether a notice already asked in this document: the docs' client router
// shows each page in the same one, where the notice asks again, still.
let asked = false;

// The phone's still cookie, beside the title: 5 cells of 7 px.
const smallCellSize = 7;

// Below this width the notice is a sheet along the bottom edge.
const phone = "(max-width: 639.98px)";

// The card starts leaving this long before the art's exit ends.
const leaveMs = 200;

/** The notice, which start.ts defines once a page needs it. */
export class PealConsent extends HTMLElement {
  #art: CookieArt | undefined;
  #built = false;
  #busy = false;
  #messages: ConsentMessages = consentMessages[defaultLocale];
  #opener: HTMLElement | undefined;
  #parts:
    | {
        readonly actions: HTMLDivElement;
        readonly canvas: HTMLCanvasElement;
        readonly close: HTMLButtonElement;
        readonly live: HTMLSpanElement;
        readonly readout: HTMLSpanElement;
        readonly region: HTMLElement;
        readonly status: HTMLParagraphElement;
        readonly text: HTMLSpanElement;
        readonly title: HTMLHeadingElement;
      }
    | undefined;
  #pointed: "allow" | "refuse" | undefined;
  #focused: "allow" | "refuse" | undefined;
  #resize: ResizeObserver | undefined;

  connectedCallback(): void {
    this.#build();
  }

  disconnectedCallback(): void {
    this.#art?.dispose();
    this.#art = undefined;
    this.#stopSizing();
    document.removeEventListener("keydown", this.#onKey);
  }

  /**
   * Shows the notice to a visitor who has not answered: no focus taken.
   * It bakes in once a page session; the docs' next pages ask still.
   */
  ask(): void {
    this.#show(undefined, !asked);
    asked = true;
  }

  /** Opens it from Cookie settings: the answer, its date, and Close. */
  open(opener: HTMLElement): void {
    this.#show(opener, true);
  }

  #build() {
    if (this.#built) {
      return;
    }

    this.#built = true;
    const locale = localeOf(this.dataset["locale"]);
    const t = consentMessages[locale];
    this.#messages = t;
    const id = `peal-consent-title-${Math.random().toString(36).slice(2)}`;

    const region = element("section", "peal-consent");
    region.setAttribute("role", "region");
    region.setAttribute("aria-labelledby", id);
    region.dataset["state"] = "hidden";
    region.hidden = true;

    // Close, in the corner, when the notice was opened from Cookie settings.
    const close = element("button", "peal-consent__close", t.close);
    close.type = "button";
    close.hidden = true;
    close.addEventListener("click", () => {
      this.#hide();
    });

    const art = element("div", "peal-consent__art");
    art.setAttribute("aria-hidden", "true");
    const canvas = element("canvas", "peal-consent__canvas");
    canvas.style.width = `${String(gridSize * artCellSize)}px`;
    canvas.style.height = `${String(gridSize * artCellSize)}px`;
    // The three readouts in one cell, one shown: the column keeps the
    // widest one's width, so the text never moves.
    const readout = element("span", "peal-consent__readout");
    readout.dataset["shown"] = "rest";

    for (const key of ["rest", "allow", "refuse"] as const) {
      const line = element(
        "span",
        "peal-consent__readout-line",
        t.readout[key]
      );

      line.dataset["readout"] = key;
      readout.append(line);
    }

    art.append(canvas, readout);

    const body = element("div", "peal-consent__body");
    const titleRow = element("div", "peal-consent__title-row");
    const small = element("canvas", "peal-consent__small");
    small.setAttribute("aria-hidden", "true");
    small.style.width = `${String(5 * smallCellSize)}px`;
    small.style.height = `${String(5 * smallCellSize)}px`;
    const title = element("h2", "peal-consent__title", t.title);
    title.id = id;
    title.tabIndex = -1;
    titleRow.append(small, title);

    // The text, then the privacy policy's link on the same line.
    const paragraph = element("p", "peal-consent__text");
    const text = element("span", "", t.text);
    paragraph.append(text);

    const policy = presentOrUndefined(this.dataset["policy"]);

    if (policy !== undefined) {
      const link = element("a", "peal-consent__policy", t.policy);
      link.href = policy;
      paragraph.append(" ", link);
    }

    const status = element("p", "peal-consent__status");
    status.hidden = true;
    body.append(titleRow, paragraph, status);

    // The two answers, equally weighted: the same outline button, side by
    // side and equally wide, Allow first, as the app's consent card has them.
    const actions = element("div", "peal-consent__actions");

    for (const answer of ["allow", "refuse"] as const) {
      const button = element(
        "button",
        "peal-consent__answer",
        answer === "allow" ? t.allow : t.refuse
      );

      button.type = "button";
      button.addEventListener("click", () => {
        void this.#answer(answer === "allow" ? "allowed" : "refused");
      });
      button.addEventListener("pointerenter", () => {
        this.#pointed = answer;
        this.#preview();
      });
      button.addEventListener("pointerleave", () => {
        this.#pointed = undefined;
        this.#preview();
      });
      button.addEventListener("focus", () => {
        this.#focused = answer;
        this.#preview();
      });
      button.addEventListener("blur", () => {
        this.#focused = undefined;
        this.#preview();
      });
      actions.append(button);
    }

    region.append(art, body, actions, close);

    // Outside the region, so it is still heard once the notice is hidden.
    const live = element("span", "peal-consent__live");
    live.setAttribute("aria-live", "polite");

    this.append(region, live);
    drawCells(small, smallFrame, 5, smallCellSize);
    this.#parts = {
      actions,
      canvas,
      close,
      live,
      readout,
      region,
      status,
      text,
      title,
    };
  }

  #preview() {
    const parts = this.#parts;
    const shown = this.#pointed ?? this.#focused;

    if (parts === undefined || this.#busy) {
      return;
    }

    parts.readout.dataset["shown"] = shown ?? "rest";
    this.#art?.preview(shown);
  }

  #show(opener: HTMLElement | undefined, animate: boolean) {
    this.#build();
    const parts = this.#parts;

    if (parts === undefined || this.#busy) {
      return;
    }

    const t = this.#messages;
    const today = dayOf(Date.now());
    const given = givenAnswerOf(document.cookie, today);

    const signalled =
      modeOf({
        answer: "none",
        configured: true,
        signals: browserSignals(navigator),
      }) === "off";

    this.#opener = opener;
    parts.close.hidden = opener === undefined;
    parts.actions.hidden = signalled;

    // A browser that asks not to be followed keeps nothing of an earlier
    // visit either: the visitor's cookie and PostHog's copy of the answer go.
    const key = presentOrUndefined(this.dataset["key"]);

    if (signalled && key !== undefined) {
      forgetVisitor(key, true);
    }

    parts.text.textContent = signalled ? t.signal : t.text;

    if (opener !== undefined && given !== undefined && !signalled) {
      const date = new Intl.DateTimeFormat(localeOf(this.dataset["locale"]), {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(given.day * 86_400_000));

      parts.status.textContent = (
        given.answer === "allowed" ? t.allowed : t.refused
      ).replace("{date}", date);
      parts.status.hidden = false;
    } else {
      parts.status.hidden = true;
    }

    const wasHidden = parts.region.hidden !== false;
    parts.region.hidden = false;
    parts.readout.dataset["shown"] = "rest";

    this.#art ??= createCookieArt(parts.canvas);

    if (wasHidden && !animate) {
      parts.region.dataset["state"] = "shown";
    } else if (wasHidden) {
      parts.region.dataset["state"] = "entering";
      this.#art.bake();
      // One frame at the start position, then the rise.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          parts.region.dataset["state"] = "shown";
        });
      });
    }

    this.#startSizing();

    if (opener !== undefined) {
      document.addEventListener("keydown", this.#onKey);
      parts.title.focus();
    }
  }

  readonly #onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.#opener !== undefined && !this.#busy) {
      this.#hide();
    }
  };

  async #answer(answer: "allowed" | "refused") {
    const parts = this.#parts;

    if (parts === undefined || this.#busy) {
      return;
    }

    this.#busy = true;
    const domain = presentOrUndefined(this.dataset["cookieDomain"]);

    // The one place the answer is written: the site, the docs and the blog
    // read it, and measurement follows it.
    const cookie = answerCookie(
      answer,
      dayOf(Date.now()),
      domain,
      location.protocol === "https:"
    );

    Cookies.set(cookie.name, cookie.value, cookie.attributes);
    window.dispatchEvent(new ConsentAnswered(answer));
    parts.readout.dataset["shown"] = answer === "allowed" ? "allow" : "refuse";

    // Announced once the region's contents settle.
    parts.live.textContent = "";
    setTimeout(() => {
      parts.live.textContent = this.#messages.saved;
    }, 100);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!still) {
      // The same length for both answers, on a phone too, where the art
      // is hidden and the card alone leaves.
      this.#art?.exit(answer);

      const leaving = setTimeout(() => {
        parts.region.dataset["state"] = "leaving";
      }, exitMs - leaveMs);

      await parts.region
        .animate([], { duration: exitMs })
        .finished.catch(() => null);
      clearTimeout(leaving);
    }

    this.#busy = false;
    this.#hide();
  }

  #hide() {
    const parts = this.#parts;

    if (parts === undefined) {
      return;
    }

    // Where focus goes once the notice hides, when it was inside: back to
    // what opened it, or to Cookie settings, where the answer changes,
    // never lost to the page's body.
    const hadFocus = parts.region.contains(document.activeElement);
    const opener = this.#opener;
    this.#opener = undefined;

    parts.region.hidden = true;
    parts.region.dataset["state"] = "hidden";
    this.#pointed = undefined;
    this.#focused = undefined;
    this.#stopSizing();
    document.removeEventListener("keydown", this.#onKey);

    const target =
      opener ??
      document.querySelector<HTMLElement>("[data-consent-open]") ??
      undefined;

    if (opener !== undefined || hadFocus) {
      target?.focus({ preventScroll: true });
    }
  }

  // While shown on a phone, the page's foot gains the sheet's height, so
  // the footer stays reachable above it.
  #startSizing() {
    const region = this.#parts?.region;

    if (region === undefined || this.#resize !== undefined) {
      return;
    }

    const root = document.documentElement;

    this.#resize = new ResizeObserver(() => {
      if (window.matchMedia(phone).matches) {
        root.style.setProperty(
          "--peal-consent-height",
          `${String(Math.ceil(region.getBoundingClientRect().height))}px`
        );
      } else {
        root.style.removeProperty("--peal-consent-height");
      }
    });
    this.#resize.observe(region);
  }

  #stopSizing() {
    this.#resize?.disconnect();
    this.#resize = undefined;
    document.documentElement.style.removeProperty("--peal-consent-height");
  }
}

if (customElements.get("peal-consent") === undefined) {
  customElements.define("peal-consent", PealConsent);
}
