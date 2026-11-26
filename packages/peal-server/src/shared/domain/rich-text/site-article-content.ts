import { Option } from "effect";

import type { MediaAssetId } from "#shared/domain/ids.ts";

import { bodyMediaOf } from "./rich-body.ts";
import type { ArticleBody } from "./rich-body.ts";

/**
 * What a website gets of an article, whoever sends it: its title, its
 * body, an excerpt, its tags and categories by name (found on the site,
 * or made), a file of the library as the featured image, and how it
 * lands there (`publish`, a `draft`, or `future`, the site publishing it
 * itself at the article's time).
 */
export interface SiteArticleContent {
  readonly body: ArticleBody;
  readonly categories: readonly string[];
  readonly coverMediaId: Option.Option<MediaAssetId>;
  readonly excerpt: Option.Option<string>;
  readonly siteStatus: "draft" | "future" | "publish";
  readonly tags: readonly string[];
  readonly title: string;
}

/** The library's files the article shows: its cover first, then its body's. */
export const siteArticleMediaOf = (
  content: SiteArticleContent
): readonly MediaAssetId[] => {
  const cover = Option.toArray(content.coverMediaId);

  return [
    ...cover,
    ...bodyMediaOf(content.body).filter((id) => !cover.includes(id)),
  ];
};
