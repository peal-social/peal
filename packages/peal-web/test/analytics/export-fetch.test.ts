import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

import { fetchExport } from "#analytics/export-download.ts";
import { onTwoStepRefusal } from "#two-step/refusals.ts";

// The answer the API's fetch gives, and the requests it was asked.
const answering = (response: () => Response) => {
  const asked: Request[] = [];

  const fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      asked.push(new Request(input, init));

      return await Promise.resolve(response());
    },
    {
      preconnect: () => {
        // Nothing to warm up: no request leaves the test.
      },
    }
  );

  return { asked, fetch };
};

const fetched = (response: () => Response) => {
  const { asked, fetch } = answering(response);

  return fetchExport(
    "0190f3a0-0000-7000-8000-00000000a001",
    "/api/v1/analytics/export?kind=posts",
    "http://app.test"
  ).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetch),
    Effect.map((answer) => ({ answer, asked }))
  );
};

describe(fetchExport, () => {
  it.effect("takes the file, its name and its type, naming the workspace", () =>
    Effect.gen(function* file() {
      const { answer, asked } = yield* fetched(
        () =>
          new Response("text,channels\n", {
            headers: {
              "cache-control": "no-store",
              "content-disposition":
                'attachment; filename="peal-analytics-posts.csv"',
              "content-type": "text/csv; charset=utf-8",
            },
          })
      );

      assert.strictEqual(
        asked[0]?.headers.get("peal-workspace"),
        "0190f3a0-0000-7000-8000-00000000a001"
      );
      assert.strictEqual(answer._tag, "File");

      if (answer._tag === "File") {
        assert.strictEqual(answer.name, "peal-analytics-posts.csv");
        assert.strictEqual(answer.file.type, "text/csv; charset=utf-8");
        assert.strictEqual(
          yield* Effect.promise(async () => await answer.file.text()),
          "text,channels\n"
        );
      }
    })
  );

  it.effect("tells a session that ended apart from a failure", () =>
    Effect.gen(function* signedOut() {
      const { answer } = yield* fetched(() =>
        Response.json({ _tag: "Unauthenticated" }, { status: 401 })
      );

      assert.strictEqual(answer._tag, "SignedOut");

      const failed = yield* fetched(() => new Response(null, { status: 503 }));

      assert.strictEqual(failed.answer._tag, "Failed");
    })
  );

  it.effect(
    "raises the notice of a workspace that requires two-step verification, as every call does",
    () =>
      Effect.gen(function* twoStep() {
        let told = 0;

        const stop = onTwoStepRefusal(() => {
          told += 1;
        });

        const { answer } = yield* fetched(() =>
          Response.json(
            { _tag: "Forbidden", reason: "twoStepRequired" },
            { status: 403 }
          )
        );

        stop();

        assert.strictEqual(told, 1);
        assert.strictEqual(answer._tag, "TwoStepRequired");

        const refused = yield* fetched(() =>
          Response.json(
            { _tag: "Forbidden", reason: "missingPermission" },
            { status: 403 }
          )
        );

        assert.strictEqual(refused.answer._tag, "Refused");
      })
  );
});
