import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

import { UserIdSchema } from "#shared/domain/ids.ts";
import { DatabaseTest } from "#test/channels/support.ts";
import { AccountStore } from "#workspace/application/account-store.ts";
import { DrizzleAccountStore } from "#workspace/infrastructure/drizzle-account-store.ts";

// What an unclaimed closure checks, before Stripe and again in its
// transaction: an account is closed only while its address is unconfirmed,
// so a confirmation that committed first keeps it.

const StoreTest = DrizzleAccountStore.pipe(Layer.provideMerge(DatabaseTest));

const account = Effect.fn("account")(function* account(confirmed: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const id = randomUUID();

  yield* sql`
    INSERT INTO auth."user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${id}, 'Synthetic Person', ${`held+${id}@example.test`}, ${confirmed}, now(), now())`;

  return UserIdSchema.make(id);
});

layer(StoreTest)("holding an unconfirmed account", (it) => {
  it.effect("holds an account whose address is still unconfirmed", () =>
    Effect.gen(function* unconfirmed() {
      const store = yield* AccountStore;

      assert.isTrue(yield* store.holdUnconfirmed(yield* account(false)));
    })
  );

  it.effect("refuses one confirmed meanwhile", () =>
    Effect.gen(function* confirmed() {
      const store = yield* AccountStore;
      const sql = yield* SqlClient.SqlClient;
      const userId = yield* account(false);

      // The owner's confirmation commits first.
      yield* sql`UPDATE auth."user" SET email_verified = true WHERE id = ${userId}`;

      assert.isFalse(yield* store.holdUnconfirmed(userId));
      assert.isFalse(yield* store.holdUnconfirmed(yield* account(true)));
    })
  );
});
