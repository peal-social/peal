/**
 * A workspace's slug: the name its pages go by in the web app's addresses
 * (`/<slug>/posts`, `/fr/<slug>/posts`). It is given when the workspace
 * is made, and whoever may rename the workspace may change it after;
 * renaming alone keeps it. The server's own links name a workspace by its
 * id, so they keep working when its slug changes.
 *
 * A slug is lower-case ASCII letters and digits in words joined by single
 * hyphens, at most `workspaceSlugMaxLength` characters. It is never the
 * first segment of another of the web app's addresses
 * (`reservedWorkspaceSlugs`), and never shaped as a UUID, which is how a
 * workspace's id is written: an address that holds an id is the form the
 * server's emails use, which the web app sends on to the slug.
 */
export const workspaceSlugMaxLength = 48;

/** The person's own pages, across their workspaces: `/agenda`… */
export const personalPageSegments: readonly string[] = [
  "account",
  "agenda",
  "new",
  "notices",
  "report",
];

/**
 * Every first segment of the web app's addresses that is not a workspace:
 * the person's pages, the other pages (a test reads the web app's folders
 * so none is left out), what the proxy and the server answer, the
 * languages, and `app`, the old prefix.
 */
export const reservedWorkspaceSlugs: readonly string[] = [
  ...personalPageSegments,
  "admin",
  "cancel",
  "connect",
  "contract-request",
  "data-deletion",
  "device",
  "forgot-password",
  "invitations",
  "oauth",
  "reset-password",
  "review",
  "sign-in",
  "sign-up",
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

/** The most characters a slug's tail keeps. */
export const workspaceSlugTailMaxLength = 24;

/**
 * A slug for a workspace of this name that is always one: its words, or
 * `workspace` for a name without any, then `tail` after a hyphen, so two
 * workspaces may share a name. The tail is written as words too (the name
 * part of an email address, `sam.lee` as `sam-lee`, or a few
 * random letters and digits), at most `workspaceSlugTailMaxLength`
 * characters.
 */
export const workspaceSlugOf = (name: string, tail: string): string => {
  const end = wordsOf(tail, workspaceSlugTailMaxLength);
  const limit = workspaceSlugMaxLength - end.length - 1;
  const words = wordsOf(name, limit);
  const start = words === "" ? "workspace" : words;

  return end === "" ? start : `${start}-${end}`;
};

/**
 * The tail a person's first workspace takes: the name part of their email
 * address (`sam.lee` of `sam.lee@example.com`), which
 * `workspaceSlugOf` writes as words.
 */
export const emailSlugTailOf = (email: string): string => {
  const at = email.lastIndexOf("@");

  return at === -1 ? email : email.slice(0, at);
};
