import { randomUUID } from "node:crypto";

import { describe, test } from "@e2e-dev/web";
import type { Browser } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import type { Screen } from "e2e";

import { confirmedAccount, makeStaff } from "./support/accounts.ts";
import { seedChannel } from "./support/channels.ts";
import { seedComment, seedCountedPost } from "./support/followed.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// A post of several parts, the numbers of a post that went live and the
// comments under it, as a member finds them; then as staff acting for the
// member, who read the numbers and no comment. No platform is reached in a
// run: the post that "went live" is seeded as analytics and the inbox keep
// it, and nothing is sent. The module loads again for each attempt, so a
// retry uses new addresses.
const run = randomUUID();
const name = "Noor Example";
const staffName = "Robin Staff";
const handle = "@pools@social.example";
const first = "A synthetic thread, first part: what we found at low tide.";
const second = "Second part: the anemones, with a wait before it.";
const commenter = "A Synthetic Reader";
const comment = "A synthetic comment: which beach was it?";

const addressOf = (label: string) =>
  credentials.user("member").username.replace("@", `+${run}-${label}@`);

// These accounts sign up through the API, whose password the journey must
// know: synthetic, like their addresses.
const password = "synthetic threads and inbox password";

let workspaceId = "";
let slug = "";

const signIn = async (
  app: { readonly open: (path: string) => Promise<void> },
  browser: Browser,
  screen: Screen,
  email: string
) => {
  await browser.clearCookies();
  await app.open("/login");
  await screen.getByLabel("Email").fill(email);
  await screen.getByLabel("Password").fill(password);
  await screen.getByRole("main").getByRole("button", "Sign in").tap();
};

describe("threads, analytics and the inbox", { serial: true }, () => {
  test("a member writes a post of two parts and keeps it as a draft", async ({
    app,
    browser,
    screen,
  }) => {
    await confirmedAccount(app.baseUrl, {
      email: addressOf("author"),
      name,
      password,
    });

    await signIn(app, browser, screen, addressOf("author"));
    ({ id: workspaceId, slug } = await openedWorkspace(browser));
    expect(workspaceId).not.toBe("");

    await seedChannel(workspaceId, handle);
    await app.open(`/${slug}/posts/new`);

    await expect(screen.getByRole("heading", "New post")).toBeVisible();
    await screen.getByRole("button", /^Channels /u).tap();
    await screen.getByRole("option", handle).tap();
    await screen.getByRole("combobox", "Search channels").press("Escape");
    await screen.getByRole("textbox", "Text for all channels").fill(first);

    // The text's toolbar adds the first part, and its section shows.
    await screen.getByRole("button", "Add a part").tap();

    const thread = screen.getByRole("region", "Thread and first comment");

    await thread.getByRole("textbox", "Part 2").fill(second);

    // The post asks a poll, which Mastodon takes.
    await screen.getByRole("button", "Add a poll").tap();

    const poll = screen.getByRole("region", "Poll");

    await poll.getByRole("textbox", "Choice 1").fill("Mornings");
    await poll.getByRole("textbox", "Choice 2").fill("Evenings");
    await screen.getByRole("button", "Save as draft").tap();

    await expect(screen.getByText("Draft saved.")).toBeVisible();
    await expect(browser).toHaveURL(
      new RegExp(`/${slug}/posts/[0-9a-f-]+$`, "u")
    );

    // The draft comes back whole: both parts, in order.
    await browser.reload();

    await expect(screen.getByRole("heading", "Edit the draft")).toBeVisible();
    await expect(
      screen.getByRole("textbox", "Text for all channels")
    ).toHaveText(first);
    await expect(
      screen
        .getByRole("region", "Thread and first comment")
        .getByRole("textbox", "Part 2")
    ).toHaveText(second);
    await expect(
      screen.getByRole("region", "Poll").getByRole("textbox", "Choice 2")
    ).toHaveValue("Evenings");

    // Nothing goes out: the draft is discarded.
    await screen.getByRole("button", "Discard the draft").tap();
    await screen
      .getByRole("dialog", "Discard this draft?")
      .getByRole("button", "Discard the draft")
      .tap();
    await expect(screen.getByText("Draft discarded.")).toBeVisible();
  });

  test("reads the numbers of a post that went live", async ({
    app,
    browser,
    screen,
  }) => {
    await seedCountedPost(workspaceId, handle, { likes: 12, reposts: 3 });
    await app.open(`/${slug}`);
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Analytics")
      .tap();

    await expect(
      screen.getByRole("heading", "Analytics", { level: 1 })
    ).toBeVisible();
    await expect(browser).toHaveURL(`/${slug}/analytics`);

    // The board starts with the few that matter: the rest are added
    // from the sheet, at its end.
    await expect(screen.getByRole("article", "Followers")).toBeVisible();
    await expect(screen.getByRole("article", "Channels")).toBeHidden();

    await screen.getByRole("button", "Add widgets").tap();
    await screen.getByRole("button", "Add Channels").tap();
    await screen.getByRole("button", "Add Export").tap();
    await screen
      .getByRole("dialog", "Add widgets")
      .getByRole("button", "Close")
      .tap();

    // Each channel on a line of the Channels widget.
    const totals = screen.getByRole(
      "list",
      "The latest counts of the range’s posts, by channel"
    );

    await expect(totals).toBeVisible();
    await expect(totals.getByText(/@pools@social\.example/u)).toBeVisible();

    // And the same numbers as files.
    const exports = screen.getByRole("article", "Export");

    await expect(
      exports.getByRole("button", "Posts of the range")
    ).toBeVisible();
    await expect(
      exports.getByRole("button", "Accounts, day by day")
    ).toBeVisible();

    // Each widget keeps a period of its own, chosen in its filter.
    const followers = screen.getByRole("article", "Followers");

    await followers.getByRole("button", "Filter Followers").tap();
    await screen.getByRole("option", "Period").tap();
    await screen.getByRole("option", "Last 7 days").tap();

    await expect(followers).toContainText("Last 7 days");
    await expect(exports).toContainText("Last 30 days");

    // The board stays as arranged.
    await app.open(`/${slug}/analytics`);
    await expect(screen.getByRole("article", "Export")).toBeVisible();
    await expect(screen.getByRole("article", "Followers")).toContainText(
      "Last 7 days"
    );
  });

  test("reads a comment in the inbox and settles it", async ({
    app,
    browser,
    screen,
  }) => {
    await seedComment(workspaceId, handle, {
      author: commenter,
      text: comment,
    });
    await app.open(`/${slug}`);
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Inbox")
      .tap();

    await expect(
      screen.getByRole("heading", "Inbox", { level: 1 })
    ).toBeVisible();
    await expect(browser).toHaveURL(`/${slug}/inbox`);

    // The list holds counts, not what people wrote.
    await expect(screen.getByText("1 waiting of 1")).toBeVisible();
    await expect(screen.getByText(comment)).toBeHidden();

    await screen
      .getByRole("main")
      .getByRole("link", /^Comments under the post on /u)
      .tap();

    // The thread opens beside the list, which stays, its row marked.
    await expect(
      screen.getByRole("heading", "Comment", { level: 2 })
    ).toBeVisible();
    await expect(
      screen.getByRole("heading", "Inbox", { level: 1 })
    ).toBeVisible();
    await expect(
      screen
        .getByRole("main")
        .getByRole("link", /^Comments under the post on /u)
    ).toHaveAttribute("aria-current", "page");
    await expect(screen.getByText(comment)).toBeVisible();
    await expect(screen.getByText(commenter)).toBeVisible();

    // The account may answer: the box says who will read the reply.
    await expect(
      screen.getByText(
        "Everyone who sees the post sees the reply, sent as the channel’s account."
      )
    ).toBeVisible();

    // Settled without a reply: nothing is sent to any platform.
    await screen.getByRole("button", "Mark as answered").tap();

    await expect(
      screen.getByText("The comment is marked as answered.")
    ).toBeVisible();
    await expect(screen.getByRole("button", "Mark as waiting")).toBeVisible();
    // The thread and its row in the list both count it.
    await expect(
      screen
        .getByRole("main")
        .getByRole("link", /^Comments under the post on /u)
        .getByText("0 waiting of 1")
    ).toBeVisible();
  });

  test("lets staff acting as the member read the numbers, and no comment", async ({
    app,
    browser,
    screen,
  }) => {
    await confirmedAccount(app.baseUrl, {
      email: addressOf("staff"),
      name: staffName,
      password,
    });
    await makeStaff(addressOf("staff"));
    await signIn(app, browser, screen, addressOf("staff"));
    // Staff without a workspace get one of their own, which opens.
    await openedWorkspace(browser);

    await app.open("/admin/users");
    await screen.getByLabel("Email, name or id").fill(addressOf("author"));
    await screen.getByRole("button", "Search").tap();
    await screen.getByRole("main").getByRole("link", name).tap();

    // The page arrives from the server before it hydrates: the button is
    // disabled until it opens its confirmation.
    const actAs = screen
      .getByRole("main")
      .getByRole("button", "Act as this account");

    await expect(actAs).toBeEnabled();
    await actAs.tap();

    const dialog = screen.getByRole("alertdialog", `Act as ${name}?`);

    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", "Why").fill("Synthetic support request");
    await dialog.getByRole("button", "Act as the account").tap();

    // Acting as the member opens the member's workspace.
    await expect(browser).toHaveURL(`/${slug}`, { timeout: 30_000 });

    const banner = screen.getByRole("region", "Acting as another account");

    await expect(banner).toBeVisible();

    // The numbers are the workspace's own; the comments are other
    // people's words, which staff need none of to help a member.
    const links = screen.getByRole("navigation", "Workspace");

    await expect(links.getByRole("link", "Analytics")).toBeVisible();
    await expect(links.getByRole("link", "Inbox")).toBeHidden();

    await app.open(`/${slug}/analytics`);
    await expect(
      screen.getByRole("heading", "Analytics", { level: 1 })
    ).toBeVisible();

    await app.open(`/${slug}/inbox`);
    await expect(screen.getByRole("heading", "Page not found")).toBeVisible();
    await expect(screen.getByText(comment)).toBeHidden();

    await banner.getByRole("button", "Stop acting as them").tap();
    await expect(
      screen.getByRole("region", "Acting as another account")
    ).toBeHidden();
  });
});
