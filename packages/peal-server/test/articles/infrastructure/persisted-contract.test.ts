import { readFile } from "node:fs/promises";
import path from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  ArticleClaimSchema,
  ArticleOutcomeSchema,
} from "#articles/application/article-publication.ts";
import { ArticleDecisionSchema } from "#articles/domain/article-failure.ts";
import { ArticleStateSchema } from "#articles/domain/article.ts";
import {
  persistedArticleWorkflowTags,
  PublishArticleV1,
} from "#articles/infrastructure/workflows/publish-article.ts";
import { PublicationDecisionSchema } from "#publishing/domain/publication-policy.ts";
import { AttemptOutcomeSchema } from "#shared/domain/attempt-outcome.ts";

// What articles store: the history of a `PublishArticleV1` job, and the
// JSON of `publishing.articles.state` and `publishing.article_calls.outcome`.
// The fixtures were written by the schemas of the release that made them,
// before articles had a context of their own: every one must still decode,
// and encode again to the same JSON, so a schema that would write another
// shape fails here. Never write them again to make a test pass; add new
// ones beside them.

const fixtures = path.join(import.meta.dirname, "fixtures", "persisted");

const KeysSchema = Schema.Struct({ executionId: Schema.String });

// Reads a fixture as the JSON it is, decodes it with `schema`, and checks
// that encoding the result gives the same JSON back.
const roundTrip = <S extends Schema.Top>(
  folder: string,
  name: string,
  schema: S
) =>
  Effect.gen(function* decodesAndEncodesAgain() {
    const json = yield* Effect.promise(
      async () => await readFile(path.join(fixtures, folder, name), "utf-8")
    );

    const stored: unknown = JSON.parse(json);
    const codec = Schema.toCodecJson(schema);
    const decoded = yield* Schema.decodeUnknownEffect(codec)(stored);

    assert.deepStrictEqual(yield* Schema.encodeEffect(codec)(decoded), stored);

    return decoded;
  });

describe("the articles' persisted contract", () => {
  it("keeps registering every released workflow tag", () => {
    for (const tag of persistedArticleWorkflowTags) {
      assert.strictEqual(tag, PublishArticleV1._tag);
    }
  });

  it.effect("derives the same execution id from a stored payload", () =>
    Effect.gen(function* derivesTheSameId() {
      const payload = yield* roundTrip(
        "PublishArticleV1",
        "payload.json",
        PublishArticleV1.payloadSchema
      );

      const keys = yield* roundTrip(
        "PublishArticleV1",
        "keys.json",
        KeysSchema
      );

      assert.strictEqual(
        yield* PublishArticleV1.executionId(payload),
        keys.executionId
      );
      assert.strictEqual(payload.revision, 3);
      assert.strictEqual(payload.round, 1);
    })
  );

  it.effect("decodes every stored claim, settle and result", () =>
    Effect.gen(function* decodesTheLiterals() {
      assert.deepStrictEqual(
        yield* roundTrip(
          "PublishArticleV1",
          "claim.json",
          Schema.Array(ArticleClaimSchema)
        ),
        ["claimed", "missed", "superseded"]
      );
      assert.deepStrictEqual(
        yield* roundTrip(
          "PublishArticleV1",
          "settle.json",
          Schema.Array(ArticleOutcomeSchema)
        ),
        ["published", "failed", "unconfirmed", "superseded"]
      );
      assert.strictEqual(
        yield* roundTrip(
          "PublishArticleV1",
          "result.json",
          PublishArticleV1.successSchema
        ),
        "published"
      );
    })
  );

  it.effect("decodes every stored attempt's decision, and writes it back", () =>
    Effect.gen(function* decodesDecisions() {
      const decisions = yield* roundTrip(
        "PublishArticleV1",
        "send.json",
        Schema.Array(ArticleDecisionSchema)
      );

      // The posts' schema, which wrote them first, reads and writes them
      // the same: a job of the release before reads what this one stores.
      const asPosts = yield* roundTrip(
        "PublishArticleV1",
        "send.json",
        Schema.Array(PublicationDecisionSchema)
      );

      assert.isAbove(decisions.length, 0);
      assert.strictEqual(asPosts.length, decisions.length);
    })
  );

  it.effect("decodes every stored article state, and writes it back", () =>
    Effect.gen(function* decodesStates() {
      const states = yield* roundTrip(
        "articles",
        "state.json",
        Schema.Array(ArticleStateSchema)
      );

      assert.sameMembers(
        [...new Set(states.map(({ _tag }) => _tag))],
        [
          "draft",
          "scheduled",
          "publishing",
          "published",
          "failed",
          "unconfirmed",
        ]
      );
    })
  );

  it.effect("decodes every stored call's outcome, and writes it back", () =>
    Effect.gen(function* decodesOutcomes() {
      const outcomes = yield* roundTrip(
        "articles",
        "outcome.json",
        Schema.Array(AttemptOutcomeSchema)
      );

      assert.isAbove(outcomes.length, 0);
    })
  );
});
