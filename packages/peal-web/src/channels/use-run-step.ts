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

/**
 * Starts a setup run's next sign-in and leaves for the platform. A refusal
 * (a Mastodon server that does not answer, no room in the plan) is kept as
 * the step's outcome and handed to `onRefused` with the run after it, so
 * the member continues from the setup step; `offerUpgrade` opens the plan's dialog
 * where the page has one to show it in.
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

  const start = (run: ConnectRun) => {
    const step = nextStep(run);

    if (step === null) {
      return;
    }

    startTransition(async () => {
      const exit = await connect({
        params: { platform: step.platform, workspaceId: run.workspaceId },
        payload: startOf(step),
      });

      if (exit._tag === "Success") {
        rememberConnection({
          platform: step.platform,
          workspaceId: run.workspaceId,
        });
        globalThis.location.assign(exit.value.authorizationUrl);

        return;
      }

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
