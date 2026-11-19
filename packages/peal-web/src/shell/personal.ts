/**
 * The person's own pages, across their workspaces, and the page that makes
 * one more. `/` is no page of theirs: it opens a workspace.
 */
export type PersonalPage =
  | "account"
  | "agenda"
  | "newWorkspace"
  | "notices"
  | "report";

const paths: Readonly<Record<PersonalPage, string>> = {
  account: "/account",
  agenda: "/agenda",
  newWorkspace: "/new",
  notices: "/notices",
  report: "/report",
};

/** The order the sidebar lists them in; a new workspace is under theirs. */
export const personalPages: readonly PersonalPage[] = [
  "agenda",
  "report",
  "notices",
  "account",
];

/** Where a personal page is. */
export const personalHrefOf = (page: PersonalPage): string => paths[page];

/**
 * The personal page a path (without its locale) shows: its own address, or
 * one under it (the notices' preferences are the notices'); null for a
 * path that is none of them.
 */
export const personalPageAt = (pathname: string): PersonalPage | null =>
  [...personalPages, "newWorkspace" as const].find(
    (page) => pathname === paths[page] || pathname.startsWith(`${paths[page]}/`)
  ) ?? null;
