"use client";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import type { Billing, Platform } from "peal-contract";
import { useMemo, useState, useSyncExternalStore } from "react";

import { billingOf } from "#billing/api.ts";
import { connectablePlatformsOf } from "#channels/channels-api.ts";
import {
  connectedCount,
  failedCount,
  forgetRun,
  nextStep,
  recordStep,
  runOf,
  runOfSnapshot,
  runSnapshot,
  saveRun,
  subscribeToRun,
} from "#channels/connect-run.ts";
import type { ConnectRun } from "#channels/connect-run.ts";
import {
  openSignInTab,
  useRunStep,
  useStepOpen,
} from "#channels/use-run-step.ts";
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
import { useRouter } from "#i18n/navigation.ts";

import { SetupCardView } from "./setup-card-view.tsx";

const noRun = () => null;

// The card's one way to start a sign-in, so it reads as pending from the
// click until the tab leaves, whichever state the card has moved to.
type RunStepper = ReturnType<typeof useRunStep>;

interface ChooseProps {
  readonly billing: Billing | null;
  readonly connectable: Connectable;
  readonly hidden: readonly Platform[];
  readonly step: RunStepper;
  readonly workspaceId: string;
}

const Choose = ({
  billing,
  connectable,
  hidden,
  step,
  workspaceId,
}: ChooseProps) => {
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const options = setupOptionsOf(connectable, hidden);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});

  return (
    <SetupCardView
      homeHref={workspaceHref(workspaceId)}
      isPending={step.isPending}
      link={AppLink}
      newChannelHref={workspaceHref(workspaceId, "/channels/new")}
      state={{
        _tag: "choose",
        cost: billing === null ? null : setupCostOf(billing, ticked.length),
        onConnect: () => {
          const run = runOf(workspaceId, stepsOf(options, ticked, typed));

          saveRun(run);
          step.start(run, openSignInTab());
        },
        onDismiss: () => {
          router.push(workspaceHref(workspaceId));
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

const Run = ({
  run,
  step,
}: {
  readonly run: ConnectRun;
  readonly step: RunStepper;
}) => {
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const next = nextStep(run);
  const home = workspaceHref(run.workspaceId);

  return (
    <SetupCardView
      homeHref={home}
      isPending={step.isPending}
      link={AppLink}
      newChannelHref={workspaceHref(run.workspaceId, "/channels/new")}
      state={
        next === null
          ? {
              _tag: "done",
              connected: connectedCount(run),
              failed: failedCount(run),
              onStartOver: forgetRun,
              run,
            }
          : {
              _tag: "running",
              next,
              onContinue: () => {
                step.start(run, openSignInTab());
              },
              onSkip: () => {
                recordStep(run, next.platform, { _tag: "skipped" });
              },
              onStop: () => {
                forgetRun();
                router.push(home);
              },
              run,
            }
      }
      writePostHref={workspaceHref(run.workspaceId, "/posts/new")}
    />
  );
};

/**
 * A new workspace's second setup step (DESIGN.md, the frame's `setup`):
 * the platforms to tick and the run this tab started, kept in the tab's
 * storage, so the page shows once it has hydrated. Every way off it
 * (Skip for now, Stop, the end) leads to the workspace's home.
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
  const step = useRunStep();

  useStepOpen();
  const snapshot = useSyncExternalStore(subscribeToRun, runSnapshot, noRun);
  const run = useMemo(() => runOfSnapshot(snapshot), [snapshot]);
  const connectable = useAtomValue(connectablePlatformsOf(workspaceId));

  if (!hydrated) {
    return null;
  }

  if (run !== null && run.workspaceId === workspaceId) {
    return <Run run={run} step={step} />;
  }

  if (!AsyncResult.isSuccess(connectable)) {
    return null;
  }

  return mayReadBilling ? (
    <ChooseWithBilling
      connectable={connectable.value}
      hidden={hidden}
      step={step}
      workspaceId={workspaceId}
    />
  ) : (
    <Choose
      billing={null}
      connectable={connectable.value}
      hidden={hidden}
      step={step}
      workspaceId={workspaceId}
    />
  );
};
