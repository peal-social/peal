import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import type { Browser } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { confirmedAccount } from "./support/accounts.ts";
import { seedChannel } from "./support/channels.ts";
import { settled } from "./support/settled.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// Every error the page reports: what it writes with console.error, and the
// errors nothing caught, which is where React's hydration error (#418 in a
// production build: the server's HTML did not match the browser's first
// render) arrives. Kept on the window, which each page load starts again.
const errorsKept = `(() => {
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

// A workspace's main pages, which a new workspace opens with nothing in it.
const pages = [
  "",
  "/platforms",
  "/blogs",
  "/channels",
  "/posts",
  "/posts?layout=calendar",
  "/media",
  "/analytics",
  "/notifications",
  "/billing",
  "/settings",
  "/settings/members",
];

// Pages of the same workspace once it holds more accounts than the free
// tier's two, without a payment method: each shows the over-plan screen
// instead, which its owner, who manages billing, reads with its channels
// and members to choose among, read in the browser.
const overPlanPages = ["", "/channels", "/posts", "/settings"];

// The over-plan screen's title, for the workspace `/` made for Sam.
const overPlanTitle = "Sam’s workspace holds more than the free tier allows";

// The text of the page's main region.
const mainText = `document.querySelector("main")?.textContent ?? ""`;

interface PageErrors {
  readonly errors: readonly string[];
  readonly page: string;
}

// Whether the page settles within 20 seconds.
const settles = async (browser: Browser): Promise<boolean> => {
  try {
    await expect
      .poll(async () => await browser.evaluate<boolean>(settled), {
        timeout: 20_000,
      })
      .toBe(true);

    return true;
  } catch {
    return false;
  }
};

// Opens one page from the server, waits for it to settle, and answers what
// it reported: a page that never settles is reported too, and so is one
// whose main region, settled, lacks the text it must show (`shows`). The
// next one opens all the same.
const errorsOn = async (
  browser: Browser,
  baseUrl: string,
  slug: string,
  path: string,
  shows: string | null
): Promise<PageErrors> => {
  await browser.goto(`${baseUrl}/${slug}${path}`);

  const done = await settles(browser);
  const errors = await browser.evaluate<string[]>("window.__pealErrors ?? []");
  const text = await browser.evaluate<string>(mainText);

  const missing =
    done && shows !== null && !text.includes(shows)
      ? [`settled without showing “${shows}”`]
      : [];

  return {
    errors: done
      ? [...missing, ...errors]
      : ["never settled: still loading after 20 s", ...errors],
    page: path === "" ? "/" : path,
  };
};

const run = randomUUID();
const password = "synthetic page loads password";

describe("a workspace's main pages", () => {
  test("load without an error in the console", async ({
    app,
    browser,
    screen,
  }) => {
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

    const { id: workspaceId, slug } = await openedWorkspace(browser);

    await browser.addInitScript(errorsKept);

    // One page after the other, in the one browser, each one's errors
    // kept, so a run names every page that reports one.
    const errorsOnEach = async (
      paths: readonly string[],
      shows: string | null
    ): Promise<readonly PageErrors[]> => {
      const [path, ...rest] = paths;

      if (path === undefined) {
        return [];
      }

      const first = await errorsOn(browser, app.baseUrl, slug, path, shows);

      return [first, ...(await errorsOnEach(rest, shows))];
    };

    const withinPlan = await errorsOnEach(pages, null);

    // Three accounts, one more than the free tier holds without a payment
    // method: the workspace must come back within its plan, and every
    // page but billing's shows the over-plan screen.
    await Promise.all(
      ["one", "two", "three"].map(async (name) => {
        await seedChannel(workspaceId, `@${name}@social.example`);
      })
    );

    const overPlan = await errorsOnEach(overPlanPages, overPlanTitle);

    expect(
      [
        ...withinPlan,
        ...overPlan.map(({ errors, page }) => ({
          errors,
          page: `${page} (over its plan)`,
        })),
      ].filter(({ errors }) => errors.length > 0)
    ).toEqual([]);
  });
});
