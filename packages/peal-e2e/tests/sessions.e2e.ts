import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { ageSessions, confirmedAccount } from "./support/accounts.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member reads their sessions on the account's security page, then comes
// back to it signed in for longer than Better Auth lists sessions to: the
// page says so and signs them in again, after which the list shows. The
// module loads again for each attempt, so a retry signs up under a new
// address.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-sessions@`);

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

    // Two days on, as far as Better Auth can tell.
    await ageSessions(address(), 48);
    await browser.clearCookies({ name: /session_data$/u });
    await app.open(security);

    await expect(
      screen.getByText(
        "This list shows only for a short while after you sign in. Sign in again to see it."
      )
    ).toBeVisible({ timeout: 15_000 });
    await expect(screen.getByRole("button", "Try again")).toBeHidden();

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
});
