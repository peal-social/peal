import { Context, Effect, Layer } from "effect";
import type { DateTime } from "effect";

import type { PostTarget } from "#publishing/domain/post-target.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";

/**
 * Hears that a website kept a post Peal no longer wanted it to publish: a
 * take-back or a removal the site never answered, tried again until the
 * time it held the post for, `at`, which has passed (`SiteKeptPost`).
 * Told once a target and time, in the transaction of the hand-over's job
 * that gave up.
 */
export class SiteHoldNotices extends Context.Service<
  SiteHoldNotices,
  {
    readonly kept: (
      target: PostTarget,
      at: DateTime.Utc
    ) => Effect.Effect<void, DatabaseError>;
  }
>()("peal-server/publishing/application/SiteHoldNotices") {
  /** Tells nobody. */
  static readonly none = Layer.succeed(
    SiteHoldNotices,
    SiteHoldNotices.of({ kept: () => Effect.void })
  );
}
