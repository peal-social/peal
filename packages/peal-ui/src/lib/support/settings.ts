import { Schema } from "effect";

import { present } from "../site/links";

// The support chat's one setting, the Crisp website's id, read at build
// (site, docs), when the blog's server starts, or per request (the web
// app). Unset or blank turns the chat off; a value that is set but
// malformed stops the build or the start, naming the setting.

/** A Crisp website's id: a lower-case UUID, public, which browsers send. */
export const CrispWebsiteIdSchema = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    { expected: "a Crisp website id, a lower-case UUID" }
  )
);

/**
 * The website's id, or `undefined` while `value` is unset or blank. A
 * value that is set but malformed throws, naming the setting `name`.
 */
export const supportWebsiteId = (
  value: string | undefined,
  name: string
): string | undefined => {
  const id = present(value)?.toLowerCase();

  if (id === undefined) {
    return undefined;
  }

  try {
    return Schema.decodeUnknownSync(CrispWebsiteIdSchema)(id);
  } catch (error) {
    throw new Error(`${name}: ${String(error)}`, { cause: error });
  }
};

/** Where the launcher stands (DESIGN.md, "Support chat"). */
export type SupportPlacement = "bar" | "float" | "menu";

/** Who is signed in, in the app: the chat names them to Peal's team. */
export interface SupportPerson {
  readonly email: string;
  readonly name: string;
  readonly userId: string;
  readonly workspaceId: string;
}

/**
 * The attributes of a page's `<peal-support>`. The site and the blog draw
 * the pixel bubble; the app and the docs a lucide icon.
 */
export const supportAttributes = (
  websiteId: string,
  page: {
    readonly locale: string;
    readonly person?: SupportPerson | undefined;
    readonly placement: SupportPlacement;
    readonly source: "app" | "blog" | "docs" | "site";
  }
): Record<`data-${string}`, string | undefined> => ({
  "data-art":
    page.source === "site" || page.source === "blog" ? "pixel" : "icon",
  "data-email": page.person?.email,
  "data-locale": page.locale,
  "data-name": page.person?.name,
  "data-placement": page.placement,
  "data-source": page.source,
  "data-user-id": page.person?.userId,
  "data-website-id": websiteId,
  "data-workspace-id": page.person?.workspaceId,
});
