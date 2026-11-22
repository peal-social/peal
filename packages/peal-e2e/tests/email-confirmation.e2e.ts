import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";

// The confirmation link opens a page that confirms the address from the
// browser (DESIGN.md's `sign-in` column): the browser that signed up is
// signed in; any other confirms the address, signs nobody in and is asked
// to choose a password; the link opened again finds the address confirmed
// and points to signing in. Its token leaves the address bar at once.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-confirm@`);

const password = () => credentials.user("member").password;

describe("confirming an address", { serial: true }, () => {
  test("asks another browser for a password, and signs nobody in", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open("/signup");
    await screen.getByLabel("Name").fill("Robin Example");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    // Another browser: none of the sign-up's cookies.
    await browser.clearCookies();
    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );

    await expect(screen.getByRole("link", "Choose a password")).toBeVisible();
    await expect(browser).toHaveURL("/verify-email");
  });

  test("finds the address confirmed when the link is opened again", async ({
    browser,
    screen,
  }) => {
    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );

    await expect(
      screen.getByRole("heading", "Address already confirmed")
    ).toBeVisible();
    await expect(screen.getByRole("link", "Sign in")).toBeVisible();
    await expect(
      screen.getByRole("link", "Forgot your password?")
    ).toBeVisible();
  });
});
