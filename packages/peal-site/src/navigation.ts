import type {
  SiteFooterColumn,
  SiteFooterProps,
} from "peal-ui/components/site-footer";
import type {
  SiteHeaderProps,
  SiteIcon,
  SiteMenuGroup,
  SiteMenuLink,
  SiteNavItem,
} from "peal-ui/components/site-header";

import type { SocialAccount } from "./config.ts";
import { locales } from "./i18n/locales.ts";
import type { Locale } from "./i18n/locales.ts";
import type { Messages } from "./i18n/messages.ts";
import { localeNames } from "./i18n/messages.ts";
import { legalDocuments } from "./legal.ts";
import type { LegalDocument } from "./legal.ts";
import {
  discordMark,
  githubMark,
  platformGroups,
  slackMark,
  siteEntries,
  telegramMark,
} from "./platforms.ts";

// The header's and the footer's props for a page, from its language and
// the build's settings. Kept apart from config.ts, which reads astro:env,
// so the tests build them with settings of their own.

/** Where a menu row leads: a docs page by its path, or a full URL. */
type Target = { readonly docs: string } | { readonly url: string };

type LinkName = keyof Messages["nav"]["links"];

interface Row {
  readonly icon: SiteIcon;
  readonly name: LinkName;
  readonly target: Target;
}

export const repository = "https://github.com/peal-social/peal";

/** Every docs page a menu links to, by its path below the docs' root. */
export const studioRows: readonly Row[] = [
  { icon: "pen", name: "composer", target: { docs: "guides/posts" } },
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
  /** A page of the web app, or `undefined` without SITE_APP_URL. */
  readonly app: (path: string) => string | undefined;
  /** The Discord server's invitation, or `undefined` without SITE_DISCORD_URL. */
  readonly discord: string | undefined;
  /** A page of the docs, or `undefined` without SITE_DOCS_URL. */
  readonly docs: (path: string) => string | undefined;
  /** The repository's star count as shown, or `undefined` when unknown. */
  readonly stars: string | undefined;
}

export interface PageLinks {
  readonly blog: string;
  readonly home: string;
  /** The current page in a language, for the language links. */
  readonly language: (locale: Locale) => string;
  readonly legal: (document: LegalDocument) => string;
  readonly locale: Locale;
  readonly pricing: string;
  /** Which of the header's own pages this is, to mark it current. */
  readonly current?: "pricing" | undefined;
}

const hrefOf = (target: Target, settings: SiteSettings) =>
  "docs" in target ? settings.docs(target.docs) : target.url;

const menuLinks = (
  rows: readonly Row[],
  t: Messages["nav"],
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
            ...t.links[row.name],
            href,
            icon: row.icon,
            intro: intros[row.name],
          },
        ];
  });
};

const nonEmpty = (groups: readonly SiteMenuGroup[]) =>
  groups.filter((group) => group.links.length > 0);

/** The header's items: the three menus, then Pricing, Docs and Blog. */
const navItems = (
  t: Messages["nav"],
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
      label: "PealStudio",
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
            ...t.links.discord,
            href: settings.discord,
            intro: t.intros.discord,
            mark: discordMark,
          },
        ];

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
            // One preview for every platform; the comparison moves to a
            // link under the rows.
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
          links: [...menuLinks(resourceRows, t, settings), ...discord],
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
    },
    ...(docs === undefined
      ? []
      : [{ href: docs, kind: "link" as const, label: t.docs }]),
    { href: pages.blog, kind: "link", label: t.blog },
  ];
};

export const headerProps = (
  messages: Messages,
  pages: PageLinks,
  settings: SiteSettings
): SiteHeaderProps => {
  const t = messages.nav;
  const signIn = settings.app("sign-in");
  const signUp = settings.app("sign-up");

  return {
    discord:
      settings.discord === undefined
        ? undefined
        : { href: settings.discord, label: t.discord, mark: discordMark },
    drawer: t.drawer,
    getStarted:
      signUp === undefined ? undefined : { href: signUp, label: t.getStarted },
    github: {
      href: repository,
      label: t.github,
      mark: githubMark,
      stars: settings.stars,
      starsLabel: t.stars,
    },
    home: { href: pages.home, label: t.home, name: t.brand },
    items: navItems(t, pages, messages.pricing.nav, settings),
    label: t.main,
    signIn:
      signIn === undefined ? undefined : { href: signIn, label: t.signIn },
  };
};

export const footerProps = (
  messages: Messages,
  pages: PageLinks,
  settings: SiteSettings,
  accounts: readonly SocialAccount[]
): SiteFooterProps => {
  const t = messages.footer;

  const contract = [
    { href: settings.app("cancel"), label: t.cancel },
    { href: settings.app("withdraw"), label: t.withdraw },
  ].flatMap(({ href, label }) => (href === undefined ? [] : [{ href, label }]));

  const legal: SiteFooterColumn = {
    label: t.legal,
    links: legalDocuments.map((document) => ({
      href: pages.legal(document),
      label: messages.legal[document],
    })),
  };

  const follow: SiteFooterColumn = {
    label: t.follow,
    links: [
      ...accounts.map(({ href, name, rel }) => ({ href, label: name, rel })),
      ...(settings.discord === undefined
        ? []
        : [{ href: settings.discord, label: messages.nav.discord }]),
      { href: repository, label: t.source },
    ],
  };

  return {
    captions: t.captions,
    columns: [
      legal,
      ...(contract.length === 0
        ? []
        : [{ label: t.contract, links: contract }]),
      follow,
    ],
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
    note: t.license,
  };
};
