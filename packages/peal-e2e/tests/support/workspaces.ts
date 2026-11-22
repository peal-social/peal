import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";
import { reservedWorkspaceSlugs } from "peal-contract/workspace-slug";
import { Client } from "pg";

// A new workspace's second setup step, `/create/<slug>/channels`.
const setupStep = /^https?:\/\/[^/]+(?:\/fr)?\/create\/[^/]+\/channels$/u;

/** A workspace the browser opened: its slug, which its addresses hold, and its id. */
export interface OpenedWorkspace {
  readonly id: string;
  readonly slug: string;
}

// A workspace's page at the root (`/<slug>`, `/fr/<slug>`), as a full URL: a slug, never
// one of the app's other first segments (`/login`, `/create`).
const workspacePage = new RegExp(
  String.raw`^https?://[^/]+(?:/fr)?/(?<slug>(?!(?:${reservedWorkspaceSlugs
    .map((segment) => segment.replaceAll(".", String.raw`\.`))
    .join("|")})$)[a-z0-9]+(?:-[a-z0-9]+)*)$`,
  "u"
);

/**
 * The workspace the browser is on once `/` opened it: the person's own,
 * or, when they had none, the one they make on the page `/` shows, with
 * the name and address it offers. Its id, which the seeding helpers take,
 * is read straight in the database the run's server uses, by its slug.
 */
export const openedWorkspace = async (
  browser: Browser
): Promise<OpenedWorkspace> => {
  const create = browser.locator(
    '[data-create-workspace] button[type="submit"]'
  );

  // A sign-in, or staff acting as someone, passes through `/` on its way
  // to a workspace's page; someone without one stays there, where the
  // form shows once their invitations are read and the address it offers
  // is checked. Wait for whichever comes.
  const arrived = async (): Promise<"form" | "waiting" | "workspace"> => {
    if (workspacePage.test(await browser.url())) {
      return "workspace";
    }

    return (await create.count()) > 0 && (await create.isEnabled())
      ? "form"
      : "waiting";
  };

  await expect.poll(arrived, { timeout: 30_000 }).not.toBe("waiting");

  if (!workspacePage.test(await browser.url())) {
    await create.tap();

    // A new workspace opens on its second setup step, connecting its
    // channels: the journeys go on without, as Skip for now does.
    await expect(browser).toHaveURL(setupStep, { timeout: 30_000 });
    await browser.locator("[data-setup-skip]").tap();
  }

  // Creating the workspace, then rendering its page on the server, takes a
  // loaded machine longer than an assertion's 5 seconds.
  await expect(browser).toHaveURL(workspacePage, { timeout: 30_000 });

  const url = await browser.url();
  const slug = workspacePage.exec(url)?.groups?.["slug"] ?? "";

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
