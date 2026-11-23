import { Effect, Layer, Option } from "effect";

import { BillingNotices } from "#billing/application/ports/billing-notices.ts";
import type { BillingNotice } from "#billing/domain/billing-notice.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import type { ProductEvent } from "#shared/domain/product-event.ts";

/**
 * The product analytics event a billing notice tells, if any: a meter's
 * allowance reached without a payment method. The meter and a count only.
 */
export const productEventOf = (
  notice: BillingNotice
): Option.Option<ProductEvent> =>
  notice._tag === "AllowanceReached"
    ? Option.some<ProductEvent>({
        name: "allowance_reached",
        properties: { allowed: notice.allowed, meter: notice.meter },
      })
    : Option.none();

/**
 * BillingNotices that also tell product analytics of an allowance
 * reached, once `told` took the notice, as the billing workspace's
 * service identity: the claim that reached it may be a job's, and the
 * account is the workspace's, not the person's who spent its last unit.
 *
 * Known and accepted, as for the webhook events' milestones: the notice
 * joins the claim's transaction, and the analytics event is queued before
 * it commits. The notice is kept once per key; the event is sent each
 * time it is told, which is once a meter and month but for a unit given
 * back and claimed again.
 */
export const analysedBillingNotices = <E, R>(
  told: Layer.Layer<BillingNotices, E, R>
) =>
  Layer.effect(
    BillingNotices,
    Effect.gen(function* AnalysedBillingNotices() {
      const notices = yield* BillingNotices;
      const analytics = yield* ProductAnalytics;

      return BillingNotices.of({
        tell: (request) =>
          notices.tell(request).pipe(
            Effect.tap(() =>
              Option.match(productEventOf(request.notice), {
                onNone: () => Effect.void,
                onSome: (event) =>
                  analytics.capture({
                    actor: Option.none(),
                    asWorkspace: true,
                    billingAccountId: Option.none(),
                    event,
                    workspaceId: Option.some(request.workspaceId),
                  }),
              })
            )
          ),
      });
    })
  ).pipe(Layer.provide(told));
