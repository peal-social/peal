import { describe, expect, it } from "@effect/vitest";
import { Exit, Schema } from "effect";

import {
  ArticleDecisionSchema,
  ArticleFailureReasonSchema,
  postReasonsReadAsContentRejected,
} from "#articles/domain/article-failure.ts";
import { ArticleStateSchema } from "#articles/domain/article.ts";

// What a release before articles had reasons of their own may have
// stored: a failure reason of posts that is none of articles' ten, as when
// a site answered one of the codes posts read as Peal's own. Such a row
// reads as the content refused, its code kept; articles write only the
// ten, and anything else still fails to decode.

const StateJson = Schema.toCodecJson(ArticleStateSchema);

const DecisionJson = Schema.toCodecJson(ArticleDecisionSchema);

const schedule = { at: "2026-06-15T08:00:00.000Z", timeZone: "Europe/Paris" };

const failedAt = "2026-06-15T08:00:05.000Z";

// A failed state as stored, with the code when one is given.
const failedState = (reason: string, code?: string) =>
  code === undefined
    ? { _tag: "failed", failedAt, reason, schedule }
    : { _tag: "failed", code, failedAt, reason, schedule };

// A settle decision as stored, with the code when one is given.
const failedDecision = (reason: string, code?: string) => ({
  _tag: "settle",
  settlement:
    code === undefined
      ? { _tag: "failed", reason }
      : { _tag: "failed", code, reason },
});

describe("a stored reason of posts that is none of an article's", () => {
  it.each(postReasonsReadAsContentRejected)(
    "reads %s in an article's state as the content refused, its code kept",
    (reason) => {
      const read = Schema.decodeUnknownSync(StateJson)(
        failedState(reason, reason)
      );

      expect(read).toStrictEqual(
        Schema.decodeUnknownSync(StateJson)(
          failedState("contentRejected", reason)
        )
      );
      expect(Schema.encodeSync(StateJson)(read)).toStrictEqual(
        failedState("contentRejected", reason)
      );
      expect(
        Schema.encodeSync(StateJson)(
          Schema.decodeUnknownSync(StateJson)(failedState(reason))
        )
      ).toStrictEqual(failedState("contentRejected"));
    }
  );

  it.each(postReasonsReadAsContentRejected)(
    "reads %s in a stored attempt's decision as the content refused, its code kept",
    (reason) => {
      const read = Schema.decodeUnknownSync(DecisionJson)(
        failedDecision(reason, "site_code")
      );

      expect(read).toStrictEqual({
        _tag: "settle",
        settlement: {
          _tag: "failed",
          code: "site_code",
          reason: "contentRejected",
        },
      });
      expect(Schema.encodeSync(DecisionJson)(read)).toStrictEqual(
        failedDecision("contentRejected", "site_code")
      );
    }
  );

  it.each(ArticleFailureReasonSchema.literals)(
    "keeps an article's own %s as it was stored",
    (reason) => {
      for (const stored of [
        failedState(reason),
        failedState(reason, "site_code"),
      ]) {
        expect(
          Schema.encodeSync(StateJson)(
            Schema.decodeUnknownSync(StateJson)(stored)
          )
        ).toStrictEqual(stored);
      }

      for (const stored of [
        failedDecision(reason),
        failedDecision(reason, "site_code"),
      ]) {
        expect(
          Schema.encodeSync(DecisionJson)(
            Schema.decodeUnknownSync(DecisionJson)(stored)
          )
        ).toStrictEqual(stored);
      }
    }
  );

  it("still refuses a reason nobody writes", () => {
    for (const reason of ["notAReason", "ContentRejected", ""]) {
      expect(
        Exit.isFailure(
          Schema.decodeUnknownExit(StateJson)(failedState(reason, "x"))
        )
      ).toBeTruthy();
      expect(
        Exit.isFailure(
          Schema.decodeUnknownExit(DecisionJson)(failedDecision(reason))
        )
      ).toBeTruthy();
    }
  });
});
