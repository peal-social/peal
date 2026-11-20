/**
 * A workspace's slug: the name its pages go by in the web app's addresses
 * (`/<slug>/posts`, `/fr/<slug>/posts`). The person who makes the
 * workspace chooses it, and whoever may rename the workspace may change it
 * after; renaming alone keeps it. The server's own links name a workspace
 * by its id, so they keep working when its slug changes.
 *
 * A slug is lower-case ASCII letters and digits in words joined by single
 * hyphens, at most `workspaceSlugMaxLength` characters. It is never the
 * first segment of another of the web app's addresses
 * (`reservedWorkspaceSlugs`), and never shaped as a UUID, which is how a
 * workspace's id is written: an address that holds an id is the form the
 * server's emails use, which the web app sends on to the slug.
 */
export const workspaceSlugMaxLength = 48;

/**
 * Every first segment of the web app's addresses that is not a workspace:
 * its other pages (`create`, where another workspace is made, and the rest:
 * a test reads the web app's folders so none is left out), what the proxy
 * and the server answer, the languages, and `app`, the old prefix.
 */
export const reservedWorkspaceSlugs: readonly string[] = [
  "admin",
  "cancel",
  "connect",
  "contract-request",
  "create",
  "data-deletion",
  "device",
  "forgot-password",
  "invitations",
  "login",
  "oauth",
  "reset-password",
  "review",
  "signup",
  "verify-email",
  "withdraw",
  "api",
  "emoji-data",
  "pulse",
  "llms.txt",
  "openapi.json",
  "favicon.ico",
  "icon.svg",
  "apple-icon.png",
  "_next",
  ".well-known",
  "en",
  "fr",
  "app",
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Whether a workspace may be made with this slug. */
export const isWorkspaceSlug = (slug: string): boolean =>
  slug.length <= workspaceSlugMaxLength &&
  slugPattern.test(slug) &&
  !idPattern.test(slug) &&
  !reservedWorkspaceSlugs.includes(slug);

// A name's words in lower-case ASCII, joined by hyphens: accents dropped,
// apostrophes too (so "Maxime’s" is "maximes"), at most `limit` characters,
// cut where a word ends when one does before it.
const wordsOf = (name: string, limit: number): string => {
  const words = name
    .normalize("NFKD")
    .replaceAll(/\p{M}+/gu, "")
    .replaceAll(/['’]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

  return words.slice(0, limit).replaceAll(/-+$/gu, "");
};

/**
 * The slug a workspace of this name would take, its words alone
 * (`maximes-workspace`): it may be reserved, taken or empty, which
 * `isWorkspaceSlug` and the server tell.
 */
export const workspaceSlugWordsOf = (name: string): string =>
  wordsOf(name, workspaceSlugMaxLength);

/**
 * A slug for a workspace of this name that is always one: its words, or
 * `workspace` for a name without any, then `tail` (letters and digits, such
 * as a few random ones) after a hyphen, so two workspaces may share a name.
 */
export const workspaceSlugOf = (name: string, tail: string): string => {
  const end = tail
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "")
    .slice(0, 12);

  const limit = workspaceSlugMaxLength - end.length - 1;
  const words = wordsOf(name, limit);
  const start = words === "" ? "workspace" : words;

  return end === "" ? start : `${start}-${end}`;
};
