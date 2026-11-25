import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";

import { WelcomeReaders } from "#notifications/application/welcome-readers.ts";
import { WorkspaceWelcomeReaders } from "#notifications/infrastructure/workspace-welcome-readers.ts";
import { setTime } from "#test/publishing/infrastructure/harness.ts";
import { sampleUserId as userId } from "#test/shared/product-event-samples.ts";
import { AccountStanding } from "#workspace/application/account-standing.ts";
import { DirectoryUnavailable } from "#workspace/application/directory-unavailable.ts";
import { MemberDirectory } from "#workspace/application/member-directory.ts";
import { Account } from "#workspace/domain/account.ts";
import type { Ban } from "#workspace/domain/ban.ts";

const accountWith = ({
  ban = Option.none(),
  emailVerified = true,
}: {
  readonly ban?: Option.Option<Ban>;
  readonly emailVerified?: boolean;
}) =>
  new Account({
    ban,
    browserAnalyticsConsent: Option.none(),
    email: "ada@example.test",
    emailVerified,
    hasPassword: true,
    id: userId,
    image: Option.none(),
    locale: "fr",
    name: "Ada Synthetic",
    twoStepEnabled: false,
    workspaces: [],
  });

const readerIn = (account: MemberDirectory["Service"]["account"]) =>
  setTime("2026-11-25T09:00:00Z").pipe(
    Effect.andThen(
      WelcomeReaders.use((readers) => readers.readerOf(userId)).pipe(
        Effect.provide(
          WorkspaceWelcomeReaders.pipe(
            Layer.provide(AccountStanding.layer),
            Layer.provide(
              Layer.succeed(
                MemberDirectory,
                MemberDirectory.of({
                  account,
                  membership: () => Effect.die("not read for a welcome"),
                  memberships: () => Effect.die("not read for a welcome"),
                })
              )
            )
          )
        )
      )
    )
  );

const bannedUntil = (iso: string | null) =>
  Option.some({
    expiresAt: Option.fromNullOr(iso).pipe(
      Option.map((end) => DateTime.makeUnsafe(end))
    ),
  });

describe("the accounts welcomes go to", () => {
  it.effect.each([
    { account: accountWith({}), confirmed: true, what: "confirmed" },
    {
      account: accountWith({ emailVerified: false }),
      confirmed: false,
      what: "not confirmed",
    },
    {
      account: accountWith({ ban: bannedUntil("2026-11-24T00:00:00Z") }),
      confirmed: true,
      what: "confirmed, whose ban is over",
    },
  ])("are read as they are now: $what", ({ account, confirmed }) =>
    Effect.gen(function* read() {
      assert.deepStrictEqual(
        yield* readerIn(() => Effect.succeedSome(account)),
        Option.some({
          email: "ada@example.test",
          emailConfirmed: confirmed,
          locale: "fr",
        })
      );
    })
  );

  it.effect.each([
    { account: Option.none(), what: "gone" },
    {
      account: Option.some(accountWith({ ban: bannedUntil(null) })),
      what: "banned for good",
    },
    {
      account: Option.some(
        accountWith({ ban: bannedUntil("2026-11-26T00:00:00Z") })
      ),
      what: "banned for a while",
    },
  ])("leave out one that is $what", ({ account }) =>
    Effect.gen(function* leftOut() {
      assert.deepStrictEqual(
        yield* readerIn(() => Effect.succeed(account)),
        Option.none()
      );
    })
  );

  it.effect("cannot be read while the directory cannot", () =>
    Effect.gen(function* unavailable() {
      const failure = yield* readerIn(() =>
        Effect.fail(new DirectoryUnavailable({ cause: new Error("down") }))
      ).pipe(Effect.flip);

      assert.strictEqual(failure._tag, "RecipientsUnavailable");
    })
  );
});
