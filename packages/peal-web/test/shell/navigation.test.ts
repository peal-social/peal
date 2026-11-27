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

// The pages of the Studio's group.
const studio = (navigation: ReturnType<typeof navigationOf>) =>
  navigation.groups
    .find(({ group }) => group === "studio")
    ?.links.map(({ page }) => page);

// A website's channel, whose articles a blog's pages show.
const site = "00000000-0000-7000-8000-0000000000d1";

// The navigation on a page of the workspace, for its owner.
const at = (path: string) =>
  navigationOf({ pathname: `${base}${path}`, permissions: owner, workspace });

describe(navigationOf, () => {
  it("puts a PealCreative page in PealCreative, with the pages the member may open", () => {
    const navigation = navigationOf({
      pathname: `${base}/media`,
      permissions: owner,
      workspace,
    });

    expect(navigation.mode).toBe("studio");
    expect(navigation.current).toBe("media");
    expect(pagesOf(navigation)).toStrictEqual([
      "home",
      "channels",
      "posts",
      "blogs",
      "media",
      "inbox",
      "analytics",
      "ads",
    ]);
    expect(navigation.groups.map(({ group }) => group)).toStrictEqual([
      null,
      "studio",
      "engage",
    ]);
    expect(navigation.breadcrumb).toStrictEqual({
      page: "media",
      trail: [],
    });
  });

  it("opens the Studio with its editor for who may compose a video into the library", () => {
    const composer = navigationOf({
      pathname: `${base}/editor`,
      permissions: [...owner, "assistant:use", "media:upload"],
      workspace,
    });

    expect([
      composer.mode,
      composer.current,
      composer.breadcrumb,
      studio(composer),
      hrefOf(workspace, "editor"),
      studio(at("/editor")),
    ]).toStrictEqual([
      "studio",
      "editor",
      { page: "editor", trail: [] },
      ["editor", "posts", "blogs", "media"],
      `${base}/editor`,
      ["posts", "blogs", "media"],
    ]);
  });

  it("leaves out what the member's permissions do not open", () => {
    const navigation = navigationOf({
      pathname: `${base}/media`,
      permissions: ["post:read"],
      workspace,
    });

    expect(pagesOf(navigation)).toStrictEqual(["home", "channels", "media"]);
    expect(navigation.groups.map(({ group }) => group)).toStrictEqual([
      null,
      "studio",
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
        [
          "posts",
          "settings",
          "blogs",
          "blog",
          "channels",
          "newChannel",
        ] as const
      ).map((crumb) => crumbHrefOf(workspace, crumb, site))
    ).toStrictEqual([
      `${base}/posts`,
      `${base}/settings`,
      `${base}/blogs`,
      `${base}/blogs/${site}`,
      `${base}/channels`,
      `${base}/channels/new`,
    ]);
  });

  it("puts Blogs after Posts, outside its section, for who may read posts and channels", () => {
    const blogs = at("/blogs");

    expect([
      blogs.current,
      blogs.section,
      blogs.site,
      blogs.breadcrumb,
      hrefOf(workspace, "blogs"),
      studio(
        navigationOf({
          pathname: `${base}/blogs`,
          permissions: ["post:read"],
          workspace,
        })
      ),
    ]).toStrictEqual([
      "blogs",
      null,
      null,
      { page: "blogs", trail: [] },
      `${base}/blogs`,
      ["media"],
    ]);
  });

  it("keeps a blog under Blogs, and its articles under the blog", () => {
    const blog = at(`/blogs/${site}`);
    const newArticle = at(`/blogs/${site}/new`);
    const article = at(`/blogs/${site}/00000000-0000-7000-8000-0000000000c1`);

    expect(
      [blog, newArticle, article].map(({ site: open }) => open)
    ).toStrictEqual([site, site, site]);
    expect(blog.breadcrumb).toStrictEqual({ page: "blog", trail: ["blogs"] });
    expect(newArticle.breadcrumb).toStrictEqual({
      page: "newArticle",
      trail: ["blogs", "blog"],
    });
    expect(article.breadcrumb).toStrictEqual({
      page: "article",
      trail: ["blogs", "blog"],
    });
    expect(article.current).toBe("blogs");
  });

  it("has no Articles page, as each blog lists its own", () => {
    expect(at("/articles").current).toBeNull();
    expect(
      pageLinksOf({ permissions: owner, workspace }).map(({ page }) => page)
    ).toStrictEqual(expect.not.arrayContaining(["articles"]));
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
      "account",
      "preferences",
      "notifications",
      "notificationSettings",
      "accountSecurity",
      "tags",
      "signatures",
      "recycling",
      "followUps",
      "feeds",
      "general",
      "members",
      "security",
    ]);
    expect(
      navigation.sectionGroups.map(({ group, links }) => [
        group,
        links.map(({ page }) => page),
      ])
    ).toStrictEqual([
      [
        "personal",
        [
          "account",
          "preferences",
          "notifications",
          "notificationSettings",
          "accountSecurity",
        ],
      ],
      ["publishing", ["tags", "signatures"]],
      ["automations", ["recycling", "followUps", "feeds"]],
      ["administration", ["general", "members", "security"]],
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
      ["/settings/account/preferences", "preferences"],
      ["/settings/account/security", "accountSecurity"],
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
      crumbHrefOf(workspace, "agent", null),
      pagesOf(at("/agent")).includes("agent"),
    ]).toStrictEqual([
      ["home", "agent"],
      "agent",
      { page: "agentChat", trail: ["agent"] },
      `${base}/agent`,
      false,
    ]);
  });

  it("puts the agent's settings in Settings for those who may use it, a skill under them", () => {
    const asks: readonly Permission[] = ["assistant:use"];

    const settings = navigationOf({
      pathname: `${base}/settings/agent`,
      permissions: asks,
      workspace,
    });

    const crumbs = (path: string) =>
      navigationOf({
        pathname: `${base}/settings/agent${path}`,
        permissions: asks,
        workspace,
      }).breadcrumb;

    expect([
      settings.current,
      settings.section,
      settings.breadcrumb,
      settings.sectionLinks.some(({ page }) => page === "agentSettings"),
      at("/settings").sectionLinks.some(({ page }) => page === "agentSettings"),
      crumbs("/skills/new"),
      crumbs("/skills/s1"),
      crumbHrefOf(workspace, "agentSettings", null),
      hrefOf(workspace, "agentSettings"),
    ]).toStrictEqual([
      "agentSettings",
      "settings",
      { page: "agentSettings", trail: ["settings"] },
      true,
      false,
      { page: "newSkill", trail: ["settings", "agentSettings"] },
      { page: "skill", trail: ["settings", "agentSettings"] },
      `${base}/settings/agent`,
      `${base}/settings/agent`,
    ]);
  });
});
