"use client";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import type { Billing, Platform } from "peal-contract";
import { useMemo, useState, useSyncExternalStore } from "react";

import { billingOf } from "#billing/api.ts";
import { channelsOf, connectablePlatformsOf } from "#channels/channels-api.ts";
import {
  connectedCount,
  failedCount,
  forgetRun,
  nextStep,
  runOf,
  runOfSnapshot,
  runSnapshot,
  saveRun,
  subscribeToRun,
} from "#channels/connect-run.ts";
import type { ConnectRun } from "#channels/connect-run.ts";
import { useRunStep } from "#channels/use-run-step.ts";
import type { Connectable } from "#components/channels/connect-forms.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { AppLink } from "#components/shell/app-link.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import {
  isReady,
  setupCostOf,
  setupOptionsOf,
  stepsOf,
  xNeedsPayment,
} from "#home/setup.ts";

import { SetupCardView } from "./setup-card-view.tsx";

// Whether this browser answered Not now, per workspace: a convenience of
// the browser, as the agent's examples are, which Channels never needs.
const dismissedKey = (workspaceId: string) =>
  `peal.home.setup-dismissed.${workspaceId}`;

const dismissedChanged = "peal:home-setup";

const isDismissed = (workspaceId: string): boolean => {
  try {
    return window.localStorage.getItem(dismissedKey(workspaceId)) === "1";
  } catch {
    return false;
  }
};

const dismiss = (workspaceId: string): void => {
  try {
    window.localStorage.setItem(dismissedKey(workspaceId), "1");
  } catch {
    // Storage is closed to this page: the card comes back on the next visit.
  }

  window.dispatchEvent(new Event(dismissedChanged));
};

const subscribeDismissed = (listener: () => void) => {
  window.addEventListener(dismissedChanged, listener);

  return () => {
    window.removeEventListener(dismissedChanged, listener);
  };
};

// Before the page runs in the browser, the card is not shown.
const shownNowhere = () => true;

const noRun = () => null;

interface ChooseProps {
  readonly billing: Billing | null;
  readonly connectable: Connectable;
  readonly hidden: readonly Platform[];
  readonly workspaceId: string;
}

const Choose = ({ billing, connectable, hidden, workspaceId }: ChooseProps) => {
  const workspaceHref = useWorkspaceHref();
  const options = setupOptionsOf(connectable, hidden);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const step = useRunStep();

  if (options.length === 0) {
    return null;
  }

  return (
    <SetupCardView
      isPending={step.isPending}
      link={AppLink}
      newChannelHref={workspaceHref(workspaceId, "/channels/new")}
      state={{
        _tag: "choose",
        cost: billing === null ? null : setupCostOf(billing, ticked.length),
        onConnect: () => {
          const run = runOf(workspaceId, stepsOf(options, ticked, typed));

          saveRun(run);
          step.start(run);
        },
        onDismiss: () => {
          dismiss(workspaceId);
        },
        onToggle: (key, checked) => {
          setTicked((before) =>
            options
              .map((option) => option.key)
              .filter((each) =>
                each === key ? checked : before.includes(each)
              )
          );
        },
        onType: (key, value) => {
          setTyped((before) => ({ ...before, [key]: value }));
        },
        options,
        ready: isReady(options, ticked, typed),
        ticked,
        typed,
        xClosed: xNeedsPayment(billing),
      }}
      writePostHref={workspaceHref(workspaceId, "/posts/new")}
    />
  );
};

// The billing answer, for a member who may read it; none otherwise, and
// the card then says nothing of the cost.
const ChooseWithBilling = (props: Omit<ChooseProps, "billing">) => {
  const billing = useAtomValue(billingOf(props.workspaceId));

  return (
    <Choose
      {...props}
      billing={AsyncResult.isSuccess(billing) ? billing.value : null}
    />
  );
};

const Run = ({ run }: { readonly run: ConnectRun }) => {
  const workspaceHref = useWorkspaceHref();
  const step = useRunStep();
  const next = nextStep(run);

  return (
    <SetupCardView
      isPending={step.isPending}
      link={AppLink}
      newChannelHref={workspaceHref(run.workspaceId, "/channels/new")}
      state={
        next === null
          ? {
              _tag: "done",
              connected: connectedCount(run),
              failed: failedCount(run),
              onClose: forgetRun,
              run,
            }
          : {
              _tag: "running",
              next,
              onContinue: () => {
                step.start(run);
              },
              onStop: forgetRun,
              run,
            }
      }
      writePostHref={workspaceHref(run.workspaceId, "/posts/new")}
    />
  );
};

/**
 * The setup card on a workspace's home (DESIGN.md, Pages, Home): while the
 * workspace has no channel and this browser did not answer Not now, the
 * platforms to tick; while a run this tab started goes on, where it is.
 * Everything it reads needs the visitor's cookies or the browser's
 * storage, so it shows once the page has hydrated.
 */
export const SetupCard = ({
  hidden,
  mayReadBilling,
  workspaceId,
}: {
  /** The platforms the operator keeps off the card. */
  readonly hidden: readonly Platform[];
  readonly mayReadBilling: boolean;
  readonly workspaceId: string;
}) => {
  const hydrated = useHydrated();
  const snapshot = useSyncExternalStore(subscribeToRun, runSnapshot, noRun);
  const run = useMemo(() => runOfSnapshot(snapshot), [snapshot]);

  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    () => isDismissed(workspaceId),
    shownNowhere
  );

  const channels = useAtomValue(channelsOf(workspaceId));
  const connectable = useAtomValue(connectablePlatformsOf(workspaceId));

  if (!hydrated) {
    return null;
  }

  if (run !== null && run.workspaceId === workspaceId) {
    return <Run run={run} />;
  }

  if (
    dismissed ||
    !AsyncResult.isSuccess(channels) ||
    channels.value.length > 0 ||
    !AsyncResult.isSuccess(connectable)
  ) {
    return null;
  }

  return mayReadBilling ? (
    <ChooseWithBilling
      connectable={connectable.value}
      hidden={hidden}
      workspaceId={workspaceId}
    />
  ) : (
    <Choose
      billing={null}
      connectable={connectable.value}
      hidden={hidden}
      workspaceId={workspaceId}
    />
  );
};
