"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { forWorkspace } from "peal-contract";
import { useEffect, useTransition } from "react";

import { connectChannel, failureOf } from "#channels/channels-api.ts";
import {
  nextStep,
  recordStep,
  runErrorOf,
  startOf,
} from "#channels/connect-run.ts";
import type { ConnectRun } from "#channels/connect-run.ts";
import {
  forgetConnection,
  rememberConnection,
} from "#channels/pending-connection.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";

// The name of the tab a run's sign-ins happen in: opening it again reuses
// it, so a member never collects a tab per platform.
const signInTab = "peal-sign-in";

const openBlankTab = (): Window | null => {
  try {
    return globalThis.open("", signInTab);
  } catch {
    return null;
  }
};

// Takes the tab's way back to this one, which only a tab of this origin
// (a blank one) lets set: whether it did.
const cutOff = (tab: Window): boolean => {
  try {
    tab.opener = null;

    return true;
  } catch {
    return false;
  }
};

/**
 * Opens the tab a run's sign-ins happen in, from a click (browsers open a
 * tab only then), blank until its sign-in starts; none where the browser
 * refuses, and the step's own tab then leaves for the platform.
 *
 * The tab goes to other sites' pages (a platform's, any Mastodon server a
 * member names), so it keeps no `opener`: a page there could otherwise
 * send this signed-in tab elsewhere. The handle stays, for
 * `location.assign` and `close()`.
 */
export const openSignInTab = (): Window | null => {
  // A tab opened from this one starts with a copy of its storage: a
  // connection it remembers from before would name another workspace to
  // the callback page there.
  forgetConnection();

  const tab = openBlankTab();

  if (tab === null || cutOff(tab)) {
    return tab;
  }

  // A tab of that name left on another site's page (an earlier run's)
  // refuses it: it closes, and the tab opened in its place is blank, of
  // this origin. Where that one cannot be cut off either, or the browser
  // opens no second tab from the click, the step's own tab leaves instead.
  tab.close();

  const again = openBlankTab();

  if (again === null || cutOff(again)) {
    return again;
  }

  again.close();

  return null;
};

/**
 * Leaves the tab a run's sign-in came back to, once the run ends or stops
 * there: it closes, where the step opened it, and the step's own tab shows
 * the run. A tab the browser does not let close (the step's own, when the
 * browser refused a tab) loads the step at `href` as a new page: a tab
 * that refused `close()` may answer no storage until it loads one.
 */
export const leaveSignInTab = (href: string): void => {
  // Closing the last tab of Peal would leave the member nowhere: the tab
  // closes only while the step is open in another (`useStepOpen`).
  if (isStepOpen()) {
    globalThis.close();
  }

  globalThis.setTimeout(() => {
    globalThis.location.replace(href);
  }, 300);
};

// Where the step says it is open, with when it last said so: a step tab
// the browser left in the background renews it seldom (hidden tabs run
// their timers about once a minute), and one that crashed never clears it.
const stepOpenKey = "peal.channels.setup-step-open";
const stepOpenFor = 3 * 60 * 1000;
const stepOpenEvery = 20 * 1000;

const localStore = (): Storage | null => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const isStepOpen = (): boolean => {
  const said = Number(localStore()?.getItem(stepOpenKey) ?? "0");

  return Date.now() - said < stepOpenFor;
};

/**
 * Says, while the setup step shows, that it is open, so a sign-in tab
 * that finishes may close itself; leaving the page takes it back.
 */
export const useStepOpen = (): void => {
  useEffect(() => {
    const say = () => {
      localStore()?.setItem(stepOpenKey, String(Date.now()));
    };

    const unsay = () => {
      localStore()?.removeItem(stepOpenKey);
    };

    say();

    const timer = globalThis.setInterval(say, stepOpenEvery);

    globalThis.addEventListener("pagehide", unsay);

    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener("pagehide", unsay);
      unsay();
    };
  }, []);
};

/**
 * Starts a setup run's next sign-in: in `tab`, a tab of its own the step
 * opened from the click, or, without one, in this tab, which leaves for
 * the platform. A refusal (a Mastodon server that does not answer, no
 * room in the plan) is kept as the step's outcome, closes that tab and is
 * handed to `onRefused` with the run after it, so the member continues
 * from the step; `offerUpgrade` opens the plan's dialog where the page has
 * one to show it in.
 */
export const useRunStep = ({
  offerUpgrade = true,
  onRefused,
}: {
  readonly offerUpgrade?: boolean;
  readonly onRefused?: (run: ConnectRun) => void;
} = {}) => {
  const connect = useAtomSet(connectChannel, { mode: "promiseExit" });
  const offer = useOfferUpgrade();
  const [isPending, startTransition] = useTransition();

  const start = (run: ConnectRun, tab: Window | null = null) => {
    const step = nextStep(run);

    if (step === null) {
      tab?.close();

      return;
    }

    startTransition(async () => {
      const exit = await connect({
        headers: forWorkspace(run.workspaceId),
        params: { platform: step.platform },
        payload: startOf(step),
      });

      if (exit._tag === "Success") {
        if (tab === null) {
          rememberConnection({
            platform: step.platform,
            workspaceId: run.workspaceId,
          });
          globalThis.location.assign(exit.value.authorizationUrl);
        } else {
          // The tab finds the run's workspace when the platform sends it
          // back (`runWorkspaceFor`).
          tab.location.assign(exit.value.authorizationUrl);
        }

        return;
      }

      tab?.close();

      const after = recordStep(run, step.platform, {
        _tag: "failed",
        error: runErrorOf(
          Option.getOrElse(failureOf(exit), () => "unknown" as const)
        ),
      });

      if (offerUpgrade) {
        offer(exit, run.workspaceId);
      }

      onRefused?.(after);
    });
  };

  return { isPending, start };
};
