import { platformRules } from "peal-contract/post-text";
import type { CtaLink } from "peal-ui/components/cta-band";
import type { FeatureCellContent } from "peal-ui/components/feature-cell";
import type { SiteMark } from "peal-ui/components/site-icons";
import type { TileGroup } from "peal-ui/components/tile-grid";
import type { UseCase } from "peal-ui/components/use-cases";
import {
  siDotnet,
  siGo,
  siModelcontextprotocol,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  siTypescript,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

import type { MergedPull } from "./github.ts";
import type { Locale } from "./i18n/locales.ts";
import type { Messages } from "./i18n/messages.ts";
import { repository } from "./navigation.ts";
import { githubMark, siteEntries } from "./platforms.ts";

// The home page's sections, from its strings, the contract, the docs and
// what GitHub answered at build time. Kept apart from config.ts, which
// reads astro:env, so the tests build them with settings of their own.

export interface HomeSettings {
  /** A page of the web app, or `undefined` without SITE_APP_URL. */
  readonly app: (path: string) => string | undefined;
  /** A page of the docs, or `undefined` without SITE_DOCS_URL. */
  readonly docs: (path: string) => string | undefined;
  readonly pulls: readonly MergedPull[];
  /** The repository's star count as shown, or `undefined` when unknown. */
  readonly stars: string | undefined;
}

const markOf = (icon: SimpleIcon): SiteMark => ({
  kind: "path",
  path: icon.path,
});

/** The platforms the Platforms menu lists, ad networks aside. */
export const platformCount = siteEntries.filter(
  (entry) => entry.group !== "ads"
).length;

// Each SDK by its folder under packages/peal-sdk/, its name and its mark.
const sdks = [
  { folder: "node", mark: markOf(siTypescript), name: "TypeScript" },
  { folder: "python", mark: markOf(siPython), name: "Python" },
  { folder: "go", mark: markOf(siGo), name: "Go" },
  { folder: "ruby", mark: markOf(siRuby), name: "Ruby" },
  { folder: "java", mark: markOf(siOpenjdk), name: "Java" },
  { folder: "php", mark: markOf(siPhp), name: "PHP" },
  { folder: "dotnet", mark: markOf(siDotnet), name: ".NET" },
  { folder: "rust", mark: markOf(siRust), name: "Rust" },
] as const;

const fill = (text: string, values: Readonly<Record<string, string>>) =>
  text.replaceAll(
    /\{(?<name>[a-z]+)\}/gu,
    (match, name: string) => values[name] ?? match
  );

/** The docs page, or the repository's folder when the build has no docs. */
const docsOr = (settings: HomeSettings, page: string, folder: string) =>
  settings.docs(page) ?? `${repository}/tree/main/${folder}`;

export const agentTiles = (
  t: Messages["home"],
  settings: HomeSettings
): TileGroup[] => [
  {
    label: t.agents.groups.agents,
    tiles: [
      {
        description: t.agents.tiles.mcp,
        href: docsOr(settings, "developers/mcp", "packages/peal-server"),
        mark: markOf(siModelcontextprotocol),
        title: t.agents.titles.mcp,
      },
      {
        description: t.agents.tiles.cli,
        href: docsOr(settings, "developers/cli", "packages/peal-cli"),
        icon: "terminal",
        title: t.agents.titles.cli,
      },
      {
        description: t.agents.tiles.skills,
        href: docsOr(settings, "developers/agents", "packages/peal-skills"),
        icon: "sparkles",
        title: t.agents.titles.skills,
      },
    ],
  },
  {
    label: t.agents.groups.sdks,
    tiles: sdks.map(({ folder, mark, name }) => ({
      href:
        settings.docs("developers/sdks#install") ??
        `${repository}/tree/main/packages/peal-sdk/${folder}`,
      mark,
      title: name,
    })),
  },
];

const textLimit = (platform: "bluesky" | "linkedin" | "mastodon") =>
  platformRules[platform].textLimits[0]?.maximum ?? 0;

export const hardPartCells = (
  locale: Locale,
  t: Messages["home"]
): (FeatureCellContent & { readonly wide?: boolean })[] => {
  const { cells } = t.hardParts;
  const number = new Intl.NumberFormat(locale);
  // A text twelve characters over Bluesky's limit, measured on three networks.
  const length = textLimit("bluesky") + 12;

  const measured = (platform: "bluesky" | "linkedin" | "mastodon") => ({
    chip: {
      state:
        length > textLimit(platform) ? ("warning" as const) : ("done" as const),
      text: length > textLimit(platform) ? t.mock.over : t.mock.within,
    },
    value: `${number.format(length)} / ${number.format(textLimit(platform))}`,
  });

  return [
    {
      ...cells.limits,
      icon: "ruler",
      illustration: {
        kind: "window",
        rows: [
          { label: "Bluesky", ...measured("bluesky") },
          { label: "Mastodon", ...measured("mastodon") },
          { label: "LinkedIn", ...measured("linkedin") },
        ],
        url: "app.peal.social/compose",
      },
    },
    {
      ...cells.media,
      icon: "film",
      illustration: {
        kind: "window",
        rows: [
          {
            chip: { state: "pending", text: t.mock.uploading },
            label: "YouTube",
            value: "video.mp4",
          },
          {
            chip: { state: "done", text: t.mock.processed },
            label: "Instagram",
            value: "cover.jpg",
          },
        ],
        url: "app.peal.social/posts",
      },
    },
    {
      ...cells.unconfirmed,
      icon: "shield",
      illustration: {
        chips: [
          { state: "pending", text: t.mock.publishing },
          { state: "warning", text: t.mock.unconfirmed },
          { text: t.mock.check },
        ],
        kind: "chips",
      },
      wide: true,
    },
    {
      ...cells.timeZones,
      icon: "clock",
      illustration: {
        kind: "window",
        rows: [
          {
            chip: { state: "pending", text: t.mock.scheduled },
            label: "Europe/Paris",
            value: "09:00",
          },
          { label: "America/New_York", value: "03:00" },
          { label: "UTC", value: "08:00" },
        ],
        url: "app.peal.social/calendar",
      },
    },
    {
      ...cells.approvals,
      icon: "check-check",
      illustration: {
        kind: "window",
        rows: [
          {
            chip: { state: "warning", text: t.mock.approval },
            label: "Instagram",
            value: "09:00",
          },
          {
            chip: { state: "warning", text: t.mock.approval },
            label: "LinkedIn",
            value: "09:00",
          },
        ],
        url: "app.peal.social/review",
      },
    },
    {
      ...cells.inbox,
      icon: "inbox",
      illustration: {
        kind: "window",
        rows: [
          { label: "Mastodon", value: t.mock.message },
          { label: "Google Business Profile", value: t.mock.review },
          { label: "Bluesky", value: t.mock.comment },
        ],
        url: "app.peal.social/inbox",
      },
      wide: true,
    },
  ];
};

export const openCells = (
  locale: Locale,
  t: Messages["home"],
  settings: HomeSettings
): FeatureCellContent[] => {
  const { cells } = t.open;
  const selfHosting = settings.docs("self-hosting");

  return [
    {
      ...cells.platforms,
      icon: "globe",
      lead: fill(cells.platforms.lead, {
        platforms: new Intl.NumberFormat(locale).format(platformCount),
      }),
    },
    { ...cells.sdks, icon: "package" },
    {
      icon: "server",
      label: cells.selfHosting.label,
      lead: cells.selfHosting.lead,
      link:
        selfHosting === undefined
          ? undefined
          : { href: selfHosting, label: cells.selfHosting.link },
      text: cells.selfHosting.text,
    },
    {
      icon: "scale",
      illustration: {
        href: repository,
        kind: "repository",
        mark: githubMark,
        name: "peal-social/peal",
        pulls: settings.pulls.map(({ href, number, title }) => ({
          href,
          number,
          title,
        })),
        pullsLabel: cells.repository.pulls,
        stars: settings.stars,
        starsLabel: cells.repository.stars,
      },
      label: cells.repository.label,
      lead: cells.repository.lead,
      text: cells.repository.text,
    },
  ];
};

export const useCases = (
  t: Messages["home"],
  settings: HomeSettings
): UseCase[] => {
  const { cases } = t.useCases;

  const link = (page: string, label: string) => {
    const href = settings.docs(page);

    return href === undefined ? undefined : { href, label };
  };

  return [
    {
      ...cases.marketing,
      chip: { state: "warning", text: t.mock.approval },
      icon: "users",
      link: link("guides/posts/review", cases.marketing.link),
      rows: [
        {
          chip: { state: "warning", text: t.mock.approval },
          label: "Instagram",
          value: "09:00",
        },
        {
          chip: { state: "warning", text: t.mock.approval },
          label: "LinkedIn",
          value: "09:00",
        },
      ],
      url: "app.peal.social/review",
      value: "marketing",
    },
    {
      ...cases.agency,
      chip: { state: "done", text: t.mock.published },
      icon: "layers",
      link: link("guides/workspace/billing", cases.agency.link),
      rows: [
        {
          chip: { state: "pending", text: t.mock.scheduled },
          label: `${t.mock.customer} A`,
          value: "Instagram",
        },
        {
          chip: { state: "done", text: t.mock.published },
          label: `${t.mock.customer} B`,
          value: "LinkedIn",
        },
        {
          chip: { state: "pending", text: t.mock.scheduled },
          label: `${t.mock.customer} C`,
          value: "TikTok",
        },
      ],
      url: "app.peal.social/workspaces",
      value: "agency",
    },
    {
      ...cases.developer,
      chip: { state: "done", text: t.mock.published },
      icon: "braces",
      link: link("api-quickstart", cases.developer.link),
      rows: [
        { label: "POST …/posts/validate", value: "200" },
        {
          chip: { state: "done", text: t.mock.published },
          label: "POST …/posts/send",
          value: "201",
        },
        { label: "post.published", value: "webhook" },
      ],
      url: "app.peal.social/api",
      value: "developer",
    },
    {
      ...cases.agent,
      chip: { state: "pending", text: t.mock.draft },
      icon: "bot",
      link: link("developers/agents", cases.agent.link),
      rows: [
        {
          chip: { state: "done", text: t.mock.allowed },
          label: "create_draft",
          value: "MCP",
        },
        {
          chip: { state: "warning", text: t.mock.denied },
          label: "publish_post",
          value: "MCP",
        },
      ],
      url: "app.peal.social/api/mcp",
      value: "agent",
    },
    {
      ...cases.partner,
      chip: { state: "done", text: t.mock.published },
      icon: "handshake",
      link: link("developers/embedding", cases.partner.link),
      rows: [
        { label: `${t.mock.customer} A`, value: t.mock.connectLink },
        { label: `${t.mock.customer} B`, value: t.mock.connectLink },
      ],
      url: "app.peal.social/connect",
      value: "partner",
    },
  ];
};

/** The closing band's two links, each left out without its setting. */
export interface CtaLinks {
  readonly primary: CtaLink | undefined;
  readonly secondary: CtaLink | undefined;
}

export const ctaLinks = (
  t: Messages["home"],
  settings: HomeSettings
): CtaLinks => {
  const signUp = settings.app("sign-up");
  const docs = settings.docs("");

  return {
    primary:
      signUp === undefined ? undefined : { href: signUp, label: t.cta.primary },
    secondary:
      docs === undefined ? undefined : { href: docs, label: t.cta.secondary },
  };
};
