// How a request's API key is checked, on the whole app: Peal reads the key's
// row and writes nothing to it, refuses one turned off, and leaves to
// Better Auth what its row asks of the library (an expiry passed, a quota
// of requests).
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

import {
  apiKeyOf,
  MigratedSqlLive,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "./harness.ts";

const VerificationLive = Layer.mergeAll(
  TestApp.layerWith(unconfirmedEmails),
  MigratedSqlLive
);

const KeyRowSchema = Schema.Struct({
  lastRequest: Schema.NullOr(Schema.String),
  remaining: Schema.NullOr(Schema.Number),
  updatedAt: Schema.String,
});

// The key's row as stored, or none once it is gone.
const rowOf = (apiKeyId: string) =>
  Effect.gen(function* row() {
    const sql = yield* SqlClient.SqlClient;

    const rows = yield* sql`
      SELECT last_request::text AS "lastRequest", remaining,
             updated_at::text AS "updatedAt"
      FROM auth.apikey WHERE id = ${apiKeyId}`;

    return rows.length === 0
      ? undefined
      : Schema.decodeUnknownSync(KeyRowSchema)(rows[0]);
  });

// A key of a new workspace, and how a request with it is answered.
const keyed = (label: string) =>
  Effect.gen(function* key() {
    const app = yield* TestApp;
    const owner = yield* signedUpUnconfirmed(label);
    const workspaceId = yield* workspaceOf(owner, `${label} studio`);
    const created = yield* apiKeyOf(owner, workspaceId, ["post:read"]);

    const call = app
      .request("/api/v1/credential", {
        headers: { authorization: `Bearer ${created.key}` },
      })
      .pipe(Effect.map((reply) => reply.status));

    return { call, id: created.apiKey.id };
  });

layer(VerificationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "an API key's check",
  (it) => {
    it.effect("lets the key in and writes nothing to its row", () =>
      Effect.gen(function* noWrites() {
        const { call, id } = yield* keyed("key-no-writes");
        const before = yield* rowOf(id);

        for (let request = 0; request < 3; request += 1) {
          assert.strictEqual(yield* call, 200);
        }

        assert.deepStrictEqual(yield* rowOf(id), before);
      })
    );

    it.effect("refuses a key turned off", () =>
      Effect.gen(function* disabled() {
        const sql = yield* SqlClient.SqlClient;
        const { call, id } = yield* keyed("key-disabled");

        yield* sql`UPDATE auth.apikey SET enabled = false WHERE id = ${id}`;

        assert.strictEqual(yield* call, 401);
      })
    );

    it.effect("refuses a key past its expiry, which Better Auth deletes", () =>
      Effect.gen(function* expired() {
        const sql = yield* SqlClient.SqlClient;
        const { call, id } = yield* keyed("key-expired");

        yield* sql`UPDATE auth.apikey SET expires_at = now() - interval '1 minute' WHERE id = ${id}`;

        assert.strictEqual(yield* call, 401);
        assert.isUndefined(yield* rowOf(id));
      })
    );

    it.effect("leaves a key with a quota of requests to Better Auth", () =>
      Effect.gen(function* quota() {
        const sql = yield* SqlClient.SqlClient;
        const { call, id } = yield* keyed("key-quota");

        yield* sql`UPDATE auth.apikey SET remaining = 2 WHERE id = ${id}`;

        assert.strictEqual(yield* call, 200);
        assert.strictEqual((yield* rowOf(id))?.remaining, 1);
        assert.strictEqual(yield* call, 200);
        assert.strictEqual(yield* call, 401);
      })
    );
  }
);
