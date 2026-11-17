// At start, a server that bills without a grace warns when a workspace on
// the free tier holds more accounts than it includes.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Logger, Option, Schema } from "effect";

import { GraceWarningLive } from "#billing/application/grace-warning.ts";
import { BillingAccountStore } from "#billing/application/ports/billing-account-store.ts";
import { BillingMode } from "#billing/application/ports/billing-mode.ts";
import { WorkspaceEntitlements } from "#billing/application/workspace-entitlements.ts";
import { WorkspaceStanding } from "#billing/application/workspace-standing.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  aloneAccountOf,
  entitlementsOn,
  everyWorkspaceOn,
} from "#test/billing/support.ts";

const over = WorkspaceIdSchema.make("4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a");

const within = WorkspaceIdSchema.make("5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b");

// A workspace a row of which cannot be read: the read that meets it dies,
// as a row that fails its schema makes a read die.
const malformed = WorkspaceIdSchema.make(
  "6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f8a9b0c"
);

const unreadable = Schema.decodeUnknownEffect(Schema.String)(0).pipe(
  Effect.orDie
);

// Every workspace on the free tier, but the malformed one, which dies.
const FreeButMalformed = Layer.succeed(
  WorkspaceEntitlements,
  WorkspaceEntitlements.of({
    of: (workspaceId) =>
      workspaceId === malformed
        ? unreadable.pipe(Effect.as(entitlementsOn("free", true)))
        : Effect.succeed(entitlementsOn("free", true)),
    ofEach: (workspaceIds) =>
      workspaceIds.includes(malformed)
        ? unreadable.pipe(Effect.as(new Map()))
        : Effect.succeed(
            new Map(
              workspaceIds.map((id) => [id, entitlementsOn("free", true)])
            )
          ),
  })
);

const warningsWith = (
  graceUntil: Option.Option<never>,
  enabled = true,
  holders: readonly WorkspaceId[] = [over, within],
  plans: Layer.Layer<WorkspaceEntitlements> = everyWorkspaceOn("free")
) =>
  Effect.gen(function* warned() {
    const lines: string[] = [];

    yield* Effect.scoped(
      Layer.build(
        GraceWarningLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(
                BillingMode,
                BillingMode.of({ enabled, graceSince: graceUntil, graceUntil })
              ),
              Layer.mock(BillingAccountStore, {
                page: (after) =>
                  Effect.succeed(
                    Option.isNone(after)
                      ? holders.map((id) => aloneAccountOf(id))
                      : []
                  ),
              }),
              Layer.mock(WorkspaceStanding, {
                bills: true,
                overPlanIn: () => Effect.succeed(new Set([over])),
              })
            )
          ),
          Layer.provide(plans)
        )
      ).pipe(Effect.andThen(Effect.yieldNow))
    ).pipe(
      Effect.provide(
        Logger.layer([
          Logger.make(({ logLevel, message }) => {
            if (logLevel === "Warn") {
              lines.push(String(message));
            }
          }),
        ])
      )
    );

    return lines;
  });

describe("the start's warning without a grace", () => {
  it.effect("names a free tier over its accounts", () =>
    Effect.gen(function* warns() {
      const lines = yield* warningsWith(Option.none());

      assert.lengthOf(lines, 1);
      assert.include(lines[0], "PEAL_BILLING_GRACE_UNTIL");
    })
  );

  it.effect(
    "logs a billing workspace it cannot read, skips it, and still names one over its accounts",
    () =>
      Effect.gen(function* skips() {
        const lines = yield* warningsWith(
          Option.none(),
          true,
          [malformed, over, within],
          FreeButMalformed
        );

        assert.lengthOf(lines, 2);
        assert.include(lines[0], "skipped");
        assert.include(lines[1], "PEAL_BILLING_GRACE_UNTIL");
      })
  );

  it.effect("says nothing on a server that does not bill", () =>
    Effect.gen(function* quiet() {
      assert.deepStrictEqual(yield* warningsWith(Option.none(), false), []);
    })
  );
});
