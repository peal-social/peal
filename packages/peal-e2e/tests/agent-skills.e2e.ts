import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member saves a skill on the agent's settings and finds it under "/"
// in the agent's composer. The run sets no AI provider, so the workspace
// brings a text provider of its own, which turns the composer on; nothing
// is sent, so no model is ever asked.
const run = randomUUID();
const skill = "Plan next week";

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-skills@`);

const password = () => credentials.user("member").password;

let slug = "";

describe("the agent's skills", { serial: true }, () => {
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

    await app.open("/");
    ({ slug } = await openedWorkspace(browser));
    expect(slug).not.toBe("");
  });

  test("brings a text provider, so the agent's composer takes messages", async ({
    app,
    screen,
  }) => {
    await app.open(`/${slug}/settings/assistant`);

    const main = screen.getByRole("main");

    await main.getByLabel("Model").first().fill("synthetic-model");
    await main
      .getByLabel("Key")
      .first()
      .fill("synthetic-anthropic-key-for-e2e");
    await main.getByRole("button", "Save").first().tap();
    await expect(
      screen
        .getByRole("region", "Notifications")
        .getByText("The text provider is saved.")
    ).toBeVisible();
  });

  test("offers Create skill under / before there is a skill", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open(`/${slug}/agent`);

    const composer = screen.getByRole("main").getByLabel("Message to Peal");

    await expect(composer).toBeEnabled();
    await composer.tap();
    await browser.keyboard.type("/");
    await expect(screen.getByRole("option", "Create skill…")).toBeVisible();

    // Escape closes the menu and leaves the "/" as it was typed.
    await browser.keyboard.press("Escape");
    await expect(screen.getByRole("option", "Create skill…")).toBeHidden();
    await expect(composer).toHaveValue("/");
    await composer.fill("");
  });

  test("saves a skill on the agent's settings", async ({ app, screen }) => {
    await app.open(`/${slug}/settings/agent`);

    const main = screen.getByRole("main");

    await expect(main.getByText("No skills yet")).toBeVisible();
    await screen.getByRole("link", "New skill").first().tap();
    await main.getByLabel("Name").fill(skill);
    await main
      .getByLabel("Instructions")
      .fill(
        "Look at what's scheduled next week and draft a post for each empty day."
      );
    await main.getByRole("button", "Save").tap();

    await expect(main.getByRole("link", new RegExp(skill, "u"))).toBeVisible();
  });

  test("finds the skill under / and picks it as a chip", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open(`/${slug}/agent`);

    const main = screen.getByRole("main");
    const composer = main.getByLabel("Message to Peal");

    await expect(composer).toBeEnabled();
    await composer.tap();
    await browser.keyboard.type("/plan");
    await expect(screen.getByRole("option", skill)).toBeVisible();

    // Enter picks the highlighted skill, and sends nothing.
    await browser.keyboard.press("Enter");
    await expect(composer).toHaveValue("");
    await expect(
      main.getByRole("list", "Picked skills").getByText(skill)
    ).toBeVisible();
  });
});
