import { hasLocale } from "next-intl";
import { reservedWorkspaceSlugs } from "peal-contract/workspace-slug";

import { routing } from "#i18n/routing.ts";

/** A workspace as its addresses need it: its id, and the slug they hold. */
export interface WorkspaceAddress {
  readonly id: string;
  readonly slug: string;
}

/**
 * The address of a workspace's page: `/<slug>` and the rest of the path
 * (`/posts`, `/posts?status=draft`), "" for its home.
 */
export const workspacePath = (slug: string, rest = ""): string =>
  `/${encodeURIComponent(slug)}${rest}`;

/**
 * The workspace an address's first segment names: by its slug, as every
 * link writes it, or by its id, as the server's emails do (the proxy sends
 * those on to the slug, `slugAddressOf`).
 */
export const workspaceAt = <W extends WorkspaceAddress>(
  workspaces: readonly W[],
  segment: string
): W | undefined =>
  workspaces.find(({ slug }) => slug === segment) ??
  workspaces.find(({ id }) => id === segment);

/**
 * The workspace `/` opens: the one Better Auth keeps active on the
 * session, when the person still belongs to it, else their first; none
 * for someone without any.
 */
export const homeWorkspaceOf = <W extends WorkspaceAddress>(
  workspaces: readonly W[],
  active: string | null
): W | undefined => workspaces.find(({ id }) => id === active) ?? workspaces[0];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

// A path's language prefix (`/fr`, or none) and its segments after it.
const split = (
  pathname: string
): { readonly prefix: string; readonly segments: readonly string[] } => {
  const [, first = "", ...rest] = pathname.split("/");

  return hasLocale(routing.locales, first)
    ? { prefix: `/${first}`, segments: rest }
    : { prefix: "", segments: [first, ...rest] };
};

/**
 * Whether an address's first segment is a workspace's: none of the web
 * app's other pages (`reservedWorkspaceSlugs`), what a page's pattern
 * writes `:id`, as a slug holds the workspace's name.
 */
export const isWorkspaceSegment = (segment: string): boolean =>
  segment !== "" && !reservedWorkspaceSlugs.includes(segment);

/** Where another workspace is made: the setup page, its name empty. */
export const createWorkspacePath = "/create";

/**
 * Whether a path (its language, if any, before it) is the signed-in app's:
 * `/`, which opens a workspace or makes the first, `/create`, which makes
 * another, and a workspace's pages (`/<slug>/…`). The auth pages, the
 * OAuth pages, connect and review links and the staff console are not.
 */
export const isAppPath = (pathname: string): boolean => {
  const [first = ""] = split(pathname.split(/[?#]/u)[0] ?? "").segments;

  return (
    first === "" ||
    `/${first}` === createWorkspacePath ||
    isWorkspaceSegment(first)
  );
};

/**
 * Whether a path, without its query, names a workspace by its id
 * (`/<id>/posts`, `/fr/<id>`): the form the server's emails and notices
 * write.
 */
export const namesWorkspaceById = (pathname: string): boolean =>
  uuid.test(split(pathname).segments[0] ?? "");

/**
 * Where a path that names a workspace by its id goes: the same page under
 * the workspace's slug, its language and query kept. None for any other
 * path, a workspace the person does not belong to, or one whose slug is
 * its id.
 */
export const slugAddressOf = (
  url: { readonly pathname: string; readonly search: string },
  workspaces: readonly WorkspaceAddress[]
): string | null => {
  if (!namesWorkspaceById(url.pathname)) {
    return null;
  }

  const { prefix, segments } = split(url.pathname);
  const [id = "", ...rest] = segments;
  const found = workspaces.find((workspace) => workspace.id === id);

  if (found === undefined || found.slug === id) {
    return null;
  }

  const tail = rest.length === 0 ? "" : `/${rest.join("/")}`;

  return `${prefix}${workspacePath(found.slug, tail)}${url.search}`;
};
