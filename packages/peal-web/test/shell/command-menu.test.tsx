import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import type { Permission } from "peal-contract";
import { registrationsOf } from "peal-ui/hooks/use-key-map";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandMenuView } from "#components/shell/command-menu-view.tsx";
import type { MenuLink } from "#components/shell/command-menu-view.tsx";
import { loadMessages } from "#i18n/messages.ts";
import { goKeys, newPostKey } from "#shell/keys.ts";
import { pageLinksOf } from "#shell/navigation.ts";

const workspaceId = "00000000-0000-7000-8000-0000000000a1";
const workspace = "synthetic-studio";

const PlainLink: MenuLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

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

describe(pageLinksOf, () => {
  it("lists PealStudio's pages, its sections' and then PealAPI's, once each", () => {
    const pages = pageLinksOf({ permissions: owner, workspace }).map(
      ({ page }) => page
    );

    expect(pages.slice(0, 3)).toStrictEqual(["home", "calendar", "posts"]);
    expect(pages.at(-1)).toBe("partner");
    expect(new Set(pages).size).toBe(pages.length);
  });

  it("leaves out what the member's permissions do not open", () => {
    const pages = pageLinksOf({ permissions: [], workspace }).map(
      ({ page }) => page
    );

    expect(pages).toContain("calendar");
    expect(pages).not.toContain("inbox");
    expect(pages).not.toContain("apiKeys");
  });

  it("gives each page its address in the workspace", () => {
    const calendar = pageLinksOf({ permissions: [], workspace }).find(
      ({ page }) => page === "calendar"
    );

    expect(calendar?.href).toBe(`/${workspace}/calendar`);
  });
});

describe("the keys", () => {
  const listed = new Set<string>(
    pageLinksOf({ permissions: owner, workspace }).map(({ page }) => page)
  );

  it("give each page its own second key", () => {
    const keys = Object.values(goKeys);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("go only to pages the menu lists", () => {
    for (const page of Object.keys(goKeys)) {
      expect(listed.has(page)).toBeTruthy();
    }
  });

  it("bind without a clash between a sequence and a key alone", () => {
    const sequences = [
      newPostKey,
      ...Object.values(goKeys).map((key) => `g ${key}`),
    ];

    expect(() => registrationsOf(sequences)).not.toThrow();
  });
});

const render = async (locale: Locale) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
    >
      <CommandMenuView
        docsUrl={null}
        link={PlainLink}
        newPostHref={`/${workspaceId}/posts/new`}
        onOpenChange={() => {
          // The menu stays closed in these tests.
        }}
        open={false}
        pages={pageLinksOf({ permissions: owner, workspace })}
        postFilters={[]}
        request={{ command: null, count: 0 }}
        onShortcuts={() => {
          // The sheet stays closed in these tests.
        }}
        scope={null}
        supportUrl={null}
        workspaces={[]}
      />
    </NextIntlClientProvider>
  );

describe(CommandMenuView, () => {
  it("is a button that ⌘K or Ctrl+K presses too", async () => {
    const html = await render("en");

    expect(html).toContain('aria-label="Search or jump to…"');
    expect(html).toMatch(/aria-keyshortcuts="(?:Meta|Control)\+K"/u);
  });

  it("speaks French under /fr", async () => {
    await expect(render("fr")).resolves.toContain(
      'aria-label="Chercher ou aller à…"'
    );
  });
});
