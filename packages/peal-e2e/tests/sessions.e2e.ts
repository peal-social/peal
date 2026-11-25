import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import {
  ageSessions,
  confirmedAccount,
  sessionLives,
  signedInElsewhere,
} from "./support/accounts.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member reads their sessions on the account's security page, then comes
// back to it signed in for longer than Better Auth lists sessions to: the
// page says so, signs out their other device all the same (this browser,
// another tab of it included, stays signed in, and that tab stays as it
// is), then signs them in again, after which the list shows.
// Another member signs out from the account menu and back in, each step
// on a page loaded anew, as signing out and in always is. The module
// loads again for each attempt, so a retry signs up under a new address.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-sessions@`);

// The account that signs out from the account menu, its own.
const signingOutAddress = () =>
  credentials.user("member").username.replace("@", `+${run}-sign-out@`);

// The account this journey signs up through the API, whose password it
// must know: synthetic, like its address.
const password = "synthetic sessions password";

describe("the sessions list", () => {
  test("asks a session signed in long ago to sign in again", async ({
    app,
    browser,
    screen,
  }) => {
    await confirmedAccount(app.baseUrl, {
      email: address(),
      name: "Sam Example",
      password,
    });

    await browser.clearCookies();
    await app.open("/login");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    const { slug } = await openedWorkspace(browser);
    const security = `/${slug}/settings/account/security`;

    await app.open(security);
    await expect(screen.getByText("This session")).toBeVisible({
      timeout: 15_000,
    });

    // Another device, signed in to the same account.
    const elsewhere = await signedInElsewhere(app.baseUrl, {
      email: address(),
      password,
    });

    // Two days on, as far as Better Auth can tell.
    await ageSessions(address(), 48);
    await browser.clearCookies({ name: /session_data$/u });

    const notFresh =
      "This list shows only for a short while after you sign in. Sign in again to see it.";

    // Another tab of this browser, on the same session, marked: a page
    // loaded anew has no mark.
    const [here] = browser.tabs();
    const otherTab = await browser.newTab();

    await app.open(security);
    await expect(screen.getByText(notFresh)).toBeVisible({ timeout: 15_000 });
    await browser.evaluate("window.pealSamePage = true");
    await here?.activate();

    await app.open(security);
    await expect(screen.getByText(notFresh)).toBeVisible({ timeout: 15_000 });
    await expect(screen.getByRole("button", "Try again")).toBeHidden();

    // The other device is signed out without the list; this one stays.
    await screen
      .getByRole("main")
      .getByRole("button", "Sign out everywhere else")
      .tap();
    await screen
      .getByRole("alertdialog", "Sign out of every other session?")
      .getByRole("button", "Sign out everywhere else")
      .tap();
    await expect(
      screen
        .getByRole("region", "Notifications")
        .getByText("Every other session is signed out.")
    ).toBeVisible({ timeout: 15_000 });
    expect(await sessionLives(app.baseUrl, elsewhere)).toBe(false);
    await expect(screen.getByText(notFresh)).toBeVisible();
    await expect(browser).toHaveURL(security);

    await otherTab.activate();
    expect(await browser.evaluate("'pealSamePage' in window")).toBe(true);
    await expect(browser).toHaveURL(security);
    await otherTab.close();
    await here?.activate();

    await screen.getByRole("main").getByRole("button", "Sign in again").tap();
    await expect(browser).toHaveURL(/\/login\?next=/u, { timeout: 30_000 });

    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    await expect(browser).toHaveURL(security, { timeout: 30_000 });
    await expect(screen.getByText("This session")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("signs out from the account menu, and the next sign-in starts a page of its own", async ({
    app,
    browser,
    screen,
  }) => {
    const email = signingOutAddress();

    await confirmedAccount(app.baseUrl, {
      email,
      name: "Sam Example",
      password,
    });

    await browser.clearCookies();
    await app.open("/login");
    await screen.getByLabel("Email").fill(email);
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    const { slug } = await openedWorkspace(browser);

    // A mark on this page, as the agent's chats and drafts live in it: a
    // page loaded anew has none.
    await browser.evaluate("window.pealSamePage = true");

    await screen.getByRole("button", "Account of Sam Example").tap();
    await screen.getByRole("menuitem", "Sign out").tap();
    await expect(browser).toHaveURL(/\/login/u, { timeout: 30_000 });
    expect(await browser.evaluate("'pealSamePage' in window")).toBe(false);

    await browser.evaluate("window.pealSamePage = true");
    await screen.getByLabel("Email").fill(email);
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    await expect(browser).toHaveURL(new RegExp(`/${slug}$`, "u"), {
      timeout: 30_000,
    });
    expect(await browser.evaluate("'pealSamePage' in window")).toBe(false);
  });
});
