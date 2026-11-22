"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { constVoid } from "effect/Function";
import { useLocale, useTranslations } from "next-intl";
import type {
  ChannelConnection,
  ChoosableAccount,
  ConnectCallback,
  Platform,
} from "peal-contract";
import { Alert, AlertDescription, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import { completeConnection, failureOf } from "#channels/channels-api.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";
import {
  amended,
  currentRun,
  nextStep,
  recordStep,
  runAt,
  runErrorOf,
  runWorkspaceFor,
  saveRun,
} from "#channels/connect-run.ts";
import type { ConnectRun } from "#channels/connect-run.ts";
import {
  forgetConnection,
  pendingWorkspace,
} from "#channels/pending-connection.ts";
import { leaveSignInTab, useRunStep } from "#channels/use-run-step.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { AccountPicker } from "#components/channels/account-picker.tsx";
import { useSetupName } from "#components/setup/setup-card-view.tsx";
import {
  useSetupChannelsHref,
  useWorkspaceHref,
} from "#components/shell/workspace-addresses.tsx";
import { getPathname, Link, useRouter } from "#i18n/navigation.ts";

// The tab's storage only changes from this page's own actions.
const ignoreChanges = () => constVoid;

// The server cannot read the tab's storage: it renders the waiting state,
// under a value no workspace id takes.
const notYetKnown = "";

const unknownOnServer = () => notYetKnown;

interface FailedProps {
  readonly message: string;
  readonly workspaceId: string | null;
}

const Failed = ({ message, workspaceId }: FailedProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("ConnectCallbackPage");

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertTitle>{t("failedTitle")}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      {workspaceId === null ? (
        <Button variant="outline" render={<Link href="/" />}>
          {t("toWorkspaces")}
        </Button>
      ) : (
        <Button
          variant="outline"
          render={<Link href={workspaceHref(workspaceId, "/channels")} />}
        >
          {t("toChannels")}
        </Button>
      )}
    </div>
  );
};

interface CompleteConnectionProps {
  /** What the platform added to the page's address; null if unreadable. */
  readonly callback: ConnectCallback | null;
  readonly platform: Platform;
}

// Hands what the platform sent back to the server, for the workspace this
// tab started the connection in, then returns to its channels. In a run of
// a new workspace's setup step, it keeps what came of the sign-in and goes
// on to the next platform's, naming it, or back to the step when the run is
// over or stopped (a refusal, here or at the next start).
export const CompleteConnection = ({
  callback,
  platform,
}: CompleteConnectionProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("ConnectCallbackPage");
  const errors = useChannelErrorText();
  const router = useRouter();
  const complete = useAtomSet(completeConnection, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  const nameOf = useSetupName();

  // The line shown while the tab leaves for the run's next platform.
  const [continuing, setContinuing] = useState<string | null>(null);

  const setupHref = useSetupChannelsHref();
  const locale = useLocale();

  // Back to the setup step the run started on.
  const toSetup = useEffectEvent((workspace: string) => {
    leaveSignInTab(getPathname({ href: setupHref(workspace), locale }));
  });

  const runStep = useRunStep({
    offerUpgrade: false,
    onRefused: (run) => {
      leaveSignInTab(getPathname({ href: setupHref(run.workspaceId), locale }));
    },
  });

  // Leaves for the run's next platform, from the effect below.
  const startNext = useEffectEvent((run: ConnectRun) => {
    runStep.start(run);
  });

  // Kept with its workspace: the tab forgets the connection once it is back.
  const [failure, setFailure] = useState<{
    readonly error: ChannelErrorKey;
    readonly workspaceId: string;
  } | null>(null);

  // The accounts the sign-in reached, when the member chooses among them.
  const [choice, setChoice] = useState<{
    readonly accounts: readonly ChoosableAccount[];
    readonly connection: ChannelConnection | null;
    readonly selection: string;
    readonly workspaceId: string;
  } | null>(null);

  // React runs effects twice in development; a callback completes once.
  const started = useRef(false);

  const workspaceId = useSyncExternalStore(
    ignoreChanges,
    // The connection this tab started, else the run's, which a tab the run
    // opened finishes for: it starts with none of its own
    // (`openSignInTab` forgets any before the tab copies its storage).
    () => pendingWorkspace(platform) ?? runWorkspaceFor(platform),
    unknownOnServer
  );

  useEffect(() => {
    if (
      started.current ||
      workspaceId === notYetKnown ||
      workspaceId === null ||
      callback === null
    ) {
      return;
    }

    started.current = true;

    const finish = async (workspace: string, payload: ConnectCallback) => {
      const exit = await complete({
        params: { platform, workspaceId: workspace },
        payload,
      });

      forgetConnection();

      const run = runAt(workspace, platform);

      if (exit._tag === "Success") {
        const outcome = exit.value;

        if (outcome._tag === "choose") {
          setChoice({
            accounts: outcome.accounts,
            connection: outcome.connection,
            selection: outcome.selection,
            workspaceId: workspace,
          });

          return;
        }

        if (run !== null) {
          const after = recordStep(run, platform, {
            _tag: "connected",
            handles: [outcome.channel.handle],
          });

          const next = nextStep(after);

          if (next === null) {
            toast.success(t("connected", { handle: outcome.channel.handle }));
            toSetup(workspace);

            return;
          }

          setContinuing(
            t("continuing", {
              handle: outcome.channel.handle,
              name: nameOf(next.platform, next.connection),
            })
          );
          startNext(after);

          return;
        }

        toast.success(t("connected", { handle: outcome.channel.handle }));

        // A platform the step skipped while its sign-in was open here: the
        // run reads it connected, and the step shows the rest.
        const skipped = currentRun();

        if (skipped !== null && skipped.workspaceId === workspace) {
          const after = amended(skipped, platform, {
            _tag: "connected",
            handles: [outcome.channel.handle],
          });

          if (after !== skipped) {
            saveRun(after);
            toSetup(workspace);

            return;
          }
        }

        router.replace(workspaceHref(workspace, "/channels"));

        return;
      }

      if (run !== null) {
        recordStep(run, platform, {
          _tag: "failed",
          error: runErrorOf(
            Option.getOrElse(failureOf(exit), () => "unknown" as const)
          ),
        });
        toSetup(workspace);

        return;
      }

      setFailure({
        error: Option.getOrElse(failureOf(exit), () => "unknown" as const),
        workspaceId: workspace,
      });
      offerUpgrade(exit, workspace);
    };

    void finish(workspaceId, callback);
  }, [
    callback,
    complete,
    nameOf,
    offerUpgrade,
    platform,
    router,
    t,
    workspaceHref,
    workspaceId,
  ]);

  if (continuing !== null) {
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {continuing}
      </p>
    );
  }

  if (choice !== null) {
    return (
      <AccountPicker
        accounts={choice.accounts}
        connection={choice.connection}
        platform={platform}
        selection={choice.selection}
        workspaceId={choice.workspaceId}
      />
    );
  }

  if (failure !== null) {
    return (
      <Failed
        message={errors(failure.error)}
        workspaceId={failure.workspaceId}
      />
    );
  }

  if (workspaceId === null) {
    return <Failed message={t("lost")} workspaceId={null} />;
  }

  if (workspaceId !== notYetKnown && callback === null) {
    return (
      <Failed message={errors("invalidState")} workspaceId={workspaceId} />
    );
  }

  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      {t("connecting")}
    </p>
  );
};
