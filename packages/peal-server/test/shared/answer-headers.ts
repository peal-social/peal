import { Effect, Layer, Ref } from "effect";

import { AnswerHeaders } from "#shared/api/answer-headers.ts";

/**
 * AnswerHeaders that keep what handlers set, for a test that serves
 * handlers alone: `headers(name)` lists the values set under that name, in
 * order.
 */
export const recordedAnswerHeaders = Effect.gen(
  function* recordedAnswerHeaders() {
    const set = yield* Ref.make<readonly (readonly [string, string])[]>([]);

    const record = (name: string, value: string) =>
      Ref.update(set, (before) => [...before, [name, value] as const]);

    return {
      headers: (name: string) =>
        Ref.get(set).pipe(
          Effect.map((entries) =>
            entries.flatMap(([key, value]) =>
              key.toLowerCase() === name.toLowerCase() ? [value] : []
            )
          )
        ),
      layer: Layer.succeed(
        AnswerHeaders,
        AnswerHeaders.of({ set: record, setUnlessAnswered: record })
      ),
    };
  }
);
