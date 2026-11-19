import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";
import { Client } from "pg";

/** A workspace the browser opened: its slug, which its addresses hold, and its id. */
export interface OpenedWorkspace {
  readonly id: string;
  readonly slug: string;
}

// A workspace's page at the root (`/<slug>`, `/fr/<slug>`), as the one made
// for someone writes it: their name's words and eight hexadecimal digits,
// so no other page at the root (`/sign-in`) passes for it.
const workspacePage = /\/(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8})$/u;

/**
 * The workspace the browser is on once `/` opened it: the person's own,
 * or the one made for them when they had none, which the page creates
 * before it moves on. Its id, which the seeding helpers take, is read
 * straight in the database the run's server uses, by its slug.
 */
export const openedWorkspace = async (
  browser: Browser
): Promise<OpenedWorkspace> => {
  // Creating the workspace, then rendering its page on the server, takes a
  // loaded machine longer than an assertion's 5 seconds.
  await expect(browser).toHaveURL(workspacePage, { timeout: 30_000 });

  const { pathname } = new URL(await browser.url());
  const slug = workspacePage.exec(pathname)?.groups?.["slug"] ?? "";

  const client = new Client({
    connectionString: process.env["DATABASE_URL"],
  });

  await client.connect();

  try {
    const found = await client.query<{ readonly id: string }>(
      "SELECT id FROM auth.organization WHERE slug = $1",
      [slug]
    );

    return { id: found.rows[0]?.id ?? "", slug };
  } finally {
    await client.end();
  }
};

/**
 * The name of the workspace `/` makes for someone without one, in
 * English: their name's first word, then "’s workspace".
 */
export const defaultWorkspaceOf = (name: string): string =>
  `${name.trim().split(/\s+/u)[0] ?? ""}’s workspace`;
