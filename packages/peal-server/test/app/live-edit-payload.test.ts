// An edit of a live post asks for something to change: a text, a rich
// text or options. One that gives none is refused as the request is read,
// through the whole server, before any post is looked for.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import {
  signedUp,
  IntegrationLive,
  origin,
  TestApp,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

const CodedSchema = Schema.fromJsonString(
  Schema.Struct({ code: Schema.String })
);

const decodeCoded = Schema.decodeUnknownOption(CodedSchema);

// A post and a target no workspace has: never read, as the request is
// refused first.
const editPath =
  "/api/v1/posts/00000000-0000-7000-8000-0000000000f1/targets/00000000-0000-7000-8000-0000000000f2/edit";

const editWith = Effect.fn("editWith")(function* editWith(
  payload: string,
  cookie: string,
  workspaceId: string
) {
  const app = yield* TestApp;

  const response = yield* Effect.promise(
    async () =>
      await app.handler(
        new Request(`${origin}${editPath}`, {
          body: payload,
          headers: {
            "content-type": "application/json",
            cookie,
            origin,
            "peal-workspace": workspaceId,
          },
          method: "POST",
        })
      )
  );

  const text = yield* Effect.promise(async () => await response.text());

  return {
    code: decodeCoded(text).pipe(
      Option.map(({ code }) => code),
      Option.getOrUndefined
    ),
    status: response.status,
  };
});

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "an edit of a live post that changes nothing",
  (it) => {
    it.effect("is refused as InvalidRequest", () =>
      Effect.gen(function* refusing() {
        const owner = yield* signedUp("live-edit-payload");
        const workspaceId = yield* workspaceOf(owner, "Live edits");

        // A rich text and the same as Markdown at once is no one edit.
        for (const payload of [
          "{}",
          '{"part":0}',
          '{"body":{"content":[],"type":"doc"},"bodyMarkdown":"Both"}',
        ]) {
          assert.deepStrictEqual(
            yield* editWith(payload, owner.cookies, workspaceId),
            {
              code: "invalid_request",
              status: 400,
            }
          );
        }
      })
    );
  }
);
