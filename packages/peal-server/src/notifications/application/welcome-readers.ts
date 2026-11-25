import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { UserId } from "#shared/domain/ids.ts";
import type { Locale } from "#shared/domain/locale.ts";

import type { RecipientsUnavailable } from "./recipients-unavailable.ts";

/** A new account, as its welcome reads it. */
export interface WelcomeReader {
  readonly email: string;
  /** Whether its person showed that the address is theirs. */
  readonly emailConfirmed: boolean;
  readonly locale: Locale;
}

/** The accounts welcomes go to. */
export class WelcomeReaders extends Context.Service<
  WelcomeReaders,
  {
    /** The account now; none for one that no longer exists or is banned. */
    readonly readerOf: (
      userId: UserId
    ) => Effect.Effect<Option.Option<WelcomeReader>, RecipientsUnavailable>;
  }
>()("peal-server/notifications/application/WelcomeReaders") {}
