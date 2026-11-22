import { describe, expect, it } from "@effect/vitest";
import type { Permission } from "peal-contract";

import {
  crumbHrefOf,
  hrefOf,
  navigationOf,
  pageLinksOf,
} from "#shell/navigation.ts";

const workspace = "synthetic-studio";
const base = `/${workspace}`;

const owner: readonly Permission[] = [
  "ads:read",
  "analytics:read",
  "apiKey:read",
  "assistant:configure",
  "billing:read",
  "channel:read",
  "engagement:read",
  "invitation:create",
  "partner:read",
  "post:create",
  "post:read",
  "post:schedule",
  "webhook:read",
];

const pagesOf = (navigation: ReturnType<typeof navigationOf>) =>
  navigation.groups.flatMap(({ links }) => links.map(({ page }) => page));

// What the breadcrumb names on an article's page.
const articleCrumb = (path: string) =>
  navigationOf({
    pathname: `${base}/articles${path}`,
    permissions: owner,
    workspace,
  }).breadcrumb;

// The navigation on a page of the workspace, for its owner.
const at = (path: string) =>
  navigationOf({ pathname: `${base}${path}`, permissions: owner, workspace });

describe(navigationOf, () => {
  it("puts a PealCreative page in PealCreative, with the pages the member may open", () => {
    const navigation = navigationOf({
      pathname: `${base}/calendar`,
      permissions: owner,
      workspace,
    });

    expect(navigation.mode).toBe("studio");
    expect(navigation.current).toBe("calendar");
    expect(pagesOf(navigation)).toStrictEqual([
      "home",
      "channels",
      "calendar",
      "posts",
      "media",
      "inbox",
      "analytics",
      "ads",
    ]);
    expect(navigation.groups.map(({ group }) => group)).toStrictEqual([
      null,
      "engage",
    ]);
    expect(navigation.breadcrumb).toStrictEqual({
      page: "calendar",
      trail: [],
    });
  });

  it("leaves out what the member's permissions do not open", () => {
    const navigation = navigationOf({
      pathname: `${base}/calendar`,
      permissions: ["post:read"],
      workspace,
    });

    expect(pagesOf(navigation)).toStrictEqual([
      "home",
      "channels",
      "calendar",
      "media",
    ]);
    expect(navigation.modes.api).toBeNull();
    expect(navigation.modes.studio).toBe(base);
  });

  it("puts the API's pages in PealAPI, and starts PealAPI at its first", () => {
    const navigation = navigationOf({
      pathname: `${base}/settings/webhooks`,
      permissions: owner,
      workspace,
    });

    expect(navigation.mode).toBe("api");
    expect(navigation.section).toBeNull();
    expect(pagesOf(navigation)).toStrictEqual([
      "platforms",
      "apiKeys",
      "webhooks",
      "partner",
    ]);
    expect(navigation.modes.api).toBe(`${base}/platforms`);
  });

  it("opens the Posts section on its pages", () => {
    const imported = navigationOf({
      pathname: `${base}/posts/import`,
      permissions: owner,
      workspace,
    });

    expect(imported.section).toBe("posts");
    expect(imported.sectionLinks.map(({ page }) => page)).toStrictEqual([
      "posts",
      "articles",
      "import",
    ]);
    expect(imported.sectionLinks.find(({ current }) => current)?.page).toBe(
      "import"
    );
    expect(imported.breadcrumb).toStrictEqual({
      page: "import",
      trail: ["posts"],
    });
  });

  it("has no Drafts or Approvals page, as they are tabs of Posts", () => {
    const opened = ["/drafts", "/approvals"].map(
      (gone) =>
        navigationOf({
          pathname: `${base}${gone}`,
          permissions: owner,
          workspace,
        }).current
    );

    expect(opened).toStrictEqual([null, null]);
    expect(
      pageLinksOf({ permissions: owner, workspace }).map(({ page }) => page)
    ).toStrictEqual(expect.not.arrayContaining(["drafts", "approvals"]));
  });

  it("nests New channel and a platform's form under Channels, which stays open", () => {
    expect(at("/channels/new").breadcrumb).toStrictEqual({
      page: "newChannel",
      trail: ["channels"],
    });
    expect(at("/channels/new/mastodon").breadcrumb).toStrictEqual({
      page: "channelPlatform",
      trail: ["channels", "newChannel"],
    });
    expect(at("/channels/new/mastodon").current).toBe("channels");
    expect(at("/channels/new").section).toBeNull();
  });

  it("leads each step of the breadcrumb back to its page", () => {
    expect(
      (
        ["posts", "settings", "articles", "channels", "newChannel"] as const
      ).map((crumb) => crumbHrefOf(workspace, crumb))
    ).toStrictEqual([
      `${base}/posts`,
      `${base}/settings`,
      `${base}/articles`,
      `${base}/channels`,
      `${base}/channels/new`,
    ]);
  });

  it("keeps an article's pages under Posts, an article under Articles", () => {
    expect(articleCrumb("")).toStrictEqual({
      page: "articles",
      trail: ["posts"],
    });
    expect(articleCrumb("/new")).toStrictEqual({
      page: "newArticle",
      trail: ["posts", "articles"],
    });
    expect(articleCrumb("/00000000-0000-7000-8000-0000000000c1")).toStrictEqual(
      {
        page: "article",
        trail: ["posts", "articles"],
      }
    );
  });

  it("keeps a post's own pages under Posts, and names them", () => {
    const post = navigationOf({
      pathname: `${base}/posts/00000000-0000-7000-8000-0000000000b2`,
      permissions: owner,
      workspace,
    });

    expect(post.section).toBe("posts");
    expect(post.breadcrumb).toStrictEqual({ page: "post", trail: ["posts"] });
    expect(
      navigationOf({
        pathname: `${base}/posts/new`,
        permissions: owner,
        workspace,
      }).breadcrumb
    ).toStrictEqual({ page: "newPost", trail: ["posts"] });
    expect(
      navigationOf({
        pathname: `${base}/posts/import`,
        permissions: owner,
        workspace,
      }).current
    ).toBe("import");
  });

  it("opens the Settings section, marks Settings, and lists its pages by permission", () => {
    const navigation = navigationOf({
      pathname: `${base}/settings/tags`,
      permissions: ["post:read"],
      workspace,
    });

    expect(navigation.section).toBe("settings");
    expect(navigation.settings.current).toBeTruthy();
    expect(navigation.sectionLinks.map(({ page }) => page)).toStrictEqual([
      "general",
      "members",
      "security",
      "tags",
      "signatures",
      "recycling",
      "followUps",
      "feeds",
      "account",
      "notifications",
      "notificationSettings",
    ]);
    expect(
      navigationOf({
        pathname: `${base}/billing`,
        permissions: owner,
        workspace,
      }).section
    ).toBe("settings");
  });

  it("keeps the person's own pages in Settings, for any member", () => {
    for (const [path, page] of [
      ["/settings/account", "account"],
      ["/notifications", "notifications"],
      ["/settings/notifications", "notificationSettings"],
    ] as const) {
      const navigation = navigationOf({
        pathname: `${base}${path}`,
        permissions: [],
        workspace,
      });

      expect([navigation.current, navigation.breadcrumb]).toStrictEqual([
        page,
        { page, trail: ["settings"] },
      ]);
      expect(hrefOf(workspace, page)).toBe(`${base}${path}`);
    }
  });

  it("keeps the inbox open as a split view on a thread, and names nothing on a page it does not list", () => {
    const thread = navigationOf({
      pathname: `${base}/inbox/abc`,
      permissions: owner,
      workspace,
    });

    expect([thread.breadcrumb, thread.split, thread.current]).toStrictEqual([
      { page: "inbox", trail: [] },
      true,
      "inbox",
    ]);

    const elsewhere = navigationOf({
      pathname: `${base}/unknown`,
      permissions: owner,
      workspace,
    });

    expect(elsewhere.current).toBeNull();
    expect(elsewhere.mode).toBe("studio");
    expect(elsewhere.breadcrumb).toStrictEqual({ page: null, trail: [] });
  });

  it("lists the agent after Home for those who may use the assistant, a chat under it", () => {
    const asks: readonly Permission[] = [...owner, "assistant:use"];

    const page = navigationOf({
      pathname: `${base}/agent`,
      permissions: asks,
      workspace,
    });

    const chat = navigationOf({
      pathname: `${base}/agent/c1`,
      permissions: asks,
      workspace,
    });

    expect([
      pagesOf(page).slice(0, 2),
      page.current,
      chat.breadcrumb,
      crumbHrefOf(workspace, "agent"),
      pagesOf(at("/agent")).includes("agent"),
    ]).toStrictEqual([
      ["home", "agent"],
      "agent",
      { page: "agentChat", trail: ["agent"] },
      `${base}/agent`,
      false,
    ]);
  });
});
