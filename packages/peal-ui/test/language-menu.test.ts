// The language menu as the server renders it: a trigger named by the page,
// and, for a reader without JavaScript and for crawlers, every language as a
// link in the HTML, the current one marked.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LanguageMenu } from "../src/components/language-menu.tsx";

const html = renderToString(
  createElement(LanguageMenu, {
    label: "Langue",
    links: [
      { href: "/", hrefLang: "en", label: "English", lang: "en" },
      {
        current: true,
        href: "/fr",
        hrefLang: "fr",
        label: "Français",
        lang: "fr",
      },
    ],
  })
);

describe("LanguageMenu", () => {
  it("names its trigger after the page's word for language and the current one", () => {
    expect(html).toMatch(
      /<button[^>]*aria-label="Langue, Français"[^>]*aria-haspopup="menu"/u
    );
  });

  it("puts every language's link in the HTML for a reader without JavaScript", () => {
    expect(html).toContain("<noscript>");
    expect(html).toMatch(
      /<a href="\/" hrefLang="en" lang="en"[^>]*>English<\/a>/u
    );
    expect(html).toMatch(
      /<a href="\/fr" hrefLang="fr" lang="fr" aria-current="page"[^>]*>Français<\/a>/u
    );
  });
});
