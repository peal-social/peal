import { Effect, Layer, Option } from "effect";

import { RecipientsUnavailable } from "#notifications/application/recipients-unavailable.ts";
import { WelcomeReaders } from "#notifications/application/welcome-readers.ts";
import { AccountStanding } from "#workspace/application/account-standing.ts";
import { MemberDirectory } from "#workspace/application/member-directory.ts";

/**
 * New accounts as the workspace context, which holds accounts, has them now:
 * none for one staff banned.
 */
export const WorkspaceWelcomeReaders = Layer.effect(
  WelcomeReaders,
  Effect.gen(function* WorkspaceWelcomeReaders() {
    const accounts = yield* AccountStanding;
    const directory = yield* MemberDirectory;

    return WelcomeReaders.of({
      readerOf: (userId) =>
        Effect.gen(function* readerOf() {
          const found = yield* directory.account(userId);

          if (Option.isNone(found) || !(yield* accounts.isActive(userId))) {
            return Option.none();
          }

          const { email, emailVerified, locale } = found.value;

          return Option.some({ email, emailConfirmed: emailVerified, locale });
        }).pipe(
          Effect.mapError((cause) => new RecipientsUnavailable({ cause }))
        ),
    });
  })
);
