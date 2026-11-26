import type { PublishResult } from "#shared/domain/publish-result.ts";

/** What a search of the site for an article's post found. */
export type SiteSearch =
  | { readonly _tag: "found"; readonly result: PublishResult }
  | { readonly _tag: "none" }
  | { readonly _tag: "several" };
