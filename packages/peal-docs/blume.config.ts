import { defineConfig } from "blume";
import { anthropic } from "blume/ai";
import { turnstile } from "blume/captcha";
import { node } from "blume/deploy";
import { memory } from "blume/ratelimit";
import { openapi } from "blume/reference";

import { platformVariables } from "./platform-variables.ts";
import { pricingVariables } from "./pricing-variables.ts";
import { retentionVariables } from "./retention-variables.ts";

// Values that differ per deployment come from the environment, so the same
// sources build anyone's copy of the docs. Each is optional: an unset or empty
// variable turns its feature off.
const fromEnvironment = (name: string): string | undefined => {
  const value = process.env[name]?.trim();

  return value === undefined || value === "" ? undefined : value;
};

// The public origin, such as https://docs.example.com. Blume needs it for
// absolute links in llms.txt and the agent skill, the sitemap and Open Graph
// images; without it the site still builds, with relative links.
const site = fromEnvironment("DOCS_SITE_URL");

// The assistant, a chat that answers from these pages, is on when a model is
// named, such as claude-haiku-5-5. It needs a server route, so the docs then
// build as a Node server rather than static files; the key is read when a
// question comes, from DOCS_ANTHROPIC_API_KEY, and never written into the
// build. Behind the proxy that answers for DOCS_SITE_URL, the rate limit
// counts each reader by the X-Forwarded-For that proxy sets.
const assistantModel = fromEnvironment("DOCS_ASSISTANT_MODEL");

// Turnstile asks a reader's browser, before a question, whether it is a
// script; the route checks the answer with TURNSTILE_SECRET_KEY.
const turnstileSiteKey = fromEnvironment("DOCS_TURNSTILE_SITE_KEY");

const deployment = () => {
  if (assistantModel === undefined) {
    return site === undefined ? {} : { site };
  }

  return node(
    site === undefined
      ? {}
      : { allowedDomains: [{ hostname: new URL(site).hostname }], site }
  );
};

const assistant = () => {
  if (assistantModel === undefined) {
    return { enabled: false };
  }

  const settings = {
    enabled: true,
    instructions:
      "You are Peal's documentation assistant. Peal is a social media scheduling platform. Answer in the language of the question, in a few short paragraphs or a list, with the exact names the app and the API use. Name no other product or company. When the pages do not cover something, say so and point to the closest page.",
    provider: anthropic({
      apiKeyEnv: "DOCS_ANTHROPIC_API_KEY",
      model: assistantModel,
      // The pages carry the answer: little thinking, a quicker reply.
      reasoning: "low",
    }),
    suggestions: [
      { icon: "cable", label: "How do I connect an Instagram account?" },
      { icon: "calendar-days", label: "How do I schedule a post?" },
      { icon: "code-xml", label: "How do I publish a post with the API?" },
      { icon: "server", label: "What does a self-hosted Peal need?" },
    ],
  };

  return turnstileSiteKey === undefined
    ? settings
    : { ...settings, captcha: turnstile({ siteKey: turnstileSiteKey }) };
};

// The pages' addresses before the tabs (old, new), so links already out
// there still land, in both languages; the browser keeps the #anchor.
const moved: [string, string][] = [
  ["/channels", "/guides/channels"],
  ["/scheduling", "/guides/posts"],
  ["/organise", "/guides/posts/organise"],
  ["/review", "/guides/posts/review"],
  ["/media", "/guides/media"],
  ["/notifications", "/guides/workspace/notifications"],
  ["/inbox", "/guides/engage/inbox"],
  ["/analytics", "/guides/engage/analytics"],
  ["/ads", "/guides/engage/ads"],
  ["/settings", "/guides/workspace"],
  ["/billing", "/guides/workspace/billing"],
  ["/api-overview", "/developers"],
  ["/api-conventions", "/developers/conventions"],
  ["/posting-api", "/developers/posting"],
  ["/sdks", "/developers/sdks"],
  ["/webhooks", "/developers/webhooks"],
  ["/cli", "/developers/cli"],
  ["/mcp", "/developers/mcp"],
  ["/agents", "/developers/agents"],
  ["/embedding", "/developers/embedding"],
  ["/environment-variables", "/self-hosting/environment-variables"],
  ["/staff", "/self-hosting/staff"],
  [
    "/deployment",
    "https://github.com/peal-social/peal/blob/main/packages/peal-infra/DEPLOYMENT.md",
  ],
];

// The API reference's sections before the API named each group by its
// namespace (the old section and its pages' prefix, then the new ones). A
// page there moved to the one with the same ending: /reference/tags/tags-list
// is /reference/posts/posts-tags-list.
const movedReferenceSections: [string, string][] = [
  ["account/account", "me/me-account"],
  ["notices/notices", "me/me-notices"],
  [
    "notification-preferences/notification-preferences",
    "me/me-notification-preferences",
  ],
  ["browser-analytics/browser-analytics", "me/me-browser-analytics"],
  ["connected-apps/connected-apps", "me/me-connected-apps"],
  ["api-keys/api-keys", "workspace/workspace-api-keys"],
  ["workspaces/workspaces", "workspace/workspace"],
  ["members/members", "workspace/workspace-members"],
  ["invitations/invitations", "workspace/workspace-invitations"],
  ["billing/billing", "workspace/workspace-billing"],
  ["billing-actions/billing-actions", "workspace/workspace-billing-actions"],
  ["usage/usage", "workspace/workspace-usage"],
  ["activity/activity", "workspace/workspace-activity"],
  ["video-generations/video-generations", "media/media-videos"],
  ["slideshows/slideshows", "media/media-slideshows"],
  ["capabilities/capabilities", "channels/channels-capabilities"],
  ["lookups/lookups", "channels/channels-lookups"],
  ["connect-links/connect-links", "channels/channels-connect-links"],
  ["channel-sets/channel-sets", "channels/channels-sets"],
  ["channel-defaults/channel-defaults", "channels/channels-default-options"],
  ["tags/tags", "posts/posts-tags"],
  ["signatures/signatures", "posts/posts-signatures"],
  ["review/review", "approvals/approvals"],
  ["inbox-messages/inbox-messages", "inbox/inbox-messages"],
  ["queues/queues", "automations/automations-queues"],
  ["recycling/recycling", "automations/automations-recycling"],
  ["follow-ups/follow-ups", "automations/automations-follow-ups"],
  ["feeds/feeds", "automations/automations-feeds"],
  ["short-links/short-links", "links/links"],
  ["partner-account/partner-account", "partner/partner-account"],
];

// The reference's pages whose ending changed too, in those sections or in
// sections of one page. An exact redirect wins over a section's pattern.
const movedReferencePages: [string, string][] = [
  ["session/session-me", "me/me-get"],
  ["tiktok/tiktok-creator", "channels/channels-tiktok-creator-get"],
  ["partner-usage/partner-usage-get", "partner/partner-customer-usage-get"],
  ["capabilities/capabilities-channel", "channels/channels-capabilities-get"],
  ["review/review-pending", "approvals/approvals-list"],
  ["review/review-thread", "approvals/approvals-get"],
  ["review/review-links", "approvals/approvals-list-links"],
  ["inbox-messages/inbox-messages-send-message", "inbox/inbox-messages-send"],
  [
    "inbox-messages/inbox-messages-get-message-settings",
    "inbox/inbox-messages-get-settings",
  ],
  [
    "inbox-messages/inbox-messages-set-channel-messages",
    "inbox/inbox-messages-set-channel",
  ],
  [
    "inbox-messages/inbox-messages-set-message-application",
    "inbox/inbox-messages-set-application",
  ],
  [
    "inbox-messages/inbox-messages-confirm-message",
    "inbox/inbox-messages-confirm",
  ],
];

const redirects = [
  ...moved,
  ...movedReferencePages.map(([from, to]): [string, string] => [
    `/reference/${from}`,
    `/reference/${to}`,
  ]),
  ...movedReferenceSections.map(([from, to]): [string, string] => [
    `/reference/${from}-*`,
    `/reference/${to}-*`,
  ]),
].flatMap(([from, to]) => [
  { from, to },
  { from: `/fr${from}`, to: to.startsWith("/") ? `/fr${to}` : to },
]);

export default defineConfig({
  agents: {
    llmsTxt: {
      details:
        "Peal is a fair-source social media scheduling platform: teams write a post once, schedule it across platforms and see how it performs. It can be self-hosted with Postgres and an S3-compatible store. The API reference lists every HTTP endpoint.",
      enabled: true,
    },
  },
  ai: { assistant: assistant() },
  deployment: deployment(),
  description:
    "Schedule social media posts across platforms, from one place. Guides, self-hosting and the HTTP API reference.",
  // The public repository, which the footer links to, and each page's
  // "Edit this page" link (dir is where the docs sit in it).
  github: { dir: "packages/peal-docs", owner: "peal-social", repo: "peal" },
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "fr", label: "Français" },
    ],
  },
  // The mark shows beside the title. Blume finds the favicon and the Apple
  // touch icon in public/ by their file names.
  logo: "/favicon.svg",
  // The assistant's route is the one the docs serve that a reader can
  // call (the playground is off, search is a static index): ten questions
  // each ten minutes, a third of Blume's default, as each one is a paid
  // model call. A reader is an IPv4 address or an IPv6 /64, which the
  // docs image's serve.ts writes into X-Forwarded-For. The count is the
  // server's own memory, exact as the image runs one process.
  rateLimit: memory({ requests: 10, window: 600 }),
  // One tab per reader, each a folder of docs/ (DESIGN.md, Docs): the
  // loose pages at the root are Get started.
  navigation: {
    // A section with pages of its own drills down, as the app's sidebar
    // does: its pages replace the list, under a link back.
    sidebar: { display: "page" },
    tabs: [
      {
        label: { en: "Get started", fr: "Démarrer" },
        path: "/",
        icon: "house",
      },
      {
        label: { en: "Guides", fr: "Guides" },
        path: "/guides",
        icon: "square-pen",
      },
      {
        label: { en: "Platforms", fr: "Plateformes" },
        path: "/platforms",
        icon: "layout-grid",
      },
      {
        label: { en: "Developers", fr: "Développeurs" },
        path: "/developers",
        icon: "code-xml",
      },
      {
        label: { en: "API reference", fr: "Référence de l’API" },
        path: "/reference",
        icon: "braces",
      },
      {
        label: { en: "Self-hosting", fr: "Auto-hébergement" },
        path: "/self-hosting",
        icon: "server",
      },
    ],
  },
  redirects,
  // Blume's search tells the page what readers look for (`blume:track`),
  // which the docs' measurement counts. Never the query's text: its length
  // alone, here as a second guard after the measurement's own allowlist.
  search: { analytics: { queries: false } },
  reference: [
    // Written by `nx run peal-contract:openapi`, which every docs target
    // depends on, so the reference always matches the contract. The overlay
    // adds the placeholder origin. Try it stays off: the origin is not a real
    // server, and the API answers no cross-origin requests from the docs.
    openapi({
      overlays: ["./overlays/public.yaml"],
      playground: false,
      spec: "../peal-contract/openapi.json",
    }),
  ],
  // Light only, in the mark's blue and Geist, as DESIGN.md has it: no
  // toggle, and no reader's earlier choice of dark.
  theme: {
    accent: "#415EEE",
    fonts: { body: "geist", display: "geist", mono: "geist-mono" },
    mode: "light",
    toggle: false,
  },
  title: "Peal",
  // The plans' prices and limits, from the contract's catalogue, and the
  // retention periods, from its registry of what Peal does with data.
  variables: {
    ...platformVariables,
    ...pricingVariables,
    ...retentionVariables,
  },
});
