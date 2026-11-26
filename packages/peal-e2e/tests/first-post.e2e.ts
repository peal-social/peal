import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

import { seedChannel } from "./support/channels.ts";
import { emailedLink } from "./support/mailpit.ts";
import { seedVideo } from "./support/media.ts";
import { settled } from "./support/settled.ts";
import { defaultWorkspaceOf, openedWorkspace } from "./support/workspaces.ts";

// One new member's first steps, in order, in one browser: each test starts
// where the previous one left off, ending with a second member Sam invites,
// who signs up and joins. The module loads again for each attempt, so a
// retry signs up under a new address.
const run = randomUUID();
const name = "Sam Example";
const guestName = "Alex Example";
const workspace = defaultWorkspaceOf(name);
const handle = "@notes@social.example";
const text = "Our first field note, written once and scheduled from Peal.";
const edited = "Our first field note, taken back, edited and scheduled again.";
const videos = "@peal_field_videos";
const video = "A synthetic field video, described for YouTube.";
const videoTitle = "Field notes, the video";

// The calendar names each post "<time>, <status>: <text>".
const scheduledAs = (body: string) =>
  new RegExp(`, Scheduled: ${RegExp.escape(body)}$`, "u");

const scheduledPost = scheduledAs(text);

// The member account from e2e.config.ts, under an address of this run.
const address = () =>
  credentials.user("member").username.replace("@", `+${run}@`);

const password = () => credentials.user("member").password;

// The second member Sam invites, under an address of this run too.
const guestAddress = () =>
  credentials.user("member").username.replace("@", `+${run}-guest@`);

// The invitation's link, which the guest opens once they have an account.
let invitationLink = "";

// The workspace's pages live under /<slug>; the test that opens it
// reads the slug from its address, and the id, which seeding takes, from
// the database.
let workspaceId = "";
let slug = "";

describe("a new member's first post", { serial: true }, () => {
  test("signs up", async ({ app, screen }) => {
    await app.open("/signup");
    await screen.getByLabel("Name").fill(name);
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();

    await expect(screen.getByText("Check your inbox")).toBeVisible();
  });

  test("confirms the address from the email", async ({ browser, screen }) => {
    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );

    await expect(screen.getByRole("heading", "Email confirmed")).toBeVisible();
  });

  test("signs in", async ({ app, browser, screen }) => {
    // The confirmation link signed the member in: start a new session.
    await browser.clearCookies();
    await app.open("/login");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    // Signing in opens /, which makes the member a workspace of their
    // own, named after them, and opens it.
    ({ id: workspaceId, slug } = await openedWorkspace(browser));
    expect(workspaceId).not.toBe("");
  });

  test("has no channel yet", async ({ browser, screen }) => {
    await expect(screen.getByRole("button", "Switch workspace")).toContainText(
      workspace
    );
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Channels")
      .tap();

    await expect(
      screen.getByRole("heading", "Channels", { level: 1 })
    ).toBeVisible();
    await expect(
      screen.getByText(/^A channel is an account this workspace posts to/u)
    ).toBeVisible();
    await expect(browser).toHaveURL(`/${slug}/channels`);
  });

  test("finds a platform among those New channel offers, and opens its form", async ({
    browser,
    screen,
  }) => {
    await screen.getByRole("main").getByRole("link", "Create a channel").tap();
    await expect(
      screen.getByRole("heading", "New channel", { level: 1 })
    ).toBeVisible();

    await screen.getByLabel("Search platforms").fill("masto");
    await expect(screen.getByRole("link", /^Bluesky/u)).toBeHidden();
    await screen.getByRole("link", /^Mastodon/u).tap();

    await expect(browser).toHaveURL(`/${slug}/channels/new/mastodon`);
    await expect(screen.getByLabel("Server")).toBeVisible();
  });

  test("goes back up the breadcrumb, a step at a time", async ({
    browser,
    screen,
  }) => {
    const trail = screen.getByRole("navigation", "Where you are");

    await expect(trail.getByRole("heading", "Mastodon")).toBeVisible();
    await trail.getByRole("link", "New channel").tap();
    await expect(browser).toHaveURL(`/${slug}/channels/new`);
    await trail.getByRole("link", "Channels").tap();
    await expect(browser).toHaveURL(`/${slug}/channels`);
  });

  test("writes a post and saves it as a draft", async ({
    app,
    browser,
    screen,
  }) => {
    await seedChannel(workspaceId, handle);
    await app.open(`/${slug}/posts/new`);

    await expect(screen.getByRole("heading", "New post")).toBeVisible();
    await screen.getByRole("button", /^Channels /u).tap();
    await screen.getByRole("option", handle).tap();
    await screen.getByRole("combobox", "Search channels").press("Escape");
    await screen.getByRole("textbox", "Text for all channels").fill(text);
    await screen.getByRole("button", "Save as draft").tap();

    await expect(screen.getByText("Draft saved.")).toBeVisible();
    await expect(browser).toHaveURL(
      new RegExp(`/${slug}/posts/[0-9a-f-]+$`, "u")
    );
  });

  test("asks for the Drafts tab's list once when the tab opens", async ({
    app,
    browser,
    screen,
  }) => {
    await app.open(`/${slug}/posts`);
    await expect(
      screen.getByRole("main").getByRole("link", text)
    ).toBeVisible();

    // Every request for the drafts, a cancelled one included: the router
    // renders the tab before it commits it, and the list was asked for two
    // or three times while the registry dropped what nothing subscribed to.
    const drafts = /\/api\/v1\/posts\?(?:[^#]*&)?status=draft(?:&|$)/u;
    let asked = 0;

    await browser.route(drafts, async (route) => {
      asked += 1;
      await route.continue();
    });

    try {
      const answered = browser.waitForResponse(drafts);

      await screen.getByRole("link", "Drafts").tap();
      await expect(browser).toHaveURL(`/${slug}/posts?status=draft`);

      const response = await answered;

      expect(response.status).toBe(200);

      // Read once the tab has settled, with its list in: a request sent
      // again, with the commit or after the first answer, is counted.
      await expect
        .poll(async () => await browser.evaluate<boolean>(settled), {
          timeout: 20_000,
        })
        .toBe(true);
      await expect(
        screen.getByRole("main").getByRole("link", text)
      ).toBeVisible();
      expect(asked).toBe(1);
    } finally {
      await browser.unroute(drafts);
    }
  });

  test("finds it under the Drafts tab of Posts", async ({
    app,
    browser,
    screen,
  }) => {
    // The old Drafts page's address opens the tab.
    await app.open(`/${slug}/drafts`);

    await expect(
      screen.getByRole("heading", "Posts", { level: 1 })
    ).toBeVisible();
    await expect(browser).toHaveURL(`/${slug}/posts?status=draft`);
    await expect(screen.getByRole("link", "Drafts")).toHaveAttribute(
      "aria-current",
      "page"
    );

    await screen.getByRole("main").getByRole("link", text).tap();

    await expect(screen.getByRole("heading", "Edit the draft")).toBeVisible();
    await expect(
      screen.getByRole("textbox", "Text for all channels")
    ).toHaveText(text);
  });

  test("schedules it and finds it in the calendar", async ({
    browser,
    screen,
  }) => {
    // Late in the day, so the time is ahead whenever the test runs: a new
    // post starts at the next full hour, which can be a minute away.
    await screen.getByRole("button", /^When /u).tap();
    await screen.getByRole("textbox", "Time").fill("23:59");
    await screen.getByRole("textbox", "Time").press("Escape");
    await screen.getByRole("button", "Schedule").tap();

    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(browser).toHaveURL(
      new RegExp(`/${slug}/posts\\?layout=calendar&date=`, "u")
    );
    await expect(screen.getByRole("link", scheduledPost)).toBeVisible();
  });

  test("switches the posts between the calendar and the list", async ({
    browser,
    screen,
  }) => {
    await screen.getByRole("button", "Display").tap();
    await screen.getByRole("button", "List").tap();

    await expect(browser).toHaveURL(`/${slug}/posts`);
    await expect(screen.getByRole("navigation", "Views")).toBeVisible();

    await screen.getByRole("button", "Display").tap();
    await screen.getByRole("button", "Calendar").tap();

    await expect(browser).toHaveURL(`/${slug}/posts?layout=calendar`);
    await expect(screen.getByRole("link", scheduledPost)).toBeVisible();
  });

  test("takes it back to draft, edits it and schedules it again", async ({
    screen,
  }) => {
    await screen.getByRole("link", scheduledPost).tap();
    await expect(screen.getByRole("heading", "Scheduled post")).toBeVisible();
    await screen.getByRole("button", "Back to draft").tap();

    await expect(
      screen.getByText("The post is a draft again: edit it, then schedule it.")
    ).toBeVisible();
    await expect(screen.getByRole("heading", "Edit the draft")).toBeVisible();

    await screen.getByRole("textbox", "Text for all channels").fill(edited);
    await screen.getByRole("button", "Schedule").tap();

    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(screen.getByRole("link", scheduledAs(edited))).toBeVisible();
    await expect(screen.getByRole("link", scheduledPost)).toBeHidden();
  });

  test("cancels the scheduled post", async ({ screen }) => {
    await screen.getByRole("link", scheduledAs(edited)).tap();
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
  });

  test("asks a YouTube video for its options, and keeps them", async ({
    app,
    browser,
    screen,
  }) => {
    await seedChannel(workspaceId, videos, "youtube");
    await seedVideo(workspaceId, video);
    await app.open(`/${slug}/posts/new`);

    await expect(screen.getByRole("heading", "New post")).toBeVisible();
    await screen.getByRole("button", /^Channels /u).tap();
    await screen.getByRole("option", videos).tap();
    await screen.getByRole("combobox", "Search channels").press("Escape");
    await screen.getByRole("textbox", "Text for all channels").fill(video);

    // YouTube takes a video, and nothing else.
    await screen.getByRole("button", "Choose from the library").tap();

    const picker = screen.getByRole("dialog", "Choose images and videos");

    await picker.getByRole("button", /^Video added on/u).tap();
    await picker.getByRole("button", "Attach 1 item").tap();
    await expect(picker).toBeHidden();
    await screen.getByRole("button", /^When /u).tap();
    await screen.getByRole("textbox", "Time").fill("23:59");
    await screen.getByRole("textbox", "Time").press("Escape");
    await screen.getByRole("button", "Schedule").tap();

    // Saved as a draft, then refused: YouTube needs a title and to know
    // whether the video is made for kids, which its row said already, and
    // opens to ask for.
    await expect(
      screen.getByText(`${videos} on YouTube: Title is required.`)
    ).toBeVisible();
    await expect(
      screen.getByText(`${videos} on YouTube: Made for kids is required.`)
    ).toBeVisible();

    await screen.getByRole("textbox", "Title (required)").fill(videoTitle);
    await screen.getByRole("combobox", "Made for kids (required)").tap();
    await screen.getByRole("option", "No, it's not made for kids").tap();
    await screen.getByRole("button", "Save as draft").tap();
    await expect(screen.getByText("Draft saved.")).toBeVisible();

    await browser.reload();

    await expect(screen.getByRole("heading", "Edit the draft")).toBeVisible();

    // The channel's row sums up what it holds, and opens to show it.
    const row = screen.getByRole(
      "button",
      new RegExp(`^${RegExp.escape(videos)} .*options? set`, "u")
    );

    await row.tap();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(screen.getByRole("textbox", "Title (required)")).toHaveValue(
      videoTitle
    );
    await expect(
      screen.getByRole("combobox", "Made for kids (required)")
    ).toHaveText("No, it's not made for kids");

    // Nothing goes out: the draft is discarded.
    await screen.getByRole("button", "Discard the draft").tap();
    await screen
      .getByRole("dialog", "Discard this draft?")
      .getByRole("button", "Discard the draft")
      .tap();
    await expect(screen.getByText("Draft discarded.")).toBeVisible();
  });

  test("invites a second member", async ({ app, screen }) => {
    await app.open(`/${slug}/settings`);

    await expect(
      screen.getByRole("heading", "Workspace", { level: 1 })
    ).toBeVisible();

    // Inviting is on Members.
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Members")
      .tap();
    await expect(
      screen.getByRole("heading", "Members", { level: 1 })
    ).toBeVisible();
    await screen.getByLabel("Email").fill(guestAddress());
    await screen.getByRole("button", "Send the invitation").tap();

    await expect(
      screen.getByRole("button", `Revoke the invitation to ${guestAddress()}`)
    ).toBeVisible();

    invitationLink = await emailedLink(
      guestAddress(),
      `${name} invited you to ${workspace} on Peal`
    );
    expect(new URL(invitationLink).pathname).toMatch(
      /^\/invitations\/[0-9a-f-]+$/u
    );
  });

  test("opens the workspace's webhooks, and is told why an address is refused", async ({
    app,
    screen,
  }) => {
    await app.open(`/${slug}/settings`);
    // Webhooks are PealAPI's: the mode switch, at the sidebar's foot,
    // opens it.
    await screen
      .getByRole("button", "Switch between PealCreative and PealAPI")
      .tap();
    await screen.getByRole("menuitem", /^PealAPI/u).tap();
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Webhooks")
      .tap();

    await expect(
      screen.getByText("The workspace has no webhook endpoint.")
    ).toBeVisible();

    // A documentation address (RFC 5737): never a public host, and no name
    // to look up.
    await screen.getByLabel("Address").fill("https://192.0.2.10/hooks");
    await screen.getByRole("checkbox", "All events").tap();
    await screen.getByRole("button", "Add the endpoint").tap();

    await expect(
      screen.getByText(
        "The address’s host is not public, so Peal does not send requests to it."
      )
    ).toBeVisible();
  });

  test("opens a French address in the account's English", async ({
    app,
    browser,
    screen,
  }) => {
    // Signed in, the account's language wins over the address's: a link
    // to a French page opens the same page in English, its query kept.
    // The calendar's old address opens the posts in their calendar layout.
    await app.open(`/fr/${slug}/calendar?view=month`);

    await expect(browser).toHaveURL(
      `/${slug}/posts?layout=calendar&view=month`
    );
    await expect(
      screen.getByRole("navigation", "Calendar views")
    ).toBeVisible();
    await expect(
      screen
        .getByRole("navigation", "Calendar views")
        .getByRole("link", "Month")
    ).toHaveAttribute("aria-current", "page");

    // The articles' old address opens the posts with their Type on them.
    await app.open(`/${slug}/articles`);

    await expect(browser).toHaveURL(`/${slug}/posts?type=article`);
    await expect(screen.getByRole("heading", "No articles yet")).toBeVisible();
  });

  test("chooses French in the preferences, which the app then keeps", async ({
    app,
    browser,
    screen,
  }) => {
    await screen.getByRole("button", `Account of ${name}`).tap();
    await screen.getByRole("menuitem", "Account settings").tap();

    await expect(
      screen.getByRole("heading", "Profile", { level: 1 })
    ).toBeVisible();
    await expect(browser).toHaveURL(`/${slug}/settings/account`);

    // The account keeps English, which it signed up in: choosing French
    // among the preferences saves it, and the page follows at once.
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Preferences")
      .tap();
    await expect(browser).toHaveURL(`/${slug}/settings/account/preferences`);
    await screen.getByRole("combobox", "Language").tap();
    await screen.getByRole("option", "Français").tap();

    await expect(browser).toHaveURL(`/fr/${slug}/settings/account/preferences`);
    await expect(screen.getByRole("combobox", "Langue")).toBeVisible();

    // An English address opens in French now.
    await app.open(`/${slug}/posts?layout=calendar`);

    await expect(browser).toHaveURL(`/fr/${slug}/posts?layout=calendar`);
    await expect(
      screen.getByRole("navigation", "Vues du calendrier")
    ).toBeVisible();
  });

  test("signs out", async ({ app, browser, screen }) => {
    await screen.getByRole("button", `Compte de ${name}`).tap();
    await screen.getByRole("menuitem", "Se déconnecter").tap();

    // "/" is no page: signed out, it asks to sign in.
    await expect(browser).toHaveURL("/fr/login");
    await expect(
      screen.getByRole("main").getByRole("heading", "Se connecter à Peal")
    ).toBeVisible();
    await app.open("/fr");
    await expect(browser).toHaveURL("/fr/login");
  });

  test("signs in to the language the account keeps", async ({
    app,
    browser,
    screen,
  }) => {
    // A browser that remembers no language, signing in from an English page.
    await browser.clearCookies();
    await app.open("/login");
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("main").getByRole("button", "Sign in").tap();

    await expect(browser).toHaveURL(`/fr/${slug}`, { timeout: 30_000 });
  });

  test("lets the invited member sign up and join", async ({
    app,
    browser,
    screen,
  }) => {
    await browser.clearCookies();
    await app.open("/signup");
    await screen.getByLabel("Name").fill(guestName);
    await screen.getByLabel("Email").fill(guestAddress());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    // The confirmation link signs the guest in.
    await browser.goto(
      await emailedLink(guestAddress(), "Confirm your email for Peal")
    );
    await expect(screen.getByRole("heading", "Email confirmed")).toBeVisible();

    await browser.goto(invitationLink);
    await screen.getByRole("button", "Accept the invitation").tap();

    // Joined, the guest has the workspace and none of their own.
    await expect(browser).toHaveURL(`/${slug}`, { timeout: 30_000 });
    await expect(screen.getByRole("button", "Switch workspace")).toContainText(
      workspace
    );
  });
});
