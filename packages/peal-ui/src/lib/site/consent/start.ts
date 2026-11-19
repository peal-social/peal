import { answerOf, browserSignals, dayOf, modeOf } from "./answer";
import type { PealConsent } from "./element";

// The one script the site's, the docs' and the blog's layouts load up
// front, within 2 kB: without a `<peal-consent>` on the page (measurement
// not configured) it does nothing. Otherwise it loads the notice when it
// must show, or when Cookie settings is clicked, and measurement once the
// page is idle, unless the browser asks not to be followed.

const loadNotice = async (): Promise<PealConsent | undefined> => {
  await import("./element");

  return document.querySelector<PealConsent>("peal-consent") ?? undefined;
};

const whenIdle = (run: () => void) => {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1);
  }
};

let measuring = false;
let listening = false;

const opens = (event: MouseEvent) => {
  const opener =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-consent-open]")
      : null;

  if (opener === null || document.querySelector("peal-consent") === null) {
    return;
  }

  event.preventDefault();
  void loadNotice().then((notice) => notice?.open(opener));
};

const measure = async (notice: HTMLElement) => {
  const { startMeasurement } = await import("../measurement/start");

  await startMeasurement(notice);
};

const startPage = () => {
  const notice = document.querySelector<HTMLElement>("peal-consent");

  if (notice === null) {
    return;
  }

  if (!listening) {
    listening = true;
    document.addEventListener("click", opens);
  }

  const answer = answerOf(document.cookie, dayOf(Date.now()));

  const mode = modeOf({
    answer,
    configured: true,
    signals: browserSignals(navigator),
  });

  if (mode === "off") {
    return;
  }

  if (answer === "none") {
    void loadNotice().then((loaded) => loaded?.ask());
  }

  if (!measuring) {
    measuring = true;
    whenIdle(() => {
      void measure(notice);
    });
  }
};

// Once a page load, and again on each page the docs' client router shows.
document.addEventListener("astro:page-load", startPage);

startPage();
