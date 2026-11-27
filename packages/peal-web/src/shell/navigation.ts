import type { Permission } from "peal-contract";

import { workspacePath } from "#shell/workspace-path.ts";

/**
 * The two modes of a workspace's frame (DESIGN.md): PealCreative runs its
 * channels and posts; PealAPI builds on the API. A page belongs to one, so
 * the address carries the mode.
 */
export type Mode = "api" | "studio";

/** The sections whose pages the sidebar opens in place of its own. */
export type Section = "posts" | "settings";

/** The workspace pages the sidebar links to. */
export type Page =
  | "account"
  | "accountSecurity"
  | "ads"
  | "agent"
  | "agentSettings"
  | "home"
  | "platforms"
  | "analytics"
  | "apiKeys"
  | "assistant"
  | "billing"
  | "blogs"
  | "calendar"
  | "channelSets"
  | "channels"
  | "commentRules"
  | "editor"
  | "feeds"
  | "followUps"
  | "general"
  | "import"
  | "inbox"
  | "media"
  | "members"
  | "messages"
  | "notificationSettings"
  | "notifications"
  | "partner"
  | "posts"
  | "preferences"
  | "queues"
  | "recycling"
  | "security"
  | "signatures"
  | "tags"
  | "webhooks";

/** Pages that are not in the sidebar, which the breadcrumb still names. */
export type Detail =
  | "agentChat"
  | "article"
  | "blog"
  | "channelPlatform"
  | "newArticle"
  | "newChannel"
  | "newPost"
  | "newSkill"
  | "post"
  | "skill";

/**
 * A step the breadcrumb names before the page, each a link back to it:
 * a section (its first page), the agent, the agent's settings, Blogs, a
 * blog, Channels, or New channel.
 */
export type Crumb =
  | Section
  | "agent"
  | "agentSettings"
  | "blog"
  | "blogs"
  | "channels"
  | "newChannel";

// Where each step of the breadcrumb leads, under /<workspace>, but a
// blog's, which its website's channel names.
const crumbPaths: Readonly<Record<Exclude<Crumb, "blog">, string>> = {
  agent: "/agent",
  agentSettings: "/settings/agent",
  blogs: "/blogs",
  channels: "/channels",
  newChannel: "/channels/new",
  posts: "/posts",
  settings: "/settings",
};

/**
 * Where a step of the breadcrumb leads, for a workspace, by its slug; a
 * blog's leads to its website's articles (`site`, the navigation's).
 */
export const crumbHrefOf = (
  workspace: string,
  crumb: Crumb,
  site: string | null
): string =>
  workspacePath(
    workspace,
    crumb === "blog" ? `/blogs/${site ?? ""}` : crumbPaths[crumb]
  );

export type Group = "build" | "engage" | "partners" | "studio";

/**
 * The groups of a section's pages, as Settings sorts its own by concern:
 * the person's own pages first, then the workspace's publishing tools and
 * automations, then what administers it.
 */
export type SectionGroup =
  | "administration"
  | "automations"
  | "personal"
  | "publishing";

interface PageRule {
  /** Under /<workspace>; "" is the section's own address. */
  readonly path: string;
  readonly mode: Mode;
  readonly section?: Section;
  /** Whether a member with these permissions may open the page. */
  readonly may: (permissions: ReadonlySet<Permission>) => boolean;
  /**
   * The page is a list beside the item it opens (DESIGN.md, "Split
   * view"): its addresses under it open in the same page, which keeps
   * its name.
   */
  readonly split?: true;
}

const anyone = (): boolean => true;

const needs =
  (...required: readonly Permission[]) =>
  (permissions: ReadonlySet<Permission>): boolean =>
    required.every((permission) => permissions.has(permission));

// What each page asks of its member, as the page itself checks it.
// The person's own pages (their profile, preferences, notifications and
// security) are in every workspace's settings, for anyone.
const pages: Readonly<Record<Page, PageRule>> = {
  account: {
    may: anyone,
    mode: "studio",
    path: "/settings/account",
    section: "settings",
  },
  accountSecurity: {
    may: anyone,
    mode: "studio",
    path: "/settings/account/security",
    section: "settings",
  },
  ads: { may: needs("ads:read"), mode: "studio", path: "/ads" },
  agent: { may: needs("assistant:use"), mode: "studio", path: "/agent" },
  // The person's skills, and the workspace's they may use.
  agentSettings: {
    may: needs("assistant:use"),
    mode: "studio",
    path: "/settings/agent",
    section: "settings",
  },
  analytics: {
    may: needs("analytics:read"),
    mode: "studio",
    path: "/analytics",
  },
  apiKeys: {
    may: needs("apiKey:read"),
    mode: "api",
    path: "/settings/api-keys",
  },
  assistant: {
    may: needs("assistant:configure"),
    mode: "studio",
    path: "/settings/assistant",
    section: "settings",
  },
  billing: {
    may: needs("billing:read"),
    mode: "studio",
    path: "/billing",
    section: "settings",
  },
  // The workspace's websites, each opening its articles.
  blogs: {
    may: needs("post:read", "channel:read"),
    mode: "studio",
    path: "/blogs",
  },
  // The posts page in its calendar layout: no line in the sidebar, but a
  // page of the command menu and of its key.
  calendar: {
    may: needs("post:read", "channel:read"),
    mode: "studio",
    path: "/posts?layout=calendar",
  },
  channelSets: {
    may: needs("post:read", "channel:read"),
    mode: "studio",
    path: "/settings/channel-sets",
    section: "settings",
  },
  channels: { may: anyone, mode: "studio", path: "/channels" },
  // The video editor composes with the workspace's own Shotstack account,
  // as slide videos do, so it asks what their endpoint asks.
  editor: {
    may: needs("assistant:use", "media:upload"),
    mode: "studio",
    path: "/editor",
  },
  feeds: {
    may: needs("post:read"),
    mode: "studio",
    path: "/settings/feeds",
    section: "settings",
  },
  general: {
    may: anyone,
    mode: "studio",
    path: "/settings",
    section: "settings",
  },
  home: { may: anyone, mode: "studio", path: "" },
  import: {
    may: needs("post:read", "post:schedule", "channel:read"),
    mode: "studio",
    path: "/posts/import",
    section: "posts",
  },
  inbox: {
    may: needs("engagement:read"),
    mode: "studio",
    path: "/inbox",
    split: true,
  },
  media: { may: anyone, mode: "studio", path: "/media" },
  members: {
    may: anyone,
    mode: "studio",
    path: "/settings/members",
    section: "settings",
  },
  messages: {
    may: needs("channel:connect"),
    mode: "studio",
    path: "/settings/messages",
    section: "settings",
  },
  notificationSettings: {
    may: anyone,
    mode: "studio",
    path: "/settings/notifications",
    section: "settings",
  },
  notifications: {
    may: anyone,
    mode: "studio",
    path: "/notifications",
    section: "settings",
  },
  partner: {
    may: needs("partner:read"),
    mode: "api",
    path: "/settings/partner",
  },
  platforms: {
    may: needs("channel:read"),
    mode: "api",
    path: "/platforms",
  },
  posts: {
    may: needs("post:read", "channel:read"),
    mode: "studio",
    path: "/posts",
    section: "posts",
  },
  preferences: {
    may: anyone,
    mode: "studio",
    path: "/settings/account/preferences",
    section: "settings",
  },
  queues: {
    may: needs("post:read", "channel:read"),
    mode: "studio",
    path: "/settings/queues",
    section: "settings",
  },
  recycling: {
    may: needs("post:read"),
    mode: "studio",
    path: "/settings/recycling",
    section: "settings",
  },
  commentRules: {
    may: needs("engagement:read"),
    mode: "studio",
    path: "/settings/comment-rules",
    section: "settings",
  },
  followUps: {
    may: needs("post:read"),
    mode: "studio",
    path: "/settings/follow-ups",
    section: "settings",
  },
  security: {
    may: anyone,
    mode: "studio",
    path: "/settings/security",
    section: "settings",
  },
  signatures: {
    may: needs("post:read"),
    mode: "studio",
    path: "/settings/signatures",
    section: "settings",
  },
  tags: {
    may: needs("post:read"),
    mode: "studio",
    path: "/settings/tags",
    section: "settings",
  },
  webhooks: {
    may: needs("webhook:read"),
    mode: "api",
    path: "/settings/webhooks",
  },
};

// The sidebar's top level in each mode, in groups; a group without a name
// comes first. Posts and Settings open their sections. PealCreative's
// Studio holds what makes and plans posts, Engage what answers and
// measures them.
const layout: Readonly<
  Record<
    Mode,
    readonly { readonly group: Group | null; readonly pages: readonly Page[] }[]
  >
> = {
  api: [
    { group: null, pages: ["platforms"] },
    { group: "build", pages: ["apiKeys", "webhooks"] },
    { group: "partners", pages: ["partner"] },
  ],
  studio: [
    { group: null, pages: ["home", "agent", "channels", "posts", "blogs"] },
    { group: "studio", pages: ["editor", "media"] },
    { group: "engage", pages: ["inbox", "analytics", "ads"] },
  ],
};

// Each section's pages, in groups; a group without a name comes first.
const sectionLayout: Readonly<
  Record<
    Section,
    readonly {
      readonly group: SectionGroup | null;
      readonly pages: readonly Page[];
    }[]
  >
> = {
  posts: [{ group: null, pages: ["posts", "import"] }],
  settings: [
    {
      group: "personal",
      pages: [
        "account",
        "preferences",
        "notifications",
        "notificationSettings",
        "accountSecurity",
        "agentSettings",
      ],
    },
    {
      group: "publishing",
      pages: ["tags", "signatures", "channelSets", "messages", "assistant"],
    },
    {
      group: "automations",
      pages: ["queues", "recycling", "followUps", "commentRules", "feeds"],
    },
    {
      group: "administration",
      pages: ["general", "members", "security", "billing"],
    },
  ],
};

const sectionPages = (section: Section): readonly Page[] =>
  sectionLayout[section].flatMap(({ pages: listed }) => listed);

export interface Link {
  readonly page: Page;
  readonly href: string;
  readonly current: boolean;
  /** The section the link opens, for Posts and Settings. */
  readonly opens: Section | null;
}

export interface Navigation {
  readonly mode: Mode;
  /** The page open, or null on a page the sidebar does not list. */
  readonly current: Page | null;
  /** The section the open page belongs to, which the sidebar shows. */
  readonly section: Section | null;
  /** The sidebar's top level for the mode. */
  readonly groups: readonly {
    readonly group: Group | null;
    readonly links: readonly Link[];
  }[];
  /** The open section's pages, when there is one. */
  readonly sectionLinks: readonly Link[];
  /** The same pages in their groups, as the sidebar lists them. */
  readonly sectionGroups: readonly {
    readonly group: SectionGroup | null;
    readonly links: readonly Link[];
  }[];
  /** Settings, at the sidebar's foot, which opens its section. */
  readonly settings: Link;
  /** Where each mode starts, or null for a mode the member may not use. */
  readonly modes: Readonly<Record<Mode, string | null>>;
  /**
   * What the panel's header names: the steps before the page, each a way
   * back to it, then the page.
   */
  readonly breadcrumb: {
    readonly trail: readonly Crumb[];
    readonly page: Detail | Page | null;
  };
  /** Whether the page is a split view, its list beside the item open. */
  readonly split: boolean;
  /** The website's channel whose blog is open, under Blogs. */
  readonly site: string | null;
}

/** Where a page is, for a workspace, by its slug. */
export const hrefOf = (workspace: string, page: Page): string =>
  workspacePath(workspace, pages[page].path);

/** The page a path shows, and which page under it, if any. */
interface PageAt {
  readonly page: Page | null;
  readonly detail: Detail | null;
}

// Every page, from the sidebar's top levels and its sections, which
// between them list each once at least.
const pageNames: readonly Page[] = [
  ...Object.values(layout).flatMap((groups) =>
    groups.flatMap(({ pages: listed }) => listed)
  ),
  ...sectionPages("posts"),
  ...sectionPages("settings"),
];

// A blog's page under Blogs: its website's articles at /blogs/<channel>,
// a new article at …/new, an article at …/<article>.
const blogAt = (
  path: string
): { readonly detail: Detail; readonly site: string } | null => {
  const [site = "", item, ...rest] = path.split("/").slice(2);

  if (!path.startsWith("/blogs/") || site === "" || rest.length > 0) {
    return null;
  }

  if (item === undefined) {
    return { detail: "blog", site };
  }

  return item === ""
    ? null
    : { detail: item === "new" ? "newArticle" : "article", site };
};

// The page a path inside a workspace shows: its own path, or the longest
// page path it is under (a post's page is under Posts).
const pageAt = (path: string): PageAt => {
  if (path === "/posts/new") {
    return { detail: "newPost", page: "posts" };
  }

  if (path === "/channels/new") {
    return { detail: "newChannel", page: "channels" };
  }

  if (path.startsWith("/channels/new/")) {
    return { detail: "channelPlatform", page: "channels" };
  }

  if (path === "/settings/agent/skills/new") {
    return { detail: "newSkill", page: "agentSettings" };
  }

  if (path.startsWith("/settings/agent/skills/")) {
    return { detail: "skill", page: "agentSettings" };
  }

  const exact = pageNames.find((page) => pages[page].path === path);

  if (exact !== undefined) {
    return { detail: null, page: exact };
  }

  const blog = blogAt(path);

  if (blog !== null) {
    return { detail: blog.detail, page: "blogs" };
  }

  if (path.startsWith("/posts/")) {
    return { detail: "post", page: "posts" };
  }

  if (path.startsWith("/agent/")) {
    return { detail: "agentChat", page: "agent" };
  }

  if (path.startsWith("/inbox/")) {
    return { detail: null, page: "inbox" };
  }

  return { detail: null, page: null };
};

// The steps the breadcrumb names before the page, outermost first: a
// section's own first page stands alone; a page of a section comes under
// it; an item comes under the list it opens from (an article under its
// blog, under Blogs; a platform's form under New channel, under Channels).
const trailOf = (
  detail: Detail | null,
  current: Page | null,
  section: Section | null
): readonly Crumb[] => {
  const items: Partial<Record<Detail, readonly Crumb[]>> = {
    agentChat: ["agent"],
    article: ["blogs", "blog"],
    blog: ["blogs"],
    channelPlatform: ["channels", "newChannel"],
    newArticle: ["blogs", "blog"],
    newChannel: ["channels"],
    newSkill: ["settings", "agentSettings"],
    skill: ["settings", "agentSettings"],
  };

  const under = detail === null ? undefined : items[detail];

  if (under !== undefined) {
    return under;
  }

  return section === null || (detail === null && current === "posts")
    ? []
    : [section];
};

/** A page the command menu opens. */
export interface PageLink {
  readonly page: Page;
  readonly href: string;
  readonly mode: Mode;
  readonly section: Section | null;
}

// Every page in the order the menu lists them: PealCreative's top level
// with the calendar (the posts page in its calendar layout) and its
// sections' pages after it, then PealAPI's.
const menuOrder: readonly Page[] = [
  ...new Set<Page>([
    ...layout.studio.flatMap(({ pages: listed }) => listed),
    "calendar",
    ...sectionPages("posts"),
    ...sectionPages("settings"),
    ...layout.api.flatMap(({ pages: listed }) => listed),
  ]),
];

/** Every page of the workspace a member with these permissions may open. */
export const pageLinksOf = ({
  permissions,
  workspace,
}: {
  readonly permissions: readonly Permission[];
  /** The workspace's slug. */
  readonly workspace: string;
}): readonly PageLink[] => {
  const may = new Set(permissions);

  return menuOrder.flatMap((page) =>
    pages[page].may(may)
      ? [
          {
            href: hrefOf(workspace, page),
            mode: pages[page].mode,
            page,
            section: pages[page].section ?? null,
          },
        ]
      : []
  );
};

/**
 * The frame's navigation for a path (without its locale), in the
 * workspace, for a member with these permissions: the pages they may open,
 * the one open, its section, its mode, and where each mode starts.
 */
export const navigationOf = ({
  pathname,
  permissions,
  workspace,
}: {
  readonly pathname: string;
  readonly permissions: readonly Permission[];
  /** The workspace's slug, as its addresses write it. */
  readonly workspace: string;
}): Navigation => {
  const may = new Set(permissions);
  const base = workspacePath(workspace);
  const inside = pathname === base || pathname.startsWith(`${base}/`);
  const path = inside ? pathname.slice(base.length) : null;

  const { detail, page: current } =
    path === null ? { detail: null, page: null } : pageAt(path);

  const mode = current === null ? "studio" : pages[current].mode;
  const section = current === null ? null : (pages[current].section ?? null);
  const allowed = (page: Page): boolean => pages[page].may(may);

  const linkOf = (page: Page, opens: Section | null): Link => ({
    current: opens === null ? page === current : section === opens,
    href: hrefOf(workspace, page),
    opens,
    page,
  });

  const groups = layout[mode]
    .map(({ group, pages: listed }) => ({
      group,
      links: listed
        .filter(allowed)
        .map((page) => linkOf(page, page === "posts" ? "posts" : null)),
    }))
    .filter(({ links }) => links.length > 0);

  const sectionGroups =
    section === null
      ? []
      : sectionLayout[section]
          .map(({ group, pages: listed }) => ({
            group,
            links: listed.filter(allowed).map((page) => linkOf(page, null)),
          }))
          .filter(({ links }) => links.length > 0);

  const sectionLinks = sectionGroups.flatMap(({ links }) => links);

  const firstOf = (of: Mode): string | null => {
    const page = layout[of]
      .flatMap(({ pages: listed }) => listed)
      .find(allowed);

    return page === undefined ? null : hrefOf(workspace, page);
  };

  return {
    breadcrumb: {
      page: detail ?? current,
      trail: trailOf(detail, current, section),
    },
    current,
    groups,
    mode,
    modes: { api: firstOf("api"), studio: firstOf("studio") },
    section,
    sectionGroups,
    sectionLinks,
    settings: linkOf("general", "settings"),
    site: path === null ? null : (blogAt(path)?.site ?? null),
    split: current !== null && pages[current].split === true,
  };
};
