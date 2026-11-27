import type {
  SiteFooterColumn,
  SiteFooterProps,
} from "../../components/site-footer";
import type {
  SiteHeaderProps,
  SiteIcon,
  SiteMenuGroup,
  SiteMenuLink,
  SiteNavItem,
} from "../../components/site-header";
import type { SocialAccount } from "./links";
import { locales } from "./locales";
import type { Locale } from "./locales";
import { localeNames } from "./messages";
import type { ChromeMessages } from "./messages";
import {
  discordMark,
  githubMark,
  platformGroups,
  slackMark,
  siteEntries,
  telegramMark,
} from "./platforms";
import { statusApiOf } from "./status";

// The header's and the footer's props for a page of peal.social (the
// site's or the blog's), from its language, its links and the app's
// settings. Plain data, so each app builds them from its own environment
// and the tests from settings of their own.

/** Where a menu row leads: a docs page by its path, or a full URL. */
type Target = { readonly docs: string } | { readonly url: string };

type LinkName = keyof ChromeMessages["nav"]["links"];

interface Row {
  readonly icon: SiteIcon;
  readonly name: LinkName;
  readonly target: Target;
}

/**
 * The legal pages the footer links to, which the site serves: the page
 * that lists every document, and the privacy policy for its cookies.
 */
export type FooterDocument = "legal" | "privacy";

export const repository = "https://github.com/peal-social/peal";

/**
 * Every docs page a menu links to, by its path below the docs' root. Each
 * product lists what it does as plain names, AI first; the hover preview
 * says what each one is.
 */
export const studioRows: readonly Row[] = [
  { icon: "bot-message", name: "aiAgent", target: { docs: "guides/agent" } },
  {
    icon: "wand",
    name: "assistant",
    target: { docs: "guides/posts/assistant" },
  },
  { icon: "pen", name: "publishing", target: { docs: "guides/posts" } },
  {
    icon: "calendar",
    name: "calendar",
    target: { docs: "guides/posts/schedule" },
  },
  {
    icon: "check-check",
    name: "approvals",
    target: { docs: "guides/posts/review" },
  },
  { icon: "inbox", name: "inbox", target: { docs: "guides/engage/inbox" } },
  {
    icon: "chart",
    name: "analytics",
    target: { docs: "guides/engage/analytics" },
  },
  { icon: "megaphone", name: "ads", target: { docs: "guides/engage/ads" } },
];

export const developerRows: readonly Row[] = [
  { icon: "braces", name: "api", target: { docs: "developers" } },
  { icon: "bot", name: "mcp", target: { docs: "developers/mcp" } },
  { icon: "terminal", name: "cli", target: { docs: "developers/cli" } },
  { icon: "package", name: "sdks", target: { docs: "developers/sdks" } },
  { icon: "sparkles", name: "agents", target: { docs: "developers/agents" } },
  {
    icon: "webhook",
    name: "webhooks",
    target: { docs: "developers/webhooks" },
  },
  {
    icon: "panels",
    name: "embedding",
    target: { docs: "developers/embedding" },
  },
];

/** The page every platform's own page hangs from. */
export const platformsPage = "platforms";

/** The latest launch, which the Products menu features. */
export const launchPage = "platforms/discord";

export const resourceRows: readonly Row[] = [
  {
    icon: "history",
    name: "changelog",
    target: { url: `${repository}/releases` },
  },
  { icon: "server", name: "selfHosting", target: { docs: "self-hosting" } },
  {
    icon: "activity",
    name: "status",
    target: { url: "https://status.peal.social" },
  },
  {
    icon: "shield",
    name: "security",
    target: { url: `${repository}/blob/main/SECURITY.md` },
  },
];

export interface SiteSettings {
  /** A page of the web app, or `undefined` when no app URL is set. */
  readonly app: (path: string) => string | undefined;
  /** The Discord server's invitation, or `undefined` when none is set. */
  readonly discord: string | undefined;
  /** A page of the docs, or `undefined` when no docs URL is set. */
  readonly docs: (path: string) => string | undefined;
  /** The repository's star count as shown, or `undefined` when unknown. */
  readonly stars: string | undefined;
}

export interface PageLinks {
  readonly blog: string;
  readonly home: string;
  /** The current page in a language, for the language links. */
  readonly language: (locale: Locale) => string;
  readonly legal: (document: FooterDocument) => string;
  readonly locale: Locale;
  readonly pricing: string;
  /** Which of the header's own pages this is, to mark it current. */
  readonly current?: "pricing" | undefined;
}

const hrefOf = (target: Target, settings: SiteSettings) =>
  "docs" in target ? settings.docs(target.docs) : target.url;

const menuLinks = (
  rows: readonly Row[],
  t: ChromeMessages["nav"],
  settings: SiteSettings
): SiteMenuLink[] => {
  // The rows a menu preview introduces have an intro; the others none.
  const intros: Partial<Record<LinkName, SiteMenuLink["intro"]>> = t.intros;

  return rows.flatMap((row) => {
    const href = hrefOf(row.target, settings);

    return href === undefined
      ? []
      : [
          {
            href,
            icon: row.icon,
            intro: intros[row.name],
            title: t.links[row.name],
          },
        ];
  });
};

const nonEmpty = (groups: readonly SiteMenuGroup[]) =>
  groups.filter((group) => group.links.length > 0);

/** The header's items: the three menus, then Pricing and Docs. */
const navItems = (
  t: ChromeMessages["nav"],
  pages: PageLinks,
  pricingLabel: string,
  settings: SiteSettings
): SiteNavItem[] => {
  const launch = settings.docs(launchPage);
  const overview = settings.docs(platformsPage);

  // Social takes a wide cell; the other groups stack beside it.
  const platforms = nonEmpty(
    platformGroups.map((group) => ({
      columns: group === "social" ? (2 as const) : (1 as const),
      label: t.platformGroups[group],
      links: siteEntries
        .filter((platform) => platform.group === group)
        .flatMap(({ docs, mark, name }) => {
          const href = settings.docs(docs);

          return href === undefined ? [] : [{ href, mark, title: name }];
        }),
    }))
  ).map((group, index) => ({ ...group, stack: index > 1 }));

  const products = nonEmpty([
    // The two products, by name, and whom each is for.
    {
      description: t.studio,
      label: "PealCreative",
      links: menuLinks(studioRows, t, settings),
    },
    {
      description: t.developers,
      label: "PealAPI",
      links: menuLinks(developerRows, t, settings),
    },
  ]);

  const discord =
    settings.discord === undefined
      ? []
      : [
          {
            href: settings.discord,
            intro: t.intros.discord,
            mark: discordMark,
            title: t.links.discord,
          },
        ];

  // The blog is a page of the site, in the page's language.
  const blog = {
    href: pages.blog,
    icon: "newspaper" as const,
    intro: t.intros.blog,
    title: t.links.blog,
  };

  const docs = settings.docs("");

  return [
    ...(products.length === 0
      ? []
      : [
          {
            feature:
              launch === undefined
                ? undefined
                : {
                    ...t.launch,
                    href: launch,
                    marks: [discordMark, slackMark, telegramMark],
                  },
            groups: products,
            kind: "menu" as const,
            label: t.products,
            preview: "rows" as const,
            value: "products",
          },
        ]),
    ...(platforms.length === 0
      ? []
      : [
          {
            // One preview for every platform; the comparison is a link
            // under its intro.
            feature: {
              caption: "",
              description: t.platformsIntro.body,
              href: overview ?? repository,
              illustration: "fan-out" as const,
              title: t.platformsIntro.headline,
            },
            footer:
              overview === undefined
                ? undefined
                : { href: overview, label: t.comparePlatforms },
            groups: platforms,
            kind: "menu" as const,
            label: t.platforms,
            preview: "menu" as const,
            value: "platforms",
          },
        ]),
    {
      feature: { ...t.star, href: repository, marks: [githubMark] },
      groups: [
        {
          label: t.resourcesGroup,
          links: [blog, ...menuLinks(resourceRows, t, settings), ...discord],
        },
      ],
      kind: "menu",
      label: t.resources,
      preview: "rows",
      value: "resources",
    },
    {
      current: pages.current === "pricing",
      href: pages.pricing,
      kind: "link",
      label: pricingLabel,
      measure: "pricing",
    },
    ...(docs === undefined
      ? []
      : [
          {
            href: docs,
            kind: "link" as const,
            label: t.docs,
            measure: "docs" as const,
          },
        ]),
  ];
};

export const headerProps = (
  messages: ChromeMessages,
  pages: PageLinks,
  settings: SiteSettings
): SiteHeaderProps => {
  const t = messages.nav;
  const signIn = settings.app("login");
  const signUp = settings.app("signup");

  return {
    discord:
      settings.discord === undefined
        ? undefined
        : {
            href: settings.discord,
            label: t.discord,
            mark: discordMark,
            measure: "discord",
          },
    drawer: t.drawer,
    getStarted:
      signUp === undefined
        ? undefined
        : { href: signUp, label: t.getStarted, measure: "get_started" },
    github: {
      href: repository,
      label: t.github,
      mark: githubMark,
      measure: "github",
      stars: settings.stars,
      starsLabel: t.stars,
    },
    home: { href: pages.home, label: t.home, name: t.brand },
    items: navItems(t, pages, messages.pricing.nav, settings),
    label: t.main,
    signIn:
      signIn === undefined
        ? undefined
        : { href: signIn, label: t.signIn, measure: "log_in" },
  };
};

/** The links whose page exists, without those a setting turns off. */
const present = (
  links: readonly {
    readonly href: string | undefined;
    readonly label: string;
  }[]
) =>
  links.flatMap(({ href, label }) =>
    href === undefined ? [] : [{ href, label }]
  );

export const footerProps = (
  messages: ChromeMessages,
  pages: PageLinks,
  settings: SiteSettings,
  accounts: readonly SocialAccount[]
): SiteFooterProps => {
  const t = messages.footer;

  const titled = (rows: readonly Row[]) =>
    rows.flatMap((row) => {
      const href = hrefOf(row.target, settings);

      return href === undefined
        ? []
        : [{ href, label: messages.nav.links[row.name] }];
    });

  const socials: SiteFooterColumn = {
    label: t.socials,
    links: [
      ...accounts.map(({ href, name, rel }) => ({ href, label: name, rel })),
      ...(settings.discord === undefined
        ? []
        : [{ href: settings.discord, label: messages.nav.discord }]),
      { href: repository, label: t.source },
    ],
  };

  // The status page has its own place, at the foot of the mark's cell.
  const resources: SiteFooterColumn = {
    label: messages.nav.resources,
    links: present([
      { href: settings.docs(""), label: messages.nav.docs },
      { href: pages.blog, label: messages.nav.blog },
      ...titled(resourceRows.filter((row) => row.name !== "status")),
    ]),
  };

  const statusRow = resourceRows.find((row) => row.name === "status");

  const statusHref =
    statusRow === undefined ? undefined : hrefOf(statusRow.target, settings);

  // Pricing, the legal page, which lists every legal document, then
  // Cookie settings, which opens the consent notice where the page
  // measures (`<peal-consent>` intercepts the click), and otherwise leads
  // to the privacy policy's cookies section, as it does without JavaScript.
  const company: SiteFooterColumn = {
    label: t.company,
    links: [
      { href: pages.pricing, label: messages.pricing.nav },
      { href: pages.legal("legal"), label: t.legal },
      {
        href: `${pages.legal("privacy")}#${t.cookies.section}`,
        label: t.cookies.label,
        opens: "consent",
      },
    ],
  };

  const columns: SiteFooterColumn[] = [
    { label: "PealCreative", links: titled(studioRows) },
    { label: "PealAPI", links: titled(developerRows) },
    resources,
    socials,
    company,
  ];

  return {
    captions: {
      start: `© ${new Date().getFullYear()} ${messages.nav.brand}. ${t.rights}`,
    },
    columns: columns.filter((column) => column.links.length > 0),
    home: {
      href: pages.home,
      label: messages.nav.home,
      name: messages.nav.brand,
    },
    languages: {
      label: t.language,
      links: locales.map((code) => ({
        current: code === pages.locale,
        href: pages.language(code),
        hrefLang: code,
        label: localeNames[code],
        lang: code,
      })),
    },
    status:
      statusHref === undefined
        ? undefined
        : {
            api: statusApiOf(statusHref),
            href: statusHref,
            label: messages.nav.links.status,
            states: t.status,
          },
  };
};
