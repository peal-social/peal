"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Exit, Option, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { ReductionRefused, forWorkspace } from "peal-contract";
import type { Standing } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";

import {
  managesBilling,
  membersOf,
  reduceWorkspace,
} from "#billing/members.ts";
import { listLoadOf } from "#billing/over-plan-load.ts";
import type { UpgradeReason } from "#billing/upgrade.ts";
import { channelsOf } from "#channels/channels-api.ts";
import { OverPlanView } from "#components/billing/over-plan-view.tsx";
import type { OverPlanError } from "#components/billing/over-plan-view.tsx";
import { UpgradeOffer } from "#components/billing/upgrade-dialog.tsx";
import type { UpgradeWorkspace } from "#components/billing/upgrade-dialog.tsx";
import { useChannelLabel } from "#components/channels/channel-label.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";

interface OverPlanScreenProps {
  /** Where to write for more than the largest plan, if the operator says. */
  readonly contactUrl: string | null;
  /** The member reading. */
  readonly self: string;
  readonly standing: Standing;
  /** The terms of service, where the operator publishes them. */
  readonly termsUrl: string | null;
  readonly workspace: UpgradeWorkspace;
}

const isRefused = Schema.is(ReductionRefused);

// Why choosing what stays failed.
const errorOf = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>
): OverPlanError | null => {
  if (Exit.isSuccess(exit)) {
    return null;
  }

  return Cause.findErrorOption(exit.cause).pipe(
    Option.map((failure): OverPlanError => {
      if (isRefused(failure)) {
        return failure.reason;
      }

      return failure._tag === "Forbidden" ? "forbidden" : "generic";
    }),
    Option.getOrElse((): OverPlanError => "generic")
  );
};

// The limit the offer names: the first the workspace must come back within.
const reasonOf = (standing: Standing): UpgradeReason | null => {
  const [first] = standing.over;

  return first === undefined || standing.plan === null
    ? null
    : {
        allowed: first.allowed,
        limit: first.limit,
        plan: standing.plan,
        planWithRoom: standing.planWithRoom,
        used: first.used,
      };
};

/**
 * The screen a workspace over its plan shows instead of its pages, but
 * billing's: the upgrade, by card, or the choice of what stays, for those
 * who manage billing, and who can fix it for the others. Once the choice
 * is applied, the pages load again. What the server read (the standing,
 * the workspace) shows at once, on the server too. The channels and the
 * members are read with the visitor's cookies, in the browser alone: for
 * those who manage billing, the server renders each list loading, as the
 * browser's first render does (`listLoadOf`), and each says on its own
 * when it could not be read, with Try again.
 */
export const OverPlanScreen = ({
  contactUrl,
  self,
  standing,
  termsUrl,
  workspace,
}: OverPlanScreenProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("OverPlan");
  const channelLabel = useChannelLabel();
  const hydrated = useHydrated();
  const channelsQuery = channelsOf(workspace.id);
  const membersQuery = membersOf(workspace.id);
  const channels = useAtomValue(channelsQuery);
  const members = useAtomValue(membersQuery);
  const refreshChannels = useAtomRefresh(channelsQuery);
  const refreshMembers = useAtomRefresh(membersQuery);
  const reduce = useAtomSet(reduceWorkspace, { mode: "promiseExit" });
  const [keptChannels, setKeptChannels] = useState<readonly string[]>([]);
  const [keptMembers, setKeptMembers] = useState<readonly string[]>([self]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<OverPlanError | null>(null);
  const [applying, startApplying] = useTransition();
  const reason = reasonOf(standing);

  const toggle =
    (set: (update: (kept: readonly string[]) => readonly string[]) => void) =>
    (id: string, kept: boolean) => {
      setConfirmed(false);
      set((before) =>
        kept ? [...before, id] : before.filter((other) => other !== id)
      );
    };

  const apply = () => {
    setError(null);

    startApplying(async () => {
      const done = await reduce({
        headers: forWorkspace(workspace.id),
        payload: { keepChannelIds: keptChannels, keepMemberIds: keptMembers },
      });

      if (Exit.isSuccess(done) && !done.value.standing.mustReduce) {
        globalThis.location.reload();

        return;
      }

      setConfirmed(false);
      setError(errorOf(done));
    });
  };

  const channelsLoad = listLoadOf(hydrated, channels);
  const membersLoad = listLoadOf(hydrated, members);

  // The members, for those who manage billing once hydrated, as their
  // list's state says; the names of who can fix it, for the others.
  const people =
    AsyncResult.isSuccess(members) &&
    (membersLoad === "ready" || !workspace.canManage)
      ? members.value
      : [];

  return (
    <OverPlanView
      applying={applying}
      billingLink={
        <Button
          variant="link"
          size="sm"
          render={<Link href={workspaceHref(workspace.id, "/billing")} />}
        >
          {t("billing")}
        </Button>
      }
      canManage={workspace.canManage}
      channels={
        AsyncResult.isSuccess(channels) && channelsLoad === "ready"
          ? channels.value.map((channel) => ({
              id: channel.id,
              name: channelLabel(channel),
              platform: channel.platform,
            }))
          : []
      }
      channelsLoad={channelsLoad}
      confirmed={confirmed}
      error={error}
      keptChannels={keptChannels}
      keptMembers={keptMembers}
      managers={people
        .filter(({ role }) => managesBilling(role))
        .map(({ name }) => name)}
      members={people}
      membersLoad={membersLoad}
      self={self}
      standing={standing}
      upgrade={
        reason === null ? null : (
          <UpgradeOffer
            contactUrl={contactUrl}
            reason={reason}
            standing={standing}
            termsUrl={termsUrl}
            workspace={workspace}
          />
        )
      }
      workspaceName={workspace.name}
      onApply={apply}
      onConfirm={setConfirmed}
      onKeepChannel={toggle(setKeptChannels)}
      onKeepMember={toggle(setKeptMembers)}
      onRetryChannels={refreshChannels}
      onRetryMembers={refreshMembers}
    />
  );
};
