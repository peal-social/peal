// The showcase's pages, at /blocks: an index by the kinds of block asked
// for, then a page per block. getStaticPaths returns none of them unless
// the showcase is on (config.ts's blocksShowcase), so a production build
// has no such page.
import { categories, decided, plannedPhase } from "./categories.ts";
import type { Category } from "./categories.ts";
import { registry } from "./registry.tsx";
import type { ShowcaseEntry } from "./registry.tsx";

/** The showcase's address for a block, or for the index. */
export const showcaseHref = (slug?: string) =>
  slug === undefined ? "/blocks" : `/blocks/${slug}`;

export const showcasePaths = (
  on: boolean,
  entries: readonly ShowcaseEntry[] = registry
) =>
  on
    ? [
        { params: { block: undefined } },
        ...entries.map((entry) => ({ params: { block: entry.slug } })),
      ]
    : [];

export interface ShowcaseCategory {
  readonly blocks: readonly ShowcaseEntry[];
  readonly category: Category;
  /** Why the kind has no block, or which phase brings its blocks. */
  readonly note?: string | undefined;
}

export const showcaseIndex = (
  entries: readonly ShowcaseEntry[] = registry
): readonly ShowcaseCategory[] =>
  categories.map((category) => {
    const blocks = entries.filter((entry) =>
      entry.categories.includes(category)
    );

    const planned = plannedPhase[category];

    return {
      blocks,
      category,
      note:
        decided[category] ??
        (blocks.length === 0 && planned !== undefined
          ? `Planned in ${planned}.`
          : undefined),
    };
  });

/** The block a page shows, by its path; undefined for the index. */
export const showcaseEntry = (block: string | undefined) =>
  block === undefined
    ? undefined
    : registry.find((entry) => entry.slug === block);
