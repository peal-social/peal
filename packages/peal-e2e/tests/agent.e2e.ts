import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member opens the agent where no language model answers (the run sets
// no AI provider and the workspace brought none): the page says it is off
// and how to turn it on, and the panel opens, minimizes and closes from
// the bottom bar. No test talks to a model.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-agent@`);

const password = () => credentials.user("member").password;

let slug = "";

describe("the agent, off", { serial: true }, () => {
  test("signs up and opens the workspace", async ({ app, browser, screen }) => {
    await app.open("/signup");
    await screen.getByLabel("Name").fill("Robin Example");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );
    // The page confirms from the browser: signed in once it says so.
    await expect(screen.getByRole("heading", "Email confirmed")).toBeVisible();

    await app.open("/");
    ({ slug } = await openedWorkspace(browser));
    expect(slug).not.toBe("");
  });

  test("says the agent is off, and where to turn it on", async ({
    app,
    screen,
  }) => {
    await app.open(`/${slug}/agent`);

    const main = screen.getByRole("main");

    await expect(main.getByText("The agent is off")).toBeVisible();
    await expect(
      main.getByRole("link", "Set up a text provider")
    ).toBeVisible();
    await expect(main.getByLabel("Message to Peal")).toBeDisabled();
  });

  test("opens the panel from the bottom bar, minimizes it and closes it", async ({
    screen,
  }) => {
    const panel = screen.getByRole("region", "Peal's agent");

    await screen.getByRole("button", "Agent").tap();
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Welcome to Peal")).toBeVisible();

    await panel.getByRole("button", "Minimize").tap();
    await expect(panel).toBeHidden();

    // A chat nothing was sent in is no tab of the bar: Agent shows it again.
    await expect(screen.getByRole("button", "New chat")).toBeHidden();
    await screen.getByRole("button", "Agent").tap();
    await expect(panel).toBeVisible();

    await panel.getByRole("button", "Close").tap();
    await expect(panel).toBeHidden();
  });
});
