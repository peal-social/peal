import { hasLocale } from "next-intl";

import { pathOf } from "#errors/report.ts";
import { routing } from "#i18n/routing.ts";

/** A page of the signed-in app, as the web app measures it. */
export interface Place {
  /** The page's path without its language, query or ids: `/app/:id/posts`. */
  readonly pattern: string;
  /** The workspace whose page it is, none for the person's own pages. */
  readonly workspaceId: string | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// The path without the language before it: French is under /fr.
const withoutLocale = (pathname: string): string => {
  const [, first = "", ...rest] = pathname.split("/");

  return hasLocale(routing.locales, first) ? `/${rest.join("/")}` : pathname;
};

/**
 * A path's pattern: without its language, its query or its fragment, each
 * id written `:id`.
 */
export const patternOf = (path: string): string =>
  pathOf(withoutLocale(pathOf(path)));

/** An address as its origin and its page's pattern, or the pattern alone. */
export const addressOf = (address: string): string => {
  const url = URL.parse(address);

  return url === null
    ? patternOf(address)
    : `${url.origin}${patternOf(url.pathname)}`;
};

/**
 * The page a path is, when it is one of the signed-in app's (`/app` and
 * under it): none for every other page, the auth pages, the OAuth pages,
 * connect links, review links and the staff console included.
 */
export const placeOf = (pathname: string): Place | null => {
  const pattern = patternOf(pathname);

  if (pattern !== "/app" && !pattern.startsWith("/app/")) {
    return null;
  }

  const segments = withoutLocale(pathname.split(/[?#]/u)[0] ?? "").split("/");
  const second = segments.at(2) ?? "";

  return { pattern, workspaceId: uuid.test(second) ? second : null };
};
