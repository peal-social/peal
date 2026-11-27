import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import type { Article, ArticlePage } from "peal-contract";

import { everyArticle } from "#articles/api.ts";

const article: Article = {
  authorId: null,
  body: { content: [], type: "doc" },
  categories: [],
  channelId: "00000000-0000-7000-8000-0000000000d1",
  coverMediaId: null,
  createdAt: DateTime.makeUnsafe("2026-11-13T09:00:00Z"),
  excerpt: null,
  id: "first",
  siteStatus: "publish",
  state: { _tag: "draft" },
  tags: [],
  title: "Spring sowing",
  updatedAt: DateTime.makeUnsafe("2026-11-13T09:00:00Z"),
};

// The API has no filter by website, so a blog reads every page and keeps
// its own articles.
describe("the workspace's articles", () => {
  it.effect("are read page after page, every one of them", () =>
    Effect.gen(function* paged() {
      const asked: (string | undefined)[] = [];

      const pages = new Map<string | undefined, ArticlePage>([
        [undefined, { items: [article], nextCursor: "a" }],
        ["a", { items: [{ ...article, id: "second" }], nextCursor: null }],
      ]);

      const all = yield* everyArticle((cursor) => {
        asked.push(cursor);

        return Effect.succeed(
          pages.get(cursor) ?? { items: [], nextCursor: null }
        );
      });

      assert.deepStrictEqual(
        all.items.map(({ id }) => id),
        ["first", "second"]
      );
      assert.deepStrictEqual(asked, [undefined, "a"]);
    })
  );
});
