import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { ArticleSummary, Post, PostSort } from "peal-contract";

import {
  listedArticles,
  pageRows,
  postPlace,
} from "#posts/articles-among-posts.ts";
import type { PostsRow } from "#posts/articles-among-posts.ts";

// Ids as the server makes them: UUIDv7, in lowercase, so made in order.
const idOf = (made: number) =>
  `019a0000-0000-7000-8000-${String(made).padStart(12, "0")}`;

const at = (day: number) =>
  DateTime.makeUnsafe(`2026-12-${String(day).padStart(2, "0")}T09:00:00Z`);

const post = (made: number, day: number | null = null): Post => ({
  authorId: null,
  content: { media: [], overrides: [], text: `Synthetic post ${made}` },
  createdVia: null,
  id: idOf(made),
  occurrence: null,
  outcome: null,
  queueId: null,
  recyclingId: null,
  schedule: day === null ? null : { at: at(day), timeZone: "Europe/Paris" },
  scheduledBy: null,
  scheduledVia: null,
  shortenLinks: false,
  status: day === null ? "draft" : "scheduled",
  tagIds: [],
  targets: [],
});

const article = (
  made: number,
  day: number | null = null,
  state?: ArticleSummary["state"]
): ArticleSummary => ({
  authorId: null,
  categories: [],
  channelId: "019a0000-0000-7000-8000-00000000c001",
  coverMediaId: null,
  createdAt: at(1),
  excerpt: null,
  id: idOf(made),
  siteStatus: "publish",
  state:
    state ??
    (day === null
      ? { _tag: "draft" }
      : { _tag: "scheduled", scheduledAt: at(day), timeZone: "Europe/Paris" }),
  tags: [],
  title: `Synthetic article ${made}`,
  updatedAt: at(1),
});

const ids = (rows: readonly PostsRow[]) =>
  rows.map((row) => (row._tag === "post" ? row.post.id : row.article.id));

// Every page of the list, as Show more opens them, `size` posts each.
const everyPage = (
  posts: readonly Post[],
  articles: readonly ArticleSummary[],
  sort: PostSort,
  size: number
) => {
  const pages: (readonly PostsRow[])[] = [];

  for (let start = 0; start === 0 || start < posts.length; start += size) {
    const page = posts.slice(start, start + size);
    const previous = posts[start - 1];

    pages.push(
      pageRows({
        after: previous === undefined ? undefined : postPlace(previous),
        articles,
        more: start + size < posts.length,
        posts: page,
        sort,
      })
    );
  }

  return pages;
};

describe(pageRows, () => {
  // Made in this order: article 1, posts 2 and 3, article 4, posts 5 and
  // 6, article 7, post 8, article 9.
  const posts = [post(2, 20), post(3, 5), post(5, 12), post(6, 2), post(8, 9)];

  const articles = [
    article(1, 15),
    article(4, 7),
    article(7, null),
    article(9, 25),
  ];

  it("puts each article where it was made, newest first, over three pages", () => {
    const pages = everyPage(posts.toReversed(), articles, "createdDesc", 2);

    expect(pages.map(ids)).toStrictEqual([
      [idOf(9), idOf(8), idOf(7), idOf(6)],
      [idOf(5), idOf(4), idOf(3)],
      [idOf(2), idOf(1)],
    ]);
  });

  it("puts each article where it was made, oldest first", () => {
    const pages = everyPage(posts, articles, "createdAsc", 2);

    expect(pages.flatMap(ids)).toStrictEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(idOf)
    );
    expect(pages.map(ids)[0]).toStrictEqual([idOf(1), idOf(2), idOf(3)]);
  });

  it("orders by time, leaving out the articles without one", () => {
    const soonest = posts.toSorted(
      (left, right) =>
        (left.schedule === null
          ? 0
          : DateTime.toEpochMillis(left.schedule.at)) -
        (right.schedule === null
          ? 0
          : DateTime.toEpochMillis(right.schedule.at))
    );

    const ascending = everyPage(soonest, articles, "scheduledAsc", 2);

    // Days 2, 5, 7, 9, 12, 15, 20, 25.
    expect(ascending.map(ids)).toStrictEqual([
      [idOf(6), idOf(3)],
      [idOf(4), idOf(8), idOf(5)],
      [idOf(1), idOf(2), idOf(9)],
    ]);

    const descending = everyPage(
      soonest.toReversed(),
      articles,
      "scheduledDesc",
      2
    );

    expect(descending.flatMap(ids)).toStrictEqual(
      ascending.flatMap(ids).toReversed()
    );
    expect(descending.map(ids)[0]).toStrictEqual([
      idOf(9),
      idOf(2),
      idOf(1),
      idOf(5),
    ]);
  });

  it("shows every article when there is no post", () => {
    expect(
      ids(
        pageRows({
          after: undefined,
          articles,
          more: false,
          posts: [],
          sort: "createdDesc",
        })
      )
    ).toStrictEqual([idOf(9), idOf(7), idOf(4), idOf(1)]);
  });

  it("holds an article older than the last post on the last page only", () => {
    const [first, last] = everyPage(
      [post(8), post(6)],
      [article(1)],
      "createdDesc",
      1
    );

    expect(first?.map((row) => row._tag)).toStrictEqual(["post"]);
    expect(last?.map((row) => row._tag)).toStrictEqual(["post", "article"]);
  });
});

describe(listedArticles, () => {
  const draft = article(1);

  const published = article(2, 3, {
    _tag: "published",
    editedAt: null,
    permalink: null,
    platformPostId: "synthetic-1",
    publishedAt: at(3),
    removedAt: null,
    scheduledAt: at(3),
    timeZone: "Europe/Paris",
  });

  const all = [draft, published];

  it("keeps every article without a filter", () => {
    expect(listedArticles({}, all)).toStrictEqual(all);
    expect(listedArticles({ type: "article" }, all)).toStrictEqual(all);
  });

  it("keeps none for the posts alone, a channel, a tag or a queue", () => {
    expect(listedArticles({ type: "post" }, all)).toStrictEqual([]);
    expect(listedArticles({ channelId: idOf(50) }, all)).toStrictEqual([]);
    expect(listedArticles({ tagId: idOf(50) }, all)).toStrictEqual([]);
    expect(listedArticles({ queueId: idOf(50) }, all)).toStrictEqual([]);
  });

  it("reads an article on its site as a finished post that went out", () => {
    expect(listedArticles({ status: "draft" }, all)).toStrictEqual([draft]);
    expect(listedArticles({ status: "finished" }, all)).toStrictEqual([
      published,
    ]);
    expect(
      listedArticles({ outcome: "published", status: "finished" }, all)
    ).toStrictEqual([published]);
    expect(
      listedArticles({ outcome: "failed", status: "finished" }, all)
    ).toStrictEqual([]);
    expect(listedArticles({ status: "awaitingApproval" }, all)).toStrictEqual(
      []
    );
  });
});
