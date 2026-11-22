import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";

// A new workspace's second setup step (DESIGN.md, the frame's `setup`):
// once made, the workspace opens on its channels, nothing ticked, the free
// accounts said under the list; a run that stops at a Mastodon server
// which does not exist (no platform is reached in a run) comes back to the
// step with its reason; Start over, then Skip for now, which opens the
// workspace's home, where no setup card shows.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-setup@`);

const password = () => credentials.user("member").password;

const setupStep = /\/create\/[^/]+\/channels$/u;

describe("the setup step", { serial: true }, () => {
  test("opens once the first workspace is made", async ({
    app,
    browser,
    screen,
  }) => {
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
    await screen.getByRole("button", "Create workspace").tap();
    await expect(browser).toHaveURL(setupStep, { timeout: 30_000 });
    await expect(
      screen.getByRole("heading", "Set up your channels")
    ).toBeVisible();
  });

  test("offers the platforms, nothing ticked, and says the free accounts", async ({
    screen,
  }) => {
    const mastodon = screen.getByRole("checkbox", "Mastodon");

    await expect(mastodon).not.toBeChecked();

    await mastodon.tap();
    await expect(screen.getByLabel("Your Mastodon server")).toBeVisible();
    await expect(
      screen.getByText("Your first 2 accounts are free.")
    ).toBeVisible();
  });

  test("stops at a server that does not exist, and starts over", async ({
    screen,
  }) => {
    await screen.getByLabel("Your Mastodon server").fill("social.example");
    await screen.getByRole("button", "Connect 1 platform").tap();

    await expect(
      screen.getByText(
        "This is not the address of a server. Check it, for example mastodon.social."
      )
    ).toBeVisible();
    await expect(
      screen.getByRole("heading", "No channel was connected")
    ).toBeVisible();

    await screen.getByRole("button", "Start over").tap();
    await expect(screen.getByRole("checkbox", "Mastodon")).not.toBeChecked();
  });

  test("Skip for now opens the workspace's home, which has no setup card", async ({
    browser,
    screen,
  }) => {
    await screen.getByRole("button", "Skip for now").tap();
    await expect(browser).not.toHaveURL(setupStep);

    const main = screen.getByRole("main");

    await expect(
      main.getByRole("heading", "Connect your channels")
    ).toBeVisible();
    await expect(
      main.getByRole("heading", "Set up your channels")
    ).toBeHidden();
  });
});
