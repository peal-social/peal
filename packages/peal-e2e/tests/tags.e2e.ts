import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { seedChannel } from "./support/channels.ts";
import { emailedLink } from "./support/mailpit.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member files a post under a tag, then filters the calendar by it, in
// one browser: each test starts where the previous one left off. The module
// loads again for each attempt, so a retry signs up under a new address.
const run = randomUUID();
const name = "Robin Example";
const handle = "@tagged@social.example";
const tag = "Spring campaign";
const tagged = "A field note filed under the spring campaign.";
const plain = "A field note filed under nothing.";

// The calendar names each post "<time>, <status>: <text>", then its tags.
const taggedPost = new RegExp(
  `, Scheduled: ${RegExp.escape(tagged)} Tag: ${RegExp.escape(tag)}\\.$`,
  "u"
);

const plainPost = new RegExp(`, Scheduled: ${RegExp.escape(plain)}$`, "u");

// The member account from e2e.config.ts, under an address of this run.
const address = () =>
  credentials.user("member").username.replace("@", `+${run}-tags@`);

const password = () => credentials.user("member").password;

// The workspace's pages live under /<slug>; the test that opens it
// reads the slug from its address, and the id, which seeding takes, from
// the database.
let workspaceId = "";
let slug = "";

describe("a member's tags", { serial: true }, () => {
  test("signs up and confirms the address", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open("/signup");
    await screen.getByLabel("Name").fill(name);
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    // The confirmation link signs the member in.
    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );

    await expect(screen.getByRole("heading", "Email confirmed")).toBeVisible();
  });

  test("opens the workspace made for them", async ({ app, browser }) => {
    await app.open("/");
    ({ id: workspaceId, slug } = await openedWorkspace(browser));
    expect(workspaceId).not.toBe("");
  });

  test("adds a tag in the workspace's settings", async ({ app, screen }) => {
    await seedChannel(workspaceId, handle);
    await app.open(`/${slug}/settings`);
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Tags")
      .tap();

    await expect(
      screen.getByText("The workspace has no tag yet.")
    ).toBeVisible();

    await screen.getByLabel("Name").fill(tag);
    await screen.getByRole("button", "Add the tag").tap();

    await expect(screen.getByText("The tag is added.")).toBeVisible();
  });

  test("schedules a post filed under the tag", async ({ app, screen }) => {
    await app.open(`/${slug}/posts/new`);

    await expect(screen.getByRole("heading", "New post")).toBeVisible();
    await screen.getByRole("button", /^Channels /u).tap();
    await screen.getByRole("option", handle).tap();
    await screen.getByRole("combobox", "Search channels").press("Escape");
    await screen.getByRole("textbox", "Text for all channels").fill(tagged);

    await screen.getByRole("button", /^Tags /u).tap();
    await screen.getByRole("checkbox", tag).check();
    await screen.getByRole("checkbox", tag).press("Escape");

    // Late in the day, so the time is ahead whenever the test runs.
    await screen.getByRole("button", /^When /u).tap();
    await screen.getByRole("textbox", "Time").fill("23:59");
    await screen.getByRole("textbox", "Time").press("Escape");
    await screen.getByRole("button", "Schedule").tap();

    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(screen.getByRole("link", taggedPost)).toBeVisible();
  });

  test("schedules a post without a tag", async ({ app, screen }) => {
    await app.open(`/${slug}/posts/new`);

    await expect(screen.getByRole("heading", "New post")).toBeVisible();
    await screen.getByRole("button", /^Channels /u).tap();
    await screen.getByRole("option", handle).tap();
    await screen.getByRole("combobox", "Search channels").press("Escape");
    await screen.getByRole("textbox", "Text for all channels").fill(plain);
    await screen.getByRole("button", /^When /u).tap();
    await screen.getByRole("textbox", "Time").fill("23:58");
    await screen.getByRole("textbox", "Time").press("Escape");
    await screen.getByRole("button", "Schedule").tap();

    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(screen.getByRole("link", plainPost)).toBeVisible();
    await expect(screen.getByRole("link", taggedPost)).toBeVisible();
  });

  test("filters the calendar by the tag", async ({ browser, screen }) => {
    await screen.getByRole("main").getByRole("button", "Filter").tap();
    await screen.getByRole("option", "Tag").tap();
    await screen.getByRole("option", tag).tap();
    // The menu stays open for more choices: Escape goes back to the
    // properties, then closes it.
    await screen.getByRole("option", tag).press("Escape");
    await screen.getByRole("option", "Tag").press("Escape");

    // The filter is in the address, and its chip names the tag.
    await expect(browser).toHaveURL(/[?&]tag=/u);
    await expect(
      screen.getByRole("main").getByRole("button", tag)
    ).toBeVisible();
    await expect(screen.getByRole("link", taggedPost)).toBeVisible();
    await expect(screen.getByRole("link", plainPost)).toBeHidden();
    await expect(screen.getByText("1 post hidden by filters")).toBeVisible();
  });

  test("shows every post again once the filters are cleared", async ({
    screen,
  }) => {
    await screen.getByRole("main").getByRole("button", "Clear").tap();

    await expect(screen.getByRole("link", taggedPost)).toBeVisible();
    await expect(screen.getByRole("link", plainPost)).toBeVisible();
    await expect(screen.getByText("1 post hidden by filters")).toBeHidden();
    await expect(
      screen.getByRole("main").getByRole("button", "Clear")
    ).toBeHidden();
  });

  // Nothing goes out: both posts are cancelled.
  test("cancels the tagged post", async ({ screen }) => {
    await screen.getByRole("link", taggedPost).tap();
    await expect(screen.getByRole("heading", "Scheduled post")).toBeVisible();
    await screen.getByRole("button", "Cancel the post").tap();
    await screen
      .getByRole("dialog", "Cancel this post?")
      .getByRole("button", "Cancel the post")
      .tap();

    await expect(
      screen.getByRole("region", "Notifications").getByText("Post cancelled.")
    ).toBeVisible();
    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    // The next test cancels a post too: its toast must be the only one.
    await expect(
      screen.getByRole("region", "Notifications").getByText("Post cancelled.")
    ).toBeHidden({
      timeout: 10_000,
    });
  });

  test("cancels the other post", async ({ screen }) => {
    await screen.getByRole("link", plainPost).tap();
    await expect(screen.getByRole("heading", "Scheduled post")).toBeVisible();
    await screen.getByRole("button", "Cancel the post").tap();
    await screen
      .getByRole("dialog", "Cancel this post?")
      .getByRole("button", "Cancel the post")
      .tap();

    await expect(
      screen.getByRole("region", "Notifications").getByText("Post cancelled.")
    ).toBeVisible();
    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(screen.getByRole("link", plainPost)).toBeHidden();
  });
});
