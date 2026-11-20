import type { ChannelPlatform } from "peal-contract";
import { measureText, platformRules } from "peal-contract/post-text";
import type { AppMockProps, ProductSummary } from "peal-ui/components/app-mock";
import type { CodeBlockContent } from "peal-ui/components/code-block";
import type { CtaLink } from "peal-ui/components/cta-band";
import type { FeatureCellContent } from "peal-ui/components/feature-cell";
import type { StageChip, StageTab } from "peal-ui/components/hero-stage";
import type {
  BentoCard,
  BentoPreview,
  BentoTile,
} from "peal-ui/components/product-bento";
import type { ProductRow } from "peal-ui/components/product-rows";
import type { SiteIcon, SiteMark } from "peal-ui/components/site-icons";
import { repository } from "peal-ui/lib/site/navigation";
import { entryOf, githubMark, siteEntries } from "peal-ui/lib/site/platforms";
import {
  siDotnet,
  siGo,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  siTypescript,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

import type { HomeCode } from "./code/home-code.ts";
import type { MergedPull } from "./github.ts";
import type { Locale } from "./i18n/locales.ts";
import type { Messages } from "./i18n/messages.ts";

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

/** A link to a docs page, left out when the build has no docs. */
const docsLink = (settings: HomeSettings, page: string, label: string) => {
  const href = settings.docs(page);

  return href === undefined ? undefined : { href, label };
};

// The mocks' channels: three networks whose limits differ.
const mockPlatforms = ["bluesky", "mastodon", "linkedin"] as const;

type MockPlatform = (typeof mockPlatforms)[number];

/** A text against a platform's first limit, counted as the composer does. */
const measured = (
  locale: Locale,
  t: Messages["home"],
  platform: MockPlatform,
  text: string
) => {
  const number = new Intl.NumberFormat(locale);
  const [limit] = platformRules[platform].textLimits;
  const length = limit === undefined ? 0 : measureText(text, limit.unit);
  const maximum = limit?.maximum ?? 0;
  const fits = length <= maximum;

  return {
    count: `${number.format(length)} / ${number.format(maximum)}`,
    fit: fits
      ? { state: "done" as const, text: t.mock.within }
      : { state: "warning" as const, text: t.mock.over },
  };
};

const chip = (
  settings: HomeSettings,
  icon: SiteIcon,
  label: string,
  page: string
): StageChip[] => {
  const href = settings.docs(page);

  return href === undefined ? [] : [{ href, icon, label }];
};

/** The hero's code demo: the publishing request in every way in. */
export const heroCode = (
  t: Messages["home"],
  code: HomeCode
): CodeBlockContent => ({
  copied: t.api.copied,
  copy: t.api.copy,
  label: t.api.demoLabel,
  lineNumbers: true,
  response: code.publish.response,
  samples: code.publish.samples,
});

/**
 * The hero's stage: PealStudio's composer and PealAPI's code demo, which
 * the page renders as the stage's `code` (heroCode), out of its props.
 */
export const heroTabs = (
  locale: Locale,
  messages: Messages,
  settings: HomeSettings
): StageTab[] => {
  const t = messages.home;
  const { links } = messages.nav;
  const { composer } = t.hero;

  // Bluesky takes its own, shorter text, as any channel may.
  const textOf = (platform: MockPlatform) =>
    platform === "bluesky" ? t.mock.shortPost : t.mock.post;

  return [
    {
      chips: [
        ...chip(settings, "pen", links.composer.title, "guides/posts"),
        ...chip(
          settings,
          "calendar",
          links.calendar.title,
          "guides/posts/schedule"
        ),
        ...chip(
          settings,
          "check-check",
          links.approvals.title,
          "guides/posts/review"
        ),
        ...chip(settings, "inbox", links.inbox.title, "guides/engage/inbox"),
        ...chip(
          settings,
          "chart",
          links.analytics.title,
          "guides/engage/analytics"
        ),
      ],
      chipsLabel: t.hero.chips.studio,
      content: {
        composer: {
          action: composer.action,
          author: { initials: "PE", name: composer.author },
          channels: mockPlatforms.map((platform) => ({
            ...measured(locale, t, platform, textOf(platform)),
            handle: "@peal_example",
            mark: entryOf(platform).mark,
            name: entryOf(platform).name,
            text: textOf(platform),
            value: platform,
          })),
          channelsLabel: composer.channels,
          previewLabel: composer.preview,
          textLabel: composer.text,
          time: composer.time,
          url: "app.peal.social/posts/new",
        },
        kind: "composer",
      },
      label: "PealStudio",
      tile: "light",
      value: "studio",
    },
    {
      chips: [
        ...chip(settings, "braces", t.hero.chips.restApi, "developers"),
        ...chip(settings, "bot", links.mcp.title, "developers/mcp"),
        ...chip(settings, "terminal", links.cli.title, "developers/cli"),
        ...chip(settings, "package", links.sdks.title, "developers/sdks"),
        ...chip(
          settings,
          "webhook",
          links.webhooks.title,
          "developers/webhooks"
        ),
        ...chip(
          settings,
          "panels",
          links.embedding.title,
          "developers/embedding"
        ),
      ],
      chipsLabel: t.hero.chips.api,
      content: { kind: "code" },
      label: "PealAPI",
      tile: "ink",
      value: "api",
    },
  ];
};

const markOfPlatform = (platform: ChannelPlatform) => entryOf(platform).mark;

/** What the two-platforms section shows: the products, then a page of each. */
export interface ProductPairContent {
  readonly mocks: readonly [AppMockProps, AppMockProps];
  readonly products: readonly [ProductSummary, ProductSummary];
}

/** The two products, and a page of each side of the app beside the other. */
export const productPair = (t: Messages["home"]): ProductPairContent => {
  const { mock } = t.platforms;
  const { pages } = mock;
  const modes = { console: "PealAPI", studio: "PealStudio" };
  const [monday = "", tuesday = ""] = mock.days;
  const [publishingKey = "", analyticsKey = ""] = mock.keys;

  // What both pages' frames share: the account's avatar, the switch's
  // labels, Settings and the workspace.
  const frame = {
    account: mock.workspace.slice(0, 1),
    modes,
    settings: mock.settings,
    workspace: mock.workspace,
  };

  return {
    mocks: [
      {
        ...frame,
        content: {
          days: [
            {
              label: monday,
              posts: [
                {
                  chip: { state: "done", text: t.mock.published },
                  mark: markOfPlatform("mastodon"),
                  time: "09:00",
                },
                {
                  chip: { state: "done", text: t.mock.published },
                  mark: markOfPlatform("bluesky"),
                  time: "12:30",
                },
              ],
            },
            {
              label: tuesday,
              posts: [
                {
                  chip: { state: "pending", text: t.mock.scheduled },
                  mark: markOfPlatform("linkedin"),
                  time: "09:00",
                },
                {
                  chip: { state: "warning", text: t.mock.approval },
                  mark: markOfPlatform("instagram"),
                  time: "18:00",
                },
              ],
            },
          ],
          kind: "calendar",
        },
        groups: [
          {
            items: [
              { icon: "home", label: pages.home },
              { current: true, icon: "calendar", label: pages.calendar },
              { icon: "pen", label: pages.posts },
              { icon: "plug", label: pages.channels },
              { icon: "image", label: pages.media },
            ],
          },
          {
            items: [
              { icon: "inbox", label: pages.inbox },
              { icon: "chart", label: pages.analytics },
              { icon: "megaphone", label: pages.ads },
            ],
            label: mock.groups.engage,
          },
        ],
        mode: "studio",
        page: pages.calendar,
      },
      {
        ...frame,
        content: {
          cards: [
            {
              rows: [
                { label: publishingKey, value: "post:schedule" },
                { label: analyticsKey, value: "analytics:read" },
              ],
              title: mock.apiKeys,
            },
            {
              caption: "hooks.example.com",
              rows: [
                {
                  chip: { state: "done", text: "200" },
                  label: "post.published",
                  value: "09:00:03",
                },
                {
                  chip: { state: "done", text: "200" },
                  label: "post.finished",
                  value: "09:00:04",
                },
                {
                  chip: { state: "done", text: "200" },
                  label: "post.approved",
                  value: "08:41:10",
                },
              ],
              title: mock.deliveries,
            },
          ],
          kind: "cards",
        },
        groups: [
          { items: [{ icon: "globe", label: pages.platforms }] },
          {
            items: [
              { current: true, icon: "key", label: pages.apiKeys },
              { icon: "webhook", label: pages.webhooks },
            ],
            label: mock.groups.build,
          },
          {
            items: [{ icon: "handshake", label: pages.partner }],
            label: mock.groups.partners,
          },
        ],
        mode: "console",
        page: pages.apiKeys,
      },
    ],
    products: [
      { line: t.platforms.studio, name: "PealStudio" },
      { line: t.platforms.api, name: "PealAPI" },
    ],
  };
};

/** What PealStudio's bento shows: two large cards, then the tiles. */
export interface StudioBentoContent {
  readonly cards: readonly [BentoCard, BentoCard];
  readonly tiles: readonly BentoTile[];
}

/** PealStudio's bento: the composer and approvals, then four tiles. */
export const studioBento = (
  locale: Locale,
  t: Messages["home"],
  settings: HomeSettings
): StudioBentoContent => {
  const { cards, review, tiles } = t.studio;

  const previews: BentoPreview[] = mockPlatforms.map((platform) => ({
    ...measured(locale, t, platform, t.mock.longPost),
    mark: entryOf(platform).mark,
    name: entryOf(platform).name,
    text: t.mock.longPost,
  }));

  const tile = (
    icon: SiteIcon,
    content: { readonly label: string; readonly text: string },
    page: string
  ): BentoTile => ({ ...content, href: settings.docs(page), icon });

  return {
    cards: [
      {
        icon: "pen",
        illustration: { kind: "previews", previews },
        label: cards.composer.label,
        lead: cards.composer.lead,
        link: docsLink(settings, "guides/posts", cards.composer.link),
        text: cards.composer.text,
      },
      {
        icon: "check-check",
        illustration: {
          kind: "review",
          review: {
            approve: review.approve,
            comment: {
              badge: review.badge,
              initials: "SR",
              name: review.name,
              text: review.comment,
            },
            requestChanges: review.requestChanges,
            status: { state: "warning", text: t.mock.approval },
            text: t.mock.post,
            url: "app.peal.social/review",
          },
        },
        label: cards.approvals.label,
        lead: cards.approvals.lead,
        link: docsLink(settings, "guides/posts/review", cards.approvals.link),
        text: cards.approvals.text,
      },
    ],
    tiles: [
      tile("calendar", tiles.calendar, "guides/posts/schedule"),
      tile("inbox", tiles.inbox, "guides/engage/inbox"),
      tile("chart", tiles.analytics, "guides/engage/analytics"),
      tile("sparkles", tiles.assistant, "guides/posts/assistant"),
    ],
  };
};

/** The slots of PealAPI's rows that hold a code block. */
export type ApiCodeSlot =
  | "codeCli"
  | "codeMcp"
  | "codePublish"
  | "codeWebhooks";

/**
 * The code blocks of PealAPI's rows, by the slot each fills: the page
 * renders them, so the rows themselves stay static HTML.
 */
export const apiCode = (
  t: Messages["home"],
  code: HomeCode
): Readonly<Record<ApiCodeSlot, CodeBlockContent>> => {
  const block = {
    copied: t.api.copied,
    copy: t.api.copy,
    label: t.api.demoLabel,
  };

  return {
    codeCli: { ...block, samples: [code.cli] },
    codeMcp: { ...block, samples: [code.mcp] },
    codePublish: { ...block, samples: code.publish.samples },
    codeWebhooks: { ...block, samples: [code.webhook] },
  };
};

const codeDemo = (slot: ApiCodeSlot) => ({ kind: "code", slot }) as const;

/** PealAPI's rows: publishing, MCP, the command line, SDKs, webhooks, embedding. */
export const apiRows = (
  t: Messages["home"],
  settings: HomeSettings
): ProductRow[] => {
  const { connect, rows } = t.api;

  return [
    {
      demo: codeDemo("codePublish"),
      icon: "braces",
      link: docsLink(settings, "api-quickstart", rows.publish.link),
      text: rows.publish.text,
      title: rows.publish.title,
    },
    {
      demo: codeDemo("codeMcp"),
      icon: "bot",
      link: docsLink(settings, "developers/mcp", rows.mcp.link),
      text: rows.mcp.text,
      title: rows.mcp.title,
    },
    {
      demo: codeDemo("codeCli"),
      icon: "terminal",
      link: docsLink(settings, "developers/cli", rows.cli.link),
      text: rows.cli.text,
      title: rows.cli.title,
    },
    {
      demo: {
        kind: "tiles",
        tiles: sdks.map(({ folder, mark, name }) => ({
          href:
            settings.docs("developers/sdks#install") ??
            `${repository}/tree/main/packages/peal-sdk/${folder}`,
          mark,
          title: name,
        })),
      },
      icon: "package",
      link: docsLink(settings, "developers/sdks", rows.sdks.link),
      text: rows.sdks.text,
      title: rows.sdks.title,
    },
    {
      demo: codeDemo("codeWebhooks"),
      icon: "webhook",
      link: docsLink(settings, "developers/webhooks", rows.webhooks.link),
      text: rows.webhooks.text,
      title: rows.webhooks.title,
    },
    {
      demo: {
        connect: {
          asks: fill(connect.asks, { host: "app.example.com" }),
          heading: connect.heading,
          partner: { initials: "ES", name: connect.partner },
          rows: (["instagram", "linkedin", "mastodon"] as const).map(
            (platform, index) => ({
              action:
                index === 0
                  ? connect.connected
                  : fill(connect.connect, { platform: entryOf(platform).name }),
              connected: index === 0,
              mark: entryOf(platform).mark,
              name: entryOf(platform).name,
            })
          ),
          url: "app.peal.social/connect",
        },
        kind: "connect",
      },
      icon: "panels",
      link: docsLink(settings, "developers/embedding", rows.embedding.link),
      text: rows.embedding.text,
      title: rows.embedding.title,
    },
  ];
};

const textLimit = (platform: MockPlatform) =>
  platformRules[platform].textLimits[0]?.maximum ?? 0;

export const hardPartCells = (
  locale: Locale,
  t: Messages["home"]
): (FeatureCellContent & { readonly wide?: boolean })[] => {
  const { cells } = t.hardParts;
  const number = new Intl.NumberFormat(locale);
  // A text twelve characters over Bluesky's limit, measured on three networks.
  const length = textLimit("bluesky") + 12;

  const measuredLength = (platform: MockPlatform) => ({
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
          { label: "Bluesky", ...measuredLength("bluesky") },
          { label: "Mastodon", ...measuredLength("mastodon") },
          { label: "LinkedIn", ...measuredLength("linkedin") },
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

/** A product section's button, to its docs; left out without the docs. */
export const sectionAction = (
  settings: HomeSettings,
  page: string,
  label: string
) => docsLink(settings, page, label);

/** A call to action's two links, each left out without its setting. */
export interface CtaLinks {
  readonly primary: CtaLink | undefined;
  readonly secondary: CtaLink | undefined;
}

/** Get started (the app's sign-up) and Read the docs, for the hero and the closing band. */
export const ctaLinks = (
  labels: { readonly primary: string; readonly secondary: string },
  settings: Pick<HomeSettings, "app" | "docs">
): CtaLinks => {
  const signUp = settings.app("signup");
  const docs = settings.docs("");

  return {
    primary:
      signUp === undefined
        ? undefined
        : { href: signUp, label: labels.primary, measure: "get_started" },
    secondary:
      docs === undefined
        ? undefined
        : { href: docs, label: labels.secondary, measure: "docs" },
  };
};
