import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import type { Browser } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { confirmedAccount } from "./support/accounts.ts";
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

// Whether the page's main region has hydrated (React has taken its
// element over) and holds nothing still loading: what a page reads in the
// browser shows only after hydration, so a page that has its data has
// hydrated, and reported any mismatch.
const settled = `(() => {
  const main = document.querySelector("main");

  return (
    main !== null &&
    Object.keys(main).some((key) => key.startsWith("__reactFiber$")) &&
    main.querySelector('[aria-busy="true"]') === null
  );
})()`;

// A workspace's main pages, which a new workspace opens with nothing in it.
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
// it reported: a page that never settles is reported too, and the next
// one opens all the same.
const errorsOn = async (
  browser: Browser,
  baseUrl: string,
  slug: string,
  path: string
): Promise<PageErrors> => {
  await browser.goto(`${baseUrl}/${slug}${path}`);

  const done = await settles(browser);
  const errors = await browser.evaluate<string[]>("window.__pealErrors ?? []");

  return {
    errors: done
      ? errors
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

    const { slug } = await openedWorkspace(browser);

    await browser.addInitScript(errorsKept);

    // One page after the other, in the one browser, each one's errors
    // kept, so a run names every page that reports one.
    const errorsOnEach = async (
      paths: readonly string[]
    ): Promise<readonly PageErrors[]> => {
      const [path, ...rest] = paths;

      if (path === undefined) {
        return [];
      }

      const first = await errorsOn(browser, app.baseUrl, slug, path);

      return [first, ...(await errorsOnEach(rest))];
    };

    const reported = await errorsOnEach(pages);

    expect(reported.filter(({ errors }) => errors.length > 0)).toEqual([]);
  });
});
