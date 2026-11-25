import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { confirmedAccount } from "./support/accounts.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// Every error the page reports: what it writes with console.error, and the
// errors nothing caught, which is where React's hydration error (#418 in a
// production build: the server's HTML did not match the browser's first
// render) arrives. Kept on the window, which each page load starts again;
// a second copy of the script keeps nothing twice.
const errorsKept = `(() => {
  if (Array.isArray(window.__pealErrors)) {
    return;
  }
  const errors = [];
  Object.defineProperty(window, "__pealErrors", { value: errors });
  const write = console.error.bind(console);
  console.error = (...args) => {
    errors.push(args.map(String).join(" "));
    write(...args);
  };
  addEventListener("error", (event) => {
    errors.push(String(event.error ?? event.message));
  });
  addEventListener("unhandledrejection", (event) => {
    errors.push(String(event.reason));
  });
})()`;

// A workspace's main pages, which a new workspace opens with nothing in
// it. Platforms and Articles read their data in the browser, after
// hydration: each test waits for it.
const pages = [
  "",
  "/platforms",
  "/articles",
  "/channels",
  "/posts",
  "/calendar",
  "/media",
  "/analytics",
  "/notifications",
  "/billing",
  "/settings",
  "/settings/members",
];

const run = randomUUID();
const password = "synthetic page loads password";

let slug = "";

// Loads one page from the server, so it hydrates, and reads what it
// reported.
const loadsCleanly = (path: string) => {
  test(`${path === "" ? "/" : path} loads without an error in the console`, async ({
    app,
    browser,
    screen,
  }) => {
    await browser.addInitScript(errorsKept);
    await browser.goto(`${app.baseUrl}/${slug}${path}`, {
      waitUntil: "networkidle",
    });

    const main = screen.getByRole("main");

    if (path === "/platforms") {
      await expect(main.getByRole("table")).toBeVisible();
    }

    if (path === "/articles") {
      await expect(main.getByText("No article yet.")).toBeVisible();
    }

    const errors = await browser.evaluate<string[]>(
      "window.__pealErrors ?? []"
    );

    expect(errors).toEqual([]);
  });
};

describe("a workspace's main pages", { serial: true }, () => {
  test("open for a new member", async ({ app, browser, screen }) => {
    const email = credentials
      .user("member")
      .username.replace("@", `+${run}-pages@`);

    await confirmedAccount(app.baseUrl, {
      email,
      name: "Sam Example",
      password,
    });
    await app.open("/login");
    await screen.getByLabel("Email").fill(email);
    await screen.getByLabel("Password").fill(password);
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    ({ slug } = await openedWorkspace(browser));
    expect(slug).not.toBe("");
  });

  for (const path of pages) {
    loadsCleanly(path);
  }
});
