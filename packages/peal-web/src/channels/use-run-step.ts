"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { useTransition } from "react";

import { connectChannel, failureOf } from "#channels/channels-api.ts";
import {
  nextStep,
  recordStep,
  runErrorOf,
  startOf,
} from "#channels/connect-run.ts";
import type { ConnectRun } from "#channels/connect-run.ts";
import { rememberConnection } from "#channels/pending-connection.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";

// The name of the tab a run's sign-ins happen in: opening it again reuses
// it, so a member never collects a tab per platform.
const signInTab = "peal-sign-in";

/**
 * Opens the tab a run's sign-ins happen in, from a click (browsers open a
 * tab only then), blank until its sign-in starts; none where the browser
 * refuses, and the step's own tab then leaves for the platform.
 */
export const openSignInTab = (): Window | null => {
  try {
    return globalThis.open("", signInTab);
  } catch {
    return null;
  }
};

/**
 * Leaves the tab a run's sign-in came back to, once the run ends or stops
 * there: it closes, where the step opened it, and the step's own tab shows
 * the run; a tab the browser does not let close (the step's own, when the
 * browser refused a tab) goes to the step with `fallback`.
 */
export const leaveSignInTab = (fallback: () => void): void => {
  globalThis.close();
  globalThis.setTimeout(fallback, 300);
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
        params: { platform: step.platform, workspaceId: run.workspaceId },
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
