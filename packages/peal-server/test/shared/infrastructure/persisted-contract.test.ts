import { readFile } from "node:fs/promises";
import path from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  attemptName,
  ForgetAnalyticsV1,
  ForgetResultSchema,
  retryClockName,
} from "#shared/infrastructure/workflows/forget-analytics.ts";

// Every ForgetAnalyticsV1 history ever stored must still decode with the
// current code, and its execution id come out the same from its payload:
// changed, an erasure started again after a deploy would get a second
// execution. Keep the fixtures when the schemas change, and add new ones
// beside them.

const fixtures = path.join(import.meta.dirname, "fixtures", "persisted");

// Reads a fixture as the JSON it is and decodes it with `schema`.
const fixture = <S extends Schema.Top>(name: string, schema: S) =>
  Effect.promise(
    async () => await readFile(path.join(fixtures, name), "utf-8")
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.fromJsonString(Schema.toCodecJson(schema))
      )
    )
  );

const KeysSchema = Schema.Struct({ executionId: Schema.String });

describe("the persisted contract of ForgetAnalyticsV1", () => {
  it("keeps its tag, how its attempts end and the names of its steps", () => {
    assert.strictEqual(ForgetAnalyticsV1._tag, "ForgetAnalyticsV1");
    assert.deepStrictEqual(ForgetResultSchema.literals, [
      "deleted",
      "manual",
      "failed",
    ]);
    assert.strictEqual(attemptName(1), "attempt/1");
    assert.strictEqual(attemptName(6), "attempt/6");
    assert.strictEqual(retryClockName(1), "retry/1");
    assert.strictEqual(retryClockName(5), "retry/5");
  });

  it.effect("decodes its payload, and derives the same execution id", () =>
    Effect.gen(function* derivesTheSameId() {
      const payload = yield* fixture(
        "ForgetAnalyticsV1/payload.json",
        ForgetAnalyticsV1.payloadSchema
      );

      const keys = yield* fixture("ForgetAnalyticsV1/keys.json", KeysSchema);

      assert.strictEqual(
        yield* ForgetAnalyticsV1.executionId(payload),
        keys.executionId
      );
      assert.lengthOf(payload.userIds, 1);
      assert.lengthOf(payload.workspaceIds, 1);
    })
  );
});
