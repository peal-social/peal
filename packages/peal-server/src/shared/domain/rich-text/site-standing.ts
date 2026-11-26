import type { DateTime } from "effect";

/**
 * How a website is to show a post Peal changes there, beside what it
 * says: as it stands (`asItIs`, an edit of a live post or an article's
 * update), held for the site to publish itself at `at` (`hold`: WordPress's
 * `future` with `date_gmt`, DEV published with a `published_at` ahead), a
 * draft Peal took back (`draft`), or out now as the options' site status
 * says (`publish`: published, or a draft to finish there).
 */
export type SiteStanding =
  | { readonly _tag: "asItIs" }
  | { readonly _tag: "draft" }
  | { readonly _tag: "hold"; readonly at: DateTime.Utc }
  | { readonly _tag: "publish" };

/** How a post the site has already stands as it is: its status and date kept. */
export const asItIs: SiteStanding = { _tag: "asItIs" };
