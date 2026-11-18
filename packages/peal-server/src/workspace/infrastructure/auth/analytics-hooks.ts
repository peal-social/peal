import { DateTime, Effect, Option, Schema } from "effect";

import type { BillingAccounts } from "#billing/application/billing-accounts.ts";
import type { SubscriptionEvent } from "#billing/application/record-subscription.ts";
import type { WorkspaceEntitlements } from "#billing/application/workspace-entitlements.ts";
import type {
  GroupProperties,
  ProductAnalytics,
} from "#shared/application/product-analytics.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { userSubject, workspaceSubject } from "#shared/domain/product-event.ts";
import type { AnalyticsSubject } from "#shared/domain/product-event.ts";

import type { CreatedUser } from "./options.ts";

type Analytics = ProductAnalytics["Service"];

/** A billing account, as billing answers it for a workspace. */
export type HeldAccount = Effect.Success<
  ReturnType<BillingAccounts["Service"]["of"]>
>;

const decodeUserId = Schema.decodeUnknownOption(UserIdSchema);

const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));

// Whose an account is: a person's, a partner's, or a workspace nobody owns.
const kindOf = (account: HeldAccount) => {
  if (Option.isSome(account.payer)) {
    return "person";
  }

  return Option.isSome(account.partnerId) ? "partner" : "unowned";
};

/** What product analytics keeps of a billing account. */
export const accountGroup = (account: HeldAccount): GroupProperties => ({
  created_at: DateTime.formatIso(account.createdAt),
  free_tier: account.freeTier,
  kind: kindOf(account),
  standalone: account.standalone,
});

const asPerson = (userId: UserId) =>
  Option.some({ impersonated: false, userId });

// A failure here is logged, and changes nothing Better Auth answers.
const quietly = <A, E, R>(what: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.logWarning(`Telling product analytics ${what} failed`, cause)
    )
  );

/**
 * An account was made: the person's properties (`kind`, `locale`, and
 * once, when and how they signed up), then `user_signed_up`.
 */
export const toldSignUp = (
  analytics: Analytics,
  { locale, method, userId }: CreatedUser
) =>
  quietly(
    "of a sign-up",
    Option.match(decodeUserId(userId), {
      onNone: () => Effect.void,
      onSome: (id) =>
        Effect.gen(function* signedUp() {
          yield* analytics.identify(id, {
            set: { kind: "user", locale },
            setOnce: { signed_up_at: yield* now, signup_method: method },
          });

          yield* analytics.capture({
            actor: asPerson(id),
            billingAccountId: Option.none(),
            event: { name: "user_signed_up", properties: { locale, method } },
            workspaceId: Option.none(),
          });
        }),
    })
  );

/**
 * A workspace was made by `creatorId`: `workspace_created`, and the
 * groups of the workspace and of its billing account, when it was read.
 */
export const toldWorkspace = (
  analytics: Analytics,
  workspaceId: WorkspaceId,
  creatorId: string,
  account: Option.Option<HeldAccount>
) =>
  quietly(
    "of a workspace",
    Option.match(decodeUserId(creatorId), {
      onNone: () => Effect.void,
      onSome: (creator) =>
        Effect.gen(function* created() {
          const as = userSubject(creator);
          const createdAt = yield* now;
          const accountId = account.pipe(Option.map(({ id }) => id));

          yield* analytics.capture({
            actor: asPerson(creator),
            billingAccountId: accountId,
            event: { name: "workspace_created", properties: {} },
            workspaceId: Option.some(workspaceId),
          });

          yield* analytics.groupIdentify(
            { key: workspaceId, type: "workspace" },
            Option.match(accountId, {
              onNone: () => ({ created_at: createdAt }),
              onSome: (id) => ({
                billing_account_id: id,
                created_at: createdAt,
              }),
            }),
            as
          );

          yield* Option.match(account, {
            onNone: () => Effect.void,
            onSome: (held) =>
              analytics.groupIdentify(
                { key: held.id, type: "billing_account" },
                accountGroup(held),
                as
              ),
          });
        }),
    })
  );

/**
 * A subscription's event billing recorded: `subscription_changed` with the
 * state it records (Stripe's events repeat and come out of order, so
 * PostHog derives the transitions), as the member who started it or the
 * workspace, and the plan and status of the workspace and its billing
 * account. Billing records only a status it knows, and an event without
 * its plan is not sent.
 */
export const toldSubscription = (
  analytics: Analytics,
  accounts: BillingAccounts["Service"],
  entitlements: WorkspaceEntitlements["Service"],
  event: SubscriptionEvent
) =>
  quietly(
    "of a subscription",
    Effect.gen(function* subscribed() {
      const { interval, plan, workspaceId } = event;

      if (plan === null || interval === null) {
        return;
      }

      const account = yield* accounts.of(workspaceId).pipe(
        Effect.map(Option.some),
        Effect.catchCause((cause) =>
          Effect.logWarning(
            "Reading a subscription's billing account for product analytics failed",
            cause
          ).pipe(Effect.as(Option.none<HeldAccount>()))
        )
      );

      // The workspace's plan now: the subscription's while it gives it.
      const planNow = yield* entitlements.of(workspaceId).pipe(
        Effect.map(({ plan: held }) => Option.getOrElse(held, () => "free")),
        Effect.option
      );

      const as: AnalyticsSubject = Option.match(event.startedBy, {
        onNone: () => workspaceSubject(workspaceId),
        onSome: userSubject,
      });

      const accountId = account.pipe(Option.map(({ id }) => id));

      const standing = Option.match(planNow, {
        onNone: () => ({ subscription_status: event.status }),
        onSome: (held) => ({ plan: held, subscription_status: event.status }),
      });

      yield* analytics.capture({
        actor: event.startedBy.pipe(
          Option.map((userId) => ({ impersonated: false, userId }))
        ),
        billingAccountId: accountId,
        event: {
          name: "subscription_changed",
          properties: {
            cancelAtPeriodEnd: event.cancelAtPeriodEnd,
            interval,
            plan,
            status: event.status,
          },
        },
        workspaceId: Option.some(workspaceId),
      });

      yield* analytics.groupIdentify(
        { key: workspaceId, type: "workspace" },
        Option.match(accountId, {
          onNone: () => standing,
          onSome: (id) => ({ ...standing, billing_account_id: id }),
        }),
        as
      );

      yield* Option.match(account, {
        onNone: () => Effect.void,
        onSome: (held) =>
          analytics.groupIdentify(
            { key: held.id, type: "billing_account" },
            { ...accountGroup(held), ...standing },
            as
          ),
      });
    })
  );
