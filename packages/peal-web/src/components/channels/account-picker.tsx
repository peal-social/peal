"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { useTranslations } from "next-intl";
import type {
  ChannelConnection,
  ChoosableAccount,
  Platform,
} from "peal-contract";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useState, useTransition } from "react";

import {
  channelsChanged,
  chooseAccounts,
  failureOf,
} from "#channels/channels-api.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";
import { choiceStart } from "#channels/choice-connection.ts";
import { nextStep, recordStep, runAt } from "#channels/connect-run.ts";
import { useConnect } from "#channels/use-connect.ts";
import { useRunStep } from "#channels/use-run-step.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import {
  AccountPickerView,
  toggled,
} from "#components/channels/account-picker-view.tsx";
import { useSetupName } from "#components/home/setup-card-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link, useRouter } from "#i18n/navigation.ts";

interface AccountPickerProps {
  readonly accounts: readonly ChoosableAccount[];
  /** The way in the choice came through, which starting over takes. */
  readonly connection: ChannelConnection | null;
  readonly platform: Platform;
  readonly selection: string;
  readonly workspaceId: string;
}

// Sends the member's choice, then returns to the channels. After a
// failure, the member tries again, or signs in again for a new choice. In
// a run of the home page's setup card, the choice is the step's outcome,
// and the tab goes on to the next platform, or back to Home; leaving
// without choosing skips the platform.
export const AccountPicker = ({
  accounts,
  connection,
  platform,
  selection,
  workspaceId,
}: AccountPickerProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("MetaChannels");
  const router = useRouter();
  const choose = useAtomSet(chooseAccounts, { mode: "promiseExit" });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState<ChannelErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const signIn = useConnect(workspaceId, platform);
  const offerUpgrade = useOfferUpgrade();
  const nameOf = useSetupName();
  const [continuing, setContinuing] = useState<string | null>(null);

  const toHome = () => {
    router.replace(workspaceHref(workspaceId));
  };

  const runStep = useRunStep({ offerUpgrade: false, onRefused: toHome });

  const handleToggle = (accountId: string, checked: boolean) => {
    setSelected((before) => toggled(accounts, before, accountId, checked));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const exit = await choose({
        params: { platform, workspaceId },
        payload: { accountIds: [...selected], selection },
        reactivityKeys: channelsChanged(workspaceId),
      });

      if (exit._tag === "Success") {
        const run = runAt(workspaceId, platform);

        if (run === null) {
          toast.success(t("connected", { count: exit.value.length }));
          router.replace(workspaceHref(workspaceId, "/channels"));

          return;
        }

        const after = recordStep(run, platform, {
          _tag: "connected",
          handles: exit.value.map(({ handle }) => handle),
        });

        const next = nextStep(after);

        if (next === null) {
          toast.success(t("connected", { count: exit.value.length }));
          toHome();

          return;
        }

        setContinuing(
          t("continuing", {
            count: exit.value.length,
            name: nameOf(next.platform, next.connection),
          })
        );
        runStep.start(after);

        return;
      }

      setError(Option.getOrElse(failureOf(exit), () => "unknown" as const));
      offerUpgrade(exit, workspaceId);
    });
  };

  if (continuing !== null) {
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {continuing}
      </p>
    );
  }

  const run = runAt(workspaceId, platform);

  return (
    <AccountPickerView
      accounts={accounts}
      connection={connection}
      cancel={
        run === null ? (
          <Button
            variant="outline"
            render={<Link href={workspaceHref(workspaceId, "/channels")} />}
          >
            {t("cancel")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              recordStep(run, platform, { _tag: "skipped" });
              toHome();
            }}
          >
            {t("skip")}
          </Button>
        )
      }
      error={signIn.error ?? error}
      isPending={isPending || signIn.isPending || runStep.isPending}
      onSubmit={handleSubmit}
      onToggle={handleToggle}
      platform={platform}
      selected={selected}
      startOver={
        <Button
          type="button"
          variant="outline"
          disabled={signIn.isPending}
          focusableWhenDisabled
          onClick={() => {
            signIn.start(choiceStart(connection));
          }}
        >
          {signIn.isPending
            ? t("connecting")
            : t("startOver", { connection: connection ?? "none", platform })}
        </Button>
      }
    />
  );
};
