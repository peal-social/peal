"use client";

import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { rateCard } from "peal-contract";
import type { RateCard, Standing } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "peal-ui/components/dialog";
import { useState, useTransition } from "react";

import { billingOf } from "#billing/api.ts";
import { managesBilling, membersOf, standingOf } from "#billing/members.ts";
import {
  billedElsewhereOf,
  isFeatureReason,
  isMeterReason,
} from "#billing/upgrade.ts";
import type { UpgradeReason } from "#billing/upgrade.ts";
import { useCheckout } from "#billing/use-checkout.ts";
import type { BillingError } from "#components/billing/billing-view.tsx";
import { UpgradeView } from "#components/billing/upgrade-view.tsx";
import type { BilledElsewhere } from "#components/billing/upgrade-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";

/** The workspace a plan is ordered for, and what its member may do. */
export interface UpgradeWorkspace {
  /** Whether the member may order its plan (billing:manage). */
  readonly canManage: boolean;
  readonly id: string;
  readonly name: string;
}

export interface UpgradeDialogProps {
  /** Where to write for more than the largest plan, if the operator says. */
  readonly contactUrl: string | null;
  readonly onClose: () => void;
  readonly reason: UpgradeReason;
  /** The terms of service, where the operator publishes them. */
  readonly termsUrl: string | null;
  readonly workspace: UpgradeWorkspace;
}

interface WorkspaceBilling {
  /**
   * The rate card the server answered, for a member who reads billing; the
   * app's own otherwise.
   */
  readonly card: RateCard;
  readonly elsewhere: BilledElsewhere | null;
  readonly trialing: boolean;
}

/** The offer's props, and the standing where the page has read it. */
type OfferProps = Omit<UpgradeDialogProps, "onClose"> & {
  /**
   * Where the workspace stands, as the server read it for the page: the
   * offer then names the workspace that bills the account in the server's
   * render too, without waiting for the browser to read it.
   */
  readonly standing?: Standing | undefined;
};

// The workspace that bills the account, from the standing every member
// reads (the one given, else the browser's), linked for its members; and,
// for a member who reads billing, whether the workspace is in a legacy
// trial and the server's rate card.
const useBillingOf = (
  workspaceId: string,
  given: Standing | undefined
): WorkspaceBilling => {
  const workspaceHref = useWorkspaceHref();
  const read = useAtomValue(standingOf(workspaceId));
  const billing = useAtomValue(billingOf(workspaceId));
  const billed = AsyncResult.isSuccess(billing) ? billing.value : null;

  const standing =
    given ?? (AsyncResult.isSuccess(read) ? read.value : undefined);

  const elsewhere =
    standing === undefined
      ? null
      : billedElsewhereOf(standing.account, workspaceId).pipe(
          Option.map(({ name, workspaceId: id }): BilledElsewhere => ({
            link:
              name === null ? null : (
                <Link
                  href={workspaceHref(id, "/billing")}
                  className="underline underline-offset-4"
                >
                  {name}
                </Link>
              ),
          })),
          Option.getOrNull
        );

  return {
    card: billed?.rateCard ?? rateCard,
    elsewhere,
    trialing: billed?.subscription?.status === "trialing",
  };
};

const ManagedOffer = ({
  contactUrl,
  reason,
  standing,
  termsUrl,
  workspace,
}: OfferProps) => {
  const checkout = useCheckout(workspace.id);
  const { card, elsewhere, trialing } = useBillingOf(workspace.id, standing);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);
  const [ordering, startOrder] = useTransition();

  // Back to this page after the checkout, paid or not: what the person
  // was doing is still here.
  const order = () => {
    const here = `${globalThis.location.pathname}${globalThis.location.search}`;

    setError(null);

    startOrder(async () => {
      const failed = await checkout({ returnDone: here, returnTo: here });

      setError(
        failed.pipe(
          Option.map(({ error: reason_ }) => reason_),
          Option.getOrNull
        )
      );
    });
  };

  return (
    <UpgradeView
      canManage
      card={card}
      consented={consented}
      contactUrl={contactUrl}
      elsewhere={elsewhere}
      error={error}
      managers={[]}
      ordering={ordering}
      reason={reason}
      termsUrl={termsUrl}
      trialing={trialing}
      workspaceName={workspace.name}
      onConsent={setConsented}
      onOrder={order}
    />
  );
};

const nothing = () => {
  // A member who cannot order has nothing to tick or press.
};

// For a member who cannot order: who can, by name.
const AskManagers = ({
  contactUrl,
  reason,
  standing,
  termsUrl,
  workspace,
}: OfferProps) => {
  const members = useAtomValue(membersOf(workspace.id));
  const { card, elsewhere } = useBillingOf(workspace.id, standing);

  const managers = AsyncResult.isSuccess(members)
    ? members.value
        .filter(({ role }) => managesBilling(role))
        .map(({ name }) => name)
    : [];

  return (
    <UpgradeView
      canManage={false}
      card={card}
      consented={false}
      contactUrl={contactUrl}
      elsewhere={elsewhere}
      error={null}
      managers={managers}
      ordering={false}
      reason={reason}
      termsUrl={termsUrl}
      trialing={false}
      workspaceName={workspace.name}
      onConsent={nothing}
      onOrder={nothing}
    />
  );
};

/**
 * The upgrade offer on its own, as the over-plan screen shows it: to order
 * for a member who manages billing, or who can for the others. The screen
 * gives it the standing the server read, so it renders the same on the
 * server and in the browser's first render.
 */
export const UpgradeOffer = (offer: OfferProps) =>
  offer.workspace.canManage ? (
    <ManagedOffer {...offer} />
  ) : (
    <AskManagers {...offer} />
  );

// The dialog's title: the meter used, or the limit reached.
const titleOf = (
  t: ReturnType<typeof useTranslations<"Upgrade">>,
  reason: UpgradeReason
) => {
  if (isMeterReason(reason)) {
    return t("titleMeter", { meter: reason.meter });
  }

  if (isFeatureReason(reason)) {
    return t("titleFeature");
  }

  return reason.planWithRoom === "payAsYouGo"
    ? t("titlePerAccount", { limit: reason.limit })
    : t("title", { limit: reason.limit });
};

/**
 * The dialog shown wherever a plan's limit refuses something: the offer of
 * a payment method for the workspace's billing account, which a member who
 * manages billing orders from here, through the order and Stripe's
 * checkout, coming back to the page they were on. Rendered while there is a reason to show.
 */
export const UpgradeDialog = ({ onClose, ...offer }: UpgradeDialogProps) => {
  const t = useTranslations("Upgrade");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg" closeLabel={t("closeLabel")}>
        <DialogHeader>
          <DialogTitle>
            {/* Clear of the close button, at the top right. */}
            <span className="block pe-8">{titleOf(t, offer.reason)}</span>
          </DialogTitle>
        </DialogHeader>
        <UpgradeOffer {...offer} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
