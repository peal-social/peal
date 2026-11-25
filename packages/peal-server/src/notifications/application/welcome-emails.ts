import { Context, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId } from "#shared/domain/ids.ts";

/**
 * The welcome of a new account: the context that makes accounts starts it
 * once the account is made, and it goes out later, once the account's
 * address is confirmed. Starting it twice sends one, and starting it on a
 * server without a signer does nothing.
 */
export class WelcomeEmails extends Context.Service<
  WelcomeEmails,
  {
    /**
     * Erases what is stored of an account's welcome, whatever it has come
     * to, in the caller's transaction, if any: it wakes no more. An email on
     * its way then may still go out.
     */
    readonly forget: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    readonly start: (userId: UserId) => Effect.Effect<void>;
  }
>()("peal-server/notifications/application/WelcomeEmails") {
  /** Starts none. */
  static readonly none = Layer.succeed(
    WelcomeEmails,
    WelcomeEmails.of({ forget: () => Effect.void, start: () => Effect.void })
  );
}
