import type { Article } from "peal-contract";

// Where a blog's pages are, under /<workspace>: the website's articles,
// and each article in its website's blog.

/** A website's blog: its articles. */
export const blogPathOf = (channelId: string): string => `/blogs/${channelId}`;

/** An article, in its website's blog. */
export const articlePathOf = ({
  channelId,
  id,
}: Pick<Article, "channelId" | "id">): string =>
  `${blogPathOf(channelId)}/${id}`;
