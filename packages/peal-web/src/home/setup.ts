import type { Billing, ChannelConnection, Platform } from "peal-contract";
import { accountsMonthly, rateCard } from "peal-contract/rate-card";

import type { OfferPrice } from "#billing/upgrade.ts";
import { priced } from "#billing/upgrade.ts";
import type { RunStep } from "#channels/connect-run.ts";
import { freeWithoutCard } from "#components/billing/billing-view.tsx";
import { connectablesOf } from "#components/channels/connect-forms.tsx";
import type { Connectable } from "#components/channels/connect-forms.tsx";

/** What a row of the setup card needs typed before its sign-in. */
export type SetupInput = "handle" | "instance" | null;

/** One row of the setup card: a platform's sign-in, by one way in. */
export interface SetupOption {
  /** The row's own name, unique on the card. */
  readonly key: string;
  readonly platform: Platform;
  /** LinkedIn's profile or pages; none where a platform has one way in. */
  readonly connection: ChannelConnection | null;
  readonly input: SetupInput;
}

const inputOf = (platform: Platform): SetupInput => {
  if (platform === "mastodon") {
    return "instance";
  }

  return platform === "bluesky" ? "handle" : null;
};

/**
 * The rows of the setup card: the platforms this server signs in to, in
 * the order New channel offers them, but those the operator keeps off the
 * card (`hidden`: a platform whose app the platform has not reviewed yet,
 * on whose sign-in page a member would stop). LinkedIn has a row for its
 * profile and one for pages where the server connects both; Instagram
 * signs in the server's preferred way. Websites and chats, which take a
 * secret, are left to New channel.
 */
export const setupOptionsOf = (
  connectable: Connectable,
  hidden: readonly Platform[]
): readonly SetupOption[] => {
  const signIns = new Set<string>(connectable.platforms);

  return connectablesOf(connectable).flatMap((each): SetupOption[] => {
    const platform = connectable.platforms.find((one) => one === each);

    if (
      platform === undefined ||
      !signIns.has(platform) ||
      hidden.includes(platform)
    ) {
      return [];
    }

    if (platform === "linkedin" && connectable.linkedinConnections.length > 1) {
      return connectable.linkedinConnections.map((connection) => ({
        connection,
        input: null,
        key: `linkedin:${connection}`,
        platform,
      }));
    }

    return [
      { connection: null, input: inputOf(platform), key: platform, platform },
    ];
  });
};

/**
 * The run's steps for the rows ticked, in the card's order, with what each
 * row's field holds (trimmed; an empty Bluesky handle is left out).
 */
const stepOf = (
  { connection, input, key, platform }: SetupOption,
  typed: Readonly<Record<string, string>>
): RunStep => {
  const value = (typed[key] ?? "").trim();

  const step: RunStep =
    connection === null ? { platform } : { connection, platform };

  if (input === null || value === "") {
    return step;
  }

  return input === "instance"
    ? { ...step, instance: value }
    : { ...step, handle: value };
};

export const stepsOf = (
  options: readonly SetupOption[],
  ticked: readonly string[],
  typed: Readonly<Record<string, string>>
): readonly RunStep[] =>
  options.flatMap((option) =>
    ticked.includes(option.key) ? [stepOf(option, typed)] : []
  );

/** Whether every ticked row holds what its sign-in needs: a server. */
export const isReady = (
  options: readonly SetupOption[],
  ticked: readonly string[],
  typed: Readonly<Record<string, string>>
): boolean =>
  ticked.length > 0 &&
  options
    .filter(({ key }) => ticked.includes(key))
    .every(
      ({ input, key }) =>
        input !== "instance" || (typed[key] ?? "").trim() !== ""
    );

/**
 * What the rows ticked cost, said under the list: free while the billing
 * account stays within its free accounts, what they add a month with a
 * payment method, or that a payment method is needed past the free ones.
 * Nothing on a server that does not bill, nor on a plan priced by tiers
 * of channels, which holds its own.
 */
export type SetupCost =
  | { readonly _tag: "free"; readonly free: number }
  | { readonly _tag: "adds"; readonly price: OfferPrice }
  | { readonly _tag: "needsPayment"; readonly free: number };

export const setupCostOf = (
  billing: Billing,
  accounts: number
): SetupCost | null => {
  const legacy =
    billing.plan !== null &&
    billing.plan !== "free" &&
    billing.plan !== "payAsYouGo";

  if (!billing.enabled || legacy || accounts === 0) {
    return null;
  }

  const card = billing.rateCard ?? rateCard;
  const held = billing.accounts.pooled;
  const free = freeWithoutCard(billing);

  if (!billing.paymentMethod) {
    return held + accounts <= free
      ? { _tag: "free", free }
      : { _tag: "needsPayment", free };
  }

  const cents =
    accountsMonthly(held + accounts, "usd", card) -
    accountsMonthly(held, "usd", card);

  return cents === 0
    ? { _tag: "free", free }
    : { _tag: "adds", price: priced(cents) };
};

/**
 * Whether X's row is closed: X connects only with a payment method, where
 * the server bills.
 */
export const xNeedsPayment = (billing: Billing | null): boolean =>
  billing !== null && billing.enabled && !billing.paymentMethod;
