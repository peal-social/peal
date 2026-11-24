import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";
import type { CalendarDay } from "peal-contract";

import { PealApi } from "#api/client.ts";

/** The workspace's plan, its limits and its usage, with the visitor's cookies. */
export const billingOf = Atom.family((workspaceId: string) =>
  PealApi.query("workspace.billing", "get", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: [`billing:${workspaceId}`],
  })
);

// What a member does on the billing page, each sent from the browser with
// its session cookie, so the API checks the page's origin: an order before
// checkout, a cancellation, a withdrawal and what it would do.

export const placeOrder = PealApi.mutation("workspace.billingActions", "order");

export const cancelSubscription = PealApi.mutation(
  "workspace.billingActions",
  "cancel"
);

export const previewWithdrawal = PealApi.mutation(
  "workspace.billingActions",
  "withdrawal"
);

export const withdraw = PealApi.mutation(
  "workspace.billingActions",
  "withdraw"
);

/** What the billing account spends past a group's allowances a month. */
export const setSpendCeiling = PealApi.mutation(
  "workspace.billingActions",
  "setCeiling"
);

/** Whether the workspace reads its X channels at X's rates. */
export const setXReads = PealApi.mutation(
  "workspace.billingActions",
  "setXReads"
);

/** The workspace's usage over the UTC days from `from` to `to`. */
export const usageOf = (
  workspaceId: string,
  period: { readonly from: CalendarDay; readonly to: CalendarDay }
) =>
  PealApi.query("workspace.usage", "get", {
    headers: forWorkspace(workspaceId),
    query: period,
    reactivityKeys: [`billing:${workspaceId}`],
  });

// Handing the workspace to another payer: its payer offers it to another
// owner, who takes it over or declines; the payer may withdraw it.

export const offerTransfer = PealApi.mutation(
  "workspace.billingActions",
  "offerTransfer"
);

export const acceptTransfer = PealApi.mutation(
  "workspace.billingActions",
  "acceptTransfer"
);

export const withdrawTransfer = PealApi.mutation(
  "workspace.billingActions",
  "withdrawTransfer"
);
