import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { confirmedAccount } from "./support/accounts.ts";
import { seedChannel } from "./support/channels.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// Blogs lists the workspace's websites, each opening its articles, and
// the addresses Articles had open there.
const run = randomUUID();
const password = "synthetic blogs password";
const title = "A synthetic field guide";

// Writes a draft article for the website through the API, as the page's
// member, and answers its id.
const draftArticle = `([workspaceId, channelId, title]) => fetch('/api/v1/articles', {
  body: JSON.stringify({ body: { content: [], type: 'doc' }, channelId, title }),
  headers: { 'content-type': 'application/json', 'peal-workspace': workspaceId },
  method: 'POST',
}).then((answer) => answer.json()).then((article) => article.id)`;

describe("Blogs", () => {
  test("lists the websites, each with its own articles", async ({
    app,
    browser,
    screen,
  }) => {
    const email = credentials
      .user("member")
      .username.replace("@", `+${run}-blogs@`);

    await confirmedAccount(app.baseUrl, {
      email,
      name: "Sam Example",
      password,
    });
    await app.open("/login");
    await screen.getByLabel("Email").fill(email);
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    const { id: workspaceId, slug } = await openedWorkspace(browser);

    // With no website, the page says how to connect one.
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Blogs")
      .tap();
    await expect(browser).toHaveURL(`/${slug}/blogs`);
    await expect(
      screen.getByRole("heading", "No website connected")
    ).toBeVisible();

    const site = await seedChannel(workspaceId, "notes.example", "wordpress");
    const other = await seedChannel(workspaceId, "other.example", "wordpress");

    const articleId = await browser.evaluate<string>(draftArticle, [
      workspaceId,
      site,
      title,
    ]);

    await app.open(`/${slug}/blogs`);
    await screen
      .getByRole("main")
      .getByRole("link", /notes\.example/u)
      .tap();
    await expect(browser).toHaveURL(`/${slug}/blogs/${site}`);
    await expect(
      screen.getByRole("main").getByRole("link", title)
    ).toBeVisible();

    // Another website's blog holds none of this one's articles.
    await app.open(`/${slug}/blogs/${other}`);
    await expect(
      screen.getByRole("main").getByText("No article yet.")
    ).toBeVisible();
    await expect(
      screen.getByRole("main").getByRole("link", title)
    ).not.toBeVisible();

    // The addresses Articles had open the same pages under Blogs.
    await app.open(`/${slug}/articles/${articleId}`);
    await expect(browser).toHaveURL(`/${slug}/blogs/${site}/${articleId}`);
    await app.open(`/${slug}/articles`);
    await expect(browser).toHaveURL(`/${slug}/blogs`);
  });
});
