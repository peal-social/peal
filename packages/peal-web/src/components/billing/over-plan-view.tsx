"use client";

import { useFormatter, useTranslations } from "next-intl";
import { freeAccountsOf } from "peal-contract";
import type { Standing } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import { Checkbox } from "peal-ui/components/checkbox";
import { Label } from "peal-ui/components/label";
import { Skeleton } from "peal-ui/components/skeleton";
import { useId } from "react";
import type { ReactNode } from "react";

import type { ListLoad } from "#billing/over-plan-load.ts";
import { ExcessList } from "#components/billing/excess-list.tsx";

/** A channel to keep or let go. */
export interface HeldChannel {
  readonly id: string;
  /** The account, as people mention it. */
  readonly name: string;
  readonly platform: string;
}

/** A member to keep or let go. */
export interface HeldMember {
  readonly name: string;
  /** Their role, as it is stored. */
  readonly role: string;
  readonly userId: string;
}

/** Why choosing what stays was refused. */
export type OverPlanError =
  | "forbidden"
  | "generic"
  | "ownerRequired"
  | "payerRequired"
  | "selfRequired"
  | "tooManyChannels"
  | "tooManyMembers"
  | "unknownChannel"
  | "unknownMember";

export interface OverPlanViewProps {
  /** Whether the choice is being applied. */
  readonly applying: boolean;
  /** The link to the workspace's billing page. */
  readonly billingLink: ReactNode;
  /** Whether the member orders a plan and chooses what stays. */
  readonly canManage: boolean;
  /** The workspace's channels, once read. */
  readonly channels: readonly HeldChannel[];
  /** Whether the channels are read, loading, or could not be. */
  readonly channelsLoad: ListLoad;
  /** Whether the box saying what is removed is ticked. */
  readonly confirmed: boolean;
  readonly error: OverPlanError | null;
  readonly keptChannels: readonly string[];
  readonly keptMembers: readonly string[];
  /** The names of those who can fix it, for the other members. */
  readonly managers: readonly string[];
  /** The workspace's members, once read. */
  readonly members: readonly HeldMember[];
  /** Whether the members are read, loading, or could not be. */
  readonly membersLoad: ListLoad;
  readonly onApply: () => void;
  readonly onConfirm: (confirmed: boolean) => void;
  readonly onKeepChannel: (channelId: string, kept: boolean) => void;
  readonly onKeepMember: (userId: string, kept: boolean) => void;
  /** Reads the channels again, once they could not be. */
  readonly onRetryChannels: () => void;
  /** Reads the members again, once they could not be. */
  readonly onRetryMembers: () => void;
  /** The member reading, who always stays. */
  readonly self: string;
  readonly standing: Standing;
  /** The upgrade offer, for a member who manages billing. */
  readonly upgrade: ReactNode;
  readonly workspaceName: string;
}

const excessOf = (standing: Standing, limit: "channels" | "members") =>
  standing.over.find((excess) => excess.limit === limit);

const allowedOf = (standing: Standing, limit: "channels" | "members") =>
  excessOf(standing, limit)?.allowed ?? null;

// The rows a list draws while it loads: as many as the standing counts,
// ten at most. A billing account's other workspaces count their channels
// too, so the list may hold fewer.
const placeholderRowsOf = (
  standing: Standing,
  limit: "channels" | "members"
): readonly number[] =>
  Array.from(
    { length: Math.min(excessOf(standing, limit)?.used ?? 0, 10) },
    (_, row) => row
  );

// The placeholder labels, in turn, of different widths, so the rows read
// as names.
const placeholderLabels = [
  <Skeleton key="long" className="h-3 w-48" />,
  <Skeleton key="short" className="h-3 w-36" />,
  <Skeleton key="middle" className="h-3 w-44" />,
] as const;

// A row in the place of a choice still loading, of its height: the box and
// the label.
const PlaceholderRow = ({ row }: { readonly row: number }) => (
  <div className="flex h-4 items-center gap-3">
    <Skeleton className="size-4" />
    {placeholderLabels[row % placeholderLabels.length]}
  </div>
);

// The confirmation in its place while a list loads: its box and its
// sentence, on two lines on a phone, as the sentence wraps there.
const ConfirmPlaceholder = () => (
  <div className="flex items-start gap-3">
    <Skeleton className="size-4" />
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-3 w-40 sm:hidden" />
    </div>
  </div>
);

// One of the lists to choose among: its choices once read; before, rows
// in their place, so nothing moves when they arrive; why it could not be
// read, with a way to read it again.
const HeldList = ({
  children,
  failed,
  load,
  loading,
  onRetry,
  rows,
}: {
  /** The choices, once the list is read. */
  readonly children: ReactNode;
  readonly failed: string;
  readonly load: ListLoad;
  readonly loading: string;
  readonly onRetry: () => void;
  readonly rows: readonly number[];
}) => {
  const t = useTranslations("OverPlan");

  if (load === "ready") {
    return <ul className="flex flex-col gap-2">{children}</ul>;
  }

  if (load === "failed") {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <p className="text-sm">{failed}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <span className="sr-only">{loading}</span>
      {rows.map((row) => (
        <PlaceholderRow key={row} row={row} />
      ))}
    </div>
  );
};

const Choice = ({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) => {
  const id = useId();

  return (
    <li className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => {
          onChange(next === true);
        }}
      />
      <Label htmlFor={id}>{label}</Label>
    </li>
  );
};

const Choosing = ({
  applying,
  channels,
  channelsLoad,
  confirmed,
  keptChannels,
  keptMembers,
  members,
  membersLoad,
  onApply,
  onConfirm,
  onKeepChannel,
  onKeepMember,
  onRetryChannels,
  onRetryMembers,
  self,
  standing,
}: OverPlanViewProps) => {
  const t = useTranslations("OverPlan");
  const confirmId = useId();
  const channelsAllowed = allowedOf(standing, "channels");
  const membersAllowed = allowedOf(standing, "members");

  const tooMany =
    (channelsAllowed !== null && keptChannels.length > channelsAllowed) ||
    (membersAllowed !== null && keptMembers.length > membersAllowed);

  // The lists shown: the confirmation waits for both.
  const loads: readonly ListLoad[] = [
    channelsAllowed === null ? "ready" : channelsLoad,
    membersAllowed === null ? "ready" : membersLoad,
  ];

  const ready = loads.every((load) => load === "ready");

  const leaving = {
    channels:
      channelsAllowed === null ? 0 : channels.length - keptChannels.length,
    members: membersAllowed === null ? 0 : members.length - keptMembers.length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("chooseTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("chooseDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {channelsAllowed === null ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">
                {t("channels", {
                  allowed: channelsAllowed,
                  kept: keptChannels.length,
                })}
              </legend>
              <HeldList
                failed={t("channelsFailed")}
                load={channelsLoad}
                loading={t("loadingChannels")}
                rows={placeholderRowsOf(standing, "channels")}
                onRetry={onRetryChannels}
              >
                {channels.map(({ id, name }) => (
                  <Choice
                    key={id}
                    checked={keptChannels.includes(id)}
                    disabled={applying}
                    label={name}
                    onChange={(kept) => {
                      onKeepChannel(id, kept);
                    }}
                  />
                ))}
              </HeldList>
              <p className="text-muted-foreground text-xs">
                {t("channelsNote")}
              </p>
            </fieldset>
          )}
          {membersAllowed === null ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">
                {t("members", {
                  allowed: membersAllowed,
                  kept: keptMembers.length,
                })}
              </legend>
              <HeldList
                failed={t("membersFailed")}
                load={membersLoad}
                loading={t("loadingMembers")}
                rows={placeholderRowsOf(standing, "members")}
                onRetry={onRetryMembers}
              >
                {members.map(({ name, role, userId }) => (
                  <Choice
                    key={userId}
                    checked={keptMembers.includes(userId)}
                    disabled={applying || userId === self}
                    label={`${name} (${userId === self ? t("you") : t("role", { role })})`}
                    onChange={(kept) => {
                      onKeepMember(userId, kept);
                    }}
                  />
                ))}
              </HeldList>
              <p className="text-muted-foreground text-xs">
                {t("membersNote")}
              </p>
            </fieldset>
          )}
          {ready ? (
            <div className="flex items-start gap-3">
              <Checkbox
                id={confirmId}
                checked={confirmed}
                disabled={applying}
                onCheckedChange={(next) => {
                  onConfirm(next === true);
                }}
              />
              <Label htmlFor={confirmId}>{t("confirm", leaving)}</Label>
            </div>
          ) : null}
          {loads.includes("loading") ? <ConfirmPlaceholder /> : null}
          {tooMany ? (
            <p className="text-destructive text-sm">{t("tooMany")}</p>
          ) : null}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="destructive"
          disabled={!ready || !confirmed || tooMany || applying}
          focusableWhenDisabled
          onClick={onApply}
        >
          {applying ? t("applying") : t("apply")}
        </Button>
      </CardFooter>
    </Card>
  );
};

/**
 * What every member reads on entering a workspace that holds more than its
 * plan allows, as after its trial: what it holds beyond the plan, that
 * nothing goes out until it is back within it, and what becomes of the
 * posts already scheduled. Those who manage billing get the upgrade offer
 * first, then the choice of which channels and members stay, removed in
 * one confirmed step; the others read who can fix it.
 */
export const OverPlanView = (props: OverPlanViewProps) => {
  const {
    billingLink,
    canManage,
    error,
    managers,
    standing,
    upgrade,
    workspaceName,
  } = props;

  const t = useTranslations("OverPlan");
  const billing = useTranslations("Billing");
  const format = useFormatter();
  // The account's other workspaces the reader is a member of, on a server
  // that bills.
  const shared = standing.account?.otherWorkspaces ?? [];
  // The free tier, over its accounts: a payment method or fewer accounts.
  const free = (standing.plan ?? "free") === "free";
  // What the free tier allows this account: none once staff required a
  // payment method.
  const freeAllowed = allowedOf(standing, "channels") ?? freeAccountsOf();

  const description = () => {
    if (!free) {
      return t("description", {
        plan: billing("plan", { plan: standing.plan ?? "free" }),
      });
    }

    return freeAllowed === 0
      ? t("descriptionRevoked")
      : t("descriptionFree", { free: freeAllowed });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">
          {free
            ? t("titleFree", { workspace: workspaceName })
            : t("title", { workspace: workspaceName })}
        </h2>
        <p className="text-muted-foreground">{description()}</p>
      </div>
      <ExcessList excesses={standing.over} namespace="OverPlan" />
      {shared.length === 0 ? null : (
        <p className="text-sm">
          {t("sharedAccount", {
            workspaces: format.list(
              shared.map(({ name }) => name),
              { type: "conjunction" }
            ),
          })}
        </p>
      )}
      <p className="text-sm">
        {t("posts", { count: standing.scheduledPosts })}
      </p>
      {error === null ? null : (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}
      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("upgradeTitle")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {standing.planWithRoom === null ? (
                <p className="text-sm">{t("noPlan")}</p>
              ) : (
                upgrade
              )}
            </CardContent>
            <CardFooter>{billingLink}</CardFooter>
          </Card>
          <Choosing {...props} />
        </>
      ) : (
        <p className="text-sm">
          {managers.length === 0
            ? t("othersUnknown")
            : t("others", {
                names: managers.join(", "),
                workspace: workspaceName,
              })}
        </p>
      )}
    </div>
  );
};
