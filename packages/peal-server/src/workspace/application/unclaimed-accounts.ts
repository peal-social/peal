import { Context, Effect, Layer, Option, Ref } from "effect";

import type { UserId } from "#shared/domain/ids.ts";

import { CloseAccount } from "./close-account.ts";

type Closer = (userId: UserId) => Effect.Effect<boolean>;

/**
 * Closes accounts nobody claimed (`CloseAccount.closeUnclaimed`), for
 * Better Auth's hooks, which run below the settings' use cases: the hooks
 * ask through this port, and the settings serve it once built
 * (`UnclaimedAccounts.served`). Before then, or in a build without the
 * settings, nothing is closed and the answer is `false`, so an account
 * that was used is never handed over.
 */
export class UnclaimedAccounts extends Context.Service<
  UnclaimedAccounts,
  {
    /** Closes the account, and says whether it did. Never fails. */
    readonly close: Closer;
    readonly serve: (closer: Closer) => Effect.Effect<void>;
  }
>()("peal-server/workspace/application/UnclaimedAccounts") {
  static readonly layer = Layer.effect(
    UnclaimedAccounts,
    Effect.gen(function* UnclaimedAccountsLive() {
      const closer = yield* Ref.make(Option.none<Closer>());

      return UnclaimedAccounts.of({
        close: (userId) =>
          Ref.get(closer).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeed(false),
                onSome: (close) => close(userId),
              })
            )
          ),
        serve: (close) => Ref.set(closer, Option.some(close)),
      });
    })
  );

  /**
   * Serves the port with `CloseAccount`: a closure it refuses or that
   * fails is logged and answered `false`.
   */
  static readonly served = Layer.effectDiscard(
    Effect.gen(function* serveUnclaimedAccounts() {
      const accounts = yield* UnclaimedAccounts;
      const closing = yield* CloseAccount;

      yield* accounts.serve((userId) =>
        closing.closeUnclaimed(userId).pipe(
          Effect.as(true),
          Effect.catchCause((cause) =>
            Effect.logWarning(
              "Closing an account nobody claimed failed",
              cause
            ).pipe(Effect.as(false))
          ),
          Effect.withSpan("UnclaimedAccounts.close")
        )
      );
    })
  );
}
