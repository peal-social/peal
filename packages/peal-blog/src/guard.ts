// Which paths the blog refuses before EmDash sees them.
//
// EmDash serves its admin and API at the origin's root, /_emdash/…, whatever
// Astro's base, and the pages under the base. Astro's router also matches a
// route with the base left out, and EmDash's own checks only know the root
// prefix, as written: under <base>/_emdash its API would take a request for
// a public page and skip its CSRF check. So, with a base, the blog answers
// 404 to every path but
//
// - the pages under the base, but <base>/_emdash/… in any case or encoding;
// - EmDash's own, /_emdash/…, exactly as EmDash spells it,
//
// so that it also answers nothing of the site it shares a host name with
// (/, /robots.txt, /sitemap.xml). Without a base (in development), nothing.
//
// The pathname this sees is Astro's: dot segments already resolved and
// backslashes read as slashes, so /blog/%2e%2e/_emdash arrives here as
// /_emdash. The server (server/raw-path.ts) refuses those spellings in the
// target as sent, before Astro reads it.

const edgeSlashes = /^\/+|\/+$/gu;

const repeatedSlashes = /\/{2,}/gu;

/** The path as the router reads it: decoded, without repeated slashes. */
const normalised = (pathname: string): string | undefined => {
  try {
    return decodeURIComponent(pathname).replaceAll(repeatedSlashes, "/");
  } catch {
    return undefined;
  }
};

/** Whether a path is `prefix` itself or below it. */
const within = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Whether the blog refuses `pathname` when built with `base`. */
export const refused = (pathname: string, base: string): boolean => {
  const name = base.replaceAll(edgeSlashes, "");

  if (name === "") {
    return false;
  }

  const path = normalised(pathname);

  if (path === undefined) {
    return true;
  }

  const lower = path.toLowerCase();

  const prefix = `/${name.toLowerCase()}`;

  if (within(lower, prefix)) {
    return lower.startsWith(`${prefix}/_emdash`);
  }

  // EmDash's routes, only as EmDash's checks spell them: the pathname as
  // Astro gives it, before this decodes it.
  return !within(pathname, "/_emdash");
};
