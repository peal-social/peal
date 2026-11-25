import { describe, expect, it } from "@effect/vitest";

import {
  articleListChanged,
  articleListKeys,
  articlesKeys,
} from "#articles/api.ts";
import { feedItemsKeys, feedListChanged, feedListKeys } from "#feeds/atoms.ts";
import { mediaKey, mediaUsageKeys } from "#media/atoms.ts";
import {
  discardRequestOf,
  postListKeys,
  postListsChanged,
  postsKeys,
} from "#posts/api.ts";
import {
  queueListChanged,
  queueListKeys,
  queueSlotsKeys,
  queuesChanged,
} from "#queues/atoms.ts";

const workspaceId = "00000000-0000-7000-8000-0000000000aa";

const shared = (one: readonly string[], other: readonly string[]) =>
  one.filter((key) => other.includes(key));

// A deletion refreshes what lists the deleted item, never a query of the
// item itself, which the page still reads when the answer lands: asked
// again, it would answer 404.
describe("what a deletion refreshes", () => {
  it("lists the queues again without reading the deleted queue's slots", () => {
    const deleted = queueListChanged(workspaceId);

    expect(shared(deleted, queueListKeys(workspaceId))).toStrictEqual(deleted);
    expect(shared(deleted, queueSlotsKeys(workspaceId))).toStrictEqual([]);
  });

  it("still refreshes a queue's slots when a queue changes", () => {
    const changed = queuesChanged(workspaceId);

    expect(shared(changed, queueListKeys(workspaceId))).toStrictEqual(changed);
    expect(shared(changed, queueSlotsKeys(workspaceId))).toStrictEqual(changed);
  });

  it("lists the feeds again without reading the deleted feed's items", () => {
    const deleted = feedListChanged(workspaceId);

    expect(shared(deleted, feedListKeys(workspaceId))).toStrictEqual(deleted);
    expect(shared(deleted, feedItemsKeys(workspaceId))).toStrictEqual([]);
  });

  it("lists the media again without reading the deleted file's usage", () => {
    expect(shared([mediaKey(workspaceId)], mediaUsageKeys)).toStrictEqual([]);
  });

  it("lists the posts again without reading the discarded draft", () => {
    const { reactivityKeys } = discardRequestOf(
      workspaceId,
      "00000000-0000-7000-8000-0000000000bb"
    );

    expect(reactivityKeys).toStrictEqual(postListsChanged);
    expect(shared(reactivityKeys, postListKeys)).toStrictEqual(reactivityKeys);
    // A post's own reads (the post, its attempts, its review) take these.
    expect(shared(reactivityKeys, [...postsKeys, "review"])).toStrictEqual([]);
  });

  it("lists the articles again without reading the deleted article", () => {
    const deleted = articleListChanged(workspaceId);

    expect(shared(deleted, articleListKeys(workspaceId))).toStrictEqual(
      deleted
    );
    expect(shared(deleted, articlesKeys(workspaceId))).toStrictEqual([]);
  });
});
