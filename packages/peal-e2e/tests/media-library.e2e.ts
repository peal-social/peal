import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { emailedLink } from "./support/mailpit.ts";
import { seedImage, seedVideo } from "./support/media.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A member finds a file in the media library by its name, narrows it by
// kind, and looks at it full size on a phone, in one browser: each test
// starts where the previous one left off. The module loads again for each
// attempt, so a retry signs up under a new address.
const run = randomUUID();
const name = "Sasha Example";
const harbour = "Harbour at dawn.png";

// Long enough that the preview has more than a phone's height to show.
const longDescription = "The harbour at dawn, boats still moored. "
  .repeat(40)
  .trim();

// The member account from e2e.config.ts, under an address of this run.
const address = () =>
  credentials.user("member").username.replace("@", `+${run}-media@`);

const password = () => credentials.user("member").password;

let workspaceId = "";
let slug = "";

describe("a member's media library", { serial: true }, () => {
  test("signs up and confirms the address", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open("/sign-up");
    await screen.getByLabel("Name").fill(name);
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

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

  test("finds a file by its name, whatever its case", async ({
    app,
    screen,
  }) => {
    await seedImage(workspaceId, harbour, longDescription);
    await seedImage(workspaceId, "Beach.png", "Sand and sea");
    await seedVideo(workspaceId, "A clip of the harbour's boats");
    await app.open(`/${slug}/media`);

    const main = screen.getByRole("main");

    await expect(
      main.getByRole("button", "Show Beach.png large")
    ).toBeVisible();

    await main.getByRole("searchbox", "Search the library").fill("HARBOUR AT");

    await expect(
      main.getByRole("button", `Show ${harbour} large`)
    ).toBeVisible();
    await expect(main.getByRole("button", "Show Beach.png large")).toBeHidden();
    await expect(main.getByText("1 file shown.")).toBeAttached();
  });

  test("narrows the search by kind, and clears it", async ({
    browser,
    screen,
  }) => {
    const main = screen.getByRole("main");

    await main.getByRole("searchbox", "Search the library").fill("harbour");
    await expect(main.getByRole("button", "Show Video large")).toBeVisible();

    await main.getByRole("button", "Filter").tap();
    await screen.getByRole("option", "Kind").tap();
    await screen.getByRole("option", "Image").tap();

    // The search and the kind are in the address, the kind in a chip.
    await expect(browser).toHaveURL(/\?q=harbour&kind=image$/u);
    await expect(main.getByRole("button", "Image")).toBeVisible();

    await expect(main.getByRole("button", "Show Video large")).toBeHidden();
    await expect(
      main.getByRole("button", `Show ${harbour} large`)
    ).toBeVisible();

    await main
      .getByRole("searchbox", "Search the library")
      .fill("nothing here");
    await expect(main.getByRole("button", "Clear the search")).toBeVisible();
    await main.getByRole("button", "Clear the search").tap();

    await expect(
      main.getByRole("searchbox", "Search the library")
    ).toBeFocused();
    await expect(
      main.getByRole("button", "Show Beach.png large")
    ).toBeVisible();
  });

  test("looks at a tall file on a phone, its name and close button in reach", async ({
    browser,
    screen,
  }) => {
    await browser.setViewport({ height: 640, width: 320 });

    await screen
      .getByRole("main")
      .getByRole("button", `Show ${harbour} large`)
      .tap();

    const dialog = screen.getByRole("dialog", harbour);

    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    const close = await dialog.getByRole("button", "Close").boundingBox();
    const title = await dialog.getByRole("heading", harbour).boundingBox();

    // The dialog fits the window, its close button inside it at the top.
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 1000)).toBeLessThanOrEqual(640);
    expect(close?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(title?.y ?? -1).toBeGreaterThanOrEqual(0);

    await dialog.getByRole("button", "Close").tap();
    await expect(dialog).toBeHidden();
    await expect(
      screen.getByRole("main").getByRole("button", `Show ${harbour} large`)
    ).toBeFocused();
  });
});
