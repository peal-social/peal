import { readFile } from "node:fs/promises";
import path from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Schema } from "effect";

import { WelcomeOutcomeSchema } from "#notifications/domain/welcome.ts";
import { DeliverNoticeV1 } from "#notifications/infrastructure/workflows/deliver-notice.ts";
import {
  attemptName,
  waitClockName,
  welcomeChecks,
  WelcomeV1,
} from "#notifications/infrastructure/workflows/welcome.ts";

// Every history ever stored must still decode with the current code, and its
// execution id must come out the same from its payload: changed, an event's
// emails, or an account's welcome, started again after a deploy would get a
// second execution. Keep the fixtures when the schemas change, and add new
// ones beside them.

const fixtures = path.join(import.meta.dirname, "fixtures", "persisted");

// Reads a workflow's fixture as the JSON it is and decodes it with `schema`.
const fixture = <S extends Schema.Top>(
  workflow: string,
  name: string,
  schema: S
) =>
  Effect.promise(
    async () => await readFile(path.join(fixtures, workflow, name), "utf-8")
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.fromJsonString(Schema.toCodecJson(schema))
      )
    )
  );

const KeysSchema = Schema.Struct({ executionId: Schema.String });

describe("the persisted contract of DeliverNoticeV1", () => {
  it("keeps its tag", () => {
    assert.strictEqual(DeliverNoticeV1._tag, "DeliverNoticeV1");
  });

  it.effect("decodes its payloads, and derives the same execution ids", () =>
    Effect.gen(function* derivesTheSameIds() {
      const payload = yield* fixture(
        "DeliverNoticeV1",
        "payload.json",
        DeliverNoticeV1.payloadSchema
      );

      const keys = yield* fixture("DeliverNoticeV1", "keys.json", KeysSchema);

      assert.strictEqual(
        yield* DeliverNoticeV1.executionId(payload),
        keys.executionId
      );
    })
  );
});

describe("the persisted contract of WelcomeV1", () => {
  it("keeps its tag, and the names of its steps", () => {
    assert.strictEqual(WelcomeV1._tag, "WelcomeV1");
    assert.strictEqual(attemptName(1), "attempt/1");
    assert.strictEqual(waitClockName(1), "wait/1");
    // A welcome that waits now has the checks before its own behind it.
    assert.deepStrictEqual(
      welcomeChecks.map((wait) => Duration.toMinutes(wait)),
      [5, 15, 60, 360, 1440, 4320]
    );
  });

  it.effect("decodes its payloads, and derives the same execution ids", () =>
    Effect.gen(function* derivesTheSameIds() {
      const payload = yield* fixture(
        "WelcomeV1",
        "payload.json",
        WelcomeV1.payloadSchema
      );

      const keys = yield* fixture("WelcomeV1", "keys.json", KeysSchema);

      assert.strictEqual(
        yield* WelcomeV1.executionId(payload),
        keys.executionId
      );
    })
  );

  it.effect("decodes every outcome a check stored", () =>
    Effect.gen(function* decodesOutcomes() {
      const decode = Schema.decodeUnknownEffect(WelcomeOutcomeSchema);

      assert.deepStrictEqual(
        yield* Effect.forEach(["sent", "wait", "skip"], (outcome) =>
          decode(outcome)
        ),
        ["sent", "wait", "skip"]
      );
    })
  );
});
