import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A new workspace's home opens with the setup card (DESIGN.md, Pages,
// Home): nothing ticked, the free accounts said under the list, a run that
// stops at a Mastodon server which does not exist (no platform is reached
// in a run), Start over, and Not now kept across a reload.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-setup@`);

const password = () => credentials.user("member").password;

let slug = "";

describe("the setup card", { serial: true }, () => {
  test("signs up and opens the workspace", async ({ app, browser, screen }) => {
    await app.open("/signup");
    await screen.getByLabel("Name").fill("Sam Example");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );

    await app.open("/");
    ({ slug } = await openedWorkspace(browser));
    expect(slug).not.toBe("");
  });

  test("offers the platforms, nothing ticked, and says the free accounts", async ({
    screen,
  }) => {
    const main = screen.getByRole("main");
    const mastodon = main.getByRole("checkbox", "Mastodon");

    await expect(
      main.getByRole("heading", "Set up your channels")
    ).toBeVisible();
    await expect(mastodon).not.toBeChecked();

    await mastodon.tap();
    await expect(main.getByLabel("Your Mastodon server")).toBeVisible();
    await expect(
      main.getByText("Your first 2 accounts are free.")
    ).toBeVisible();
  });

  test("stops on Home at a server that does not exist, and starts over", async ({
    screen,
  }) => {
    const main = screen.getByRole("main");

    await main.getByLabel("Your Mastodon server").fill("social.example");
    await main.getByRole("button", "Connect 1 platform").tap();

    await expect(
      main.getByText(
        "This is not the address of a server. Check it, for example mastodon.social."
      )
    ).toBeVisible();
    await expect(
      main.getByRole("heading", "No channel was connected")
    ).toBeVisible();

    await main.getByRole("button", "Start over").tap();
    await expect(main.getByRole("checkbox", "Mastodon")).not.toBeChecked();
  });

  test("leaves on Not now, until the browser forgets it", async ({
    app,
    screen,
  }) => {
    const main = screen.getByRole("main");

    await main.getByRole("button", "Not now").tap();
    await expect(
      main.getByRole("heading", "Set up your channels")
    ).toBeHidden();

    await app.open(`/${slug}`);
    await expect(
      main.getByRole("heading", "Connect your channels")
    ).toBeVisible();
    await expect(
      main.getByRole("heading", "Set up your channels")
    ).toBeHidden();
  });
});
