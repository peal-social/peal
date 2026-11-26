import { Effect, Layer } from "effect";

import { ArticleStore } from "#articles/application/article-store.ts";
import { RecordedArticles } from "#publishing/application/recorded-articles.ts";

/** RecordedArticles from the articles' own records (`ArticleStore.recordedOn`). */
export const StoreRecordedArticles = Layer.effect(
  RecordedArticles,
  Effect.gen(function* StoreRecordedArticles() {
    const store = yield* ArticleStore;

    return RecordedArticles.of({ among: store.recordedOn });
  })
);
