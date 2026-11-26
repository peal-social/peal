// The header's mega menus as the server renders them: a preview card that
// follows the rows only repeats them, so screen readers skip it; the
// Platforms card is one fixed card, read like the rest of the menu, and it
// holds the menu's one link to compare every platform under its intro.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "../src/components/site-header.tsx";
import type { SiteHeaderProps } from "../src/components/site-header.tsx";

const props: SiteHeaderProps = {
  drawer: { close: "Close", open: "Open the menu", title: "Menu" },
  home: { href: "/", label: "Peal home page", name: "Peal" },
  items: [
    {
      feature: {
        caption: "",
        description: "Every page in one place.",
        href: "/resources",
        marks: [{ kind: "letters", letters: "Gh" }],
        title: "Star the repository",
      },
      groups: [
        {
          label: "Resources",
          links: [
            {
              href: "/docs",
              icon: "book-open",
              title: "Docs",
            },
          ],
        },
      ],
      kind: "menu",
      label: "Resources",
      preview: "rows",
      value: "resources",
    },
    {
      feature: {
        caption: "",
        description: "Write it once, adjust it where a platform needs to.",
        href: "/docs/platforms",
        illustration: "fan-out",
        title: "One post, every platform",
      },
      footer: { href: "/docs/platforms", label: "Compare every platform" },
      groups: [
        {
          label: "Social",
          links: [{ href: "/docs/platforms/bluesky", title: "Bluesky" }],
        },
      ],
      kind: "menu",
      label: "Platforms",
      preview: "menu",
      value: "platforms",
    },
  ],
  label: "Main",
};

const html = renderToString(createElement(SiteHeader, props));

// The desktop menu's cards, by their slot, from their opening tag.
const cards = [
  ...html.matchAll(/<div(?<attributes>[^>]*data-slot="menu-preview-card")/gu),
].map((match) => match.groups?.["attributes"] ?? "");

const platformsCard = html.slice(
  html.lastIndexOf('data-slot="menu-preview-card"')
);

describe("SiteHeader's preview cards", () => {
  it("hides a card that follows the rows from screen readers", () => {
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('aria-hidden="true"');
  });

  it("lets screen readers read the Platforms card, its art aside", () => {
    expect(cards[1]).not.toContain("aria-hidden");
    expect(platformsCard).toMatch(/<canvas[^>]*aria-hidden="true"/u);
  });

  it("links to the comparison under the Platforms card's intro", () => {
    const intro = platformsCard.indexOf("Write it once");

    const link = platformsCard.search(
      /<a[^>]*href="\/docs\/platforms"[^>]*>Compare every platform/u
    );

    expect(intro).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(intro);
  });

  it("no longer links to the comparison under the rows", () => {
    const desktop = html.slice(0, html.indexOf('data-slot="sheet'));

    const before = desktop.slice(
      0,
      desktop.lastIndexOf('data-slot="menu-preview-card"')
    );

    expect(before).not.toContain("Compare every platform");
  });
});
