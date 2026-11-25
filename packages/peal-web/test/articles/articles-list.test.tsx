import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticlesList } from "#components/articles/articles-list.tsx";
import { loadMessages } from "#i18n/messages.ts";

// The server's render of the page, which the browser's first render must
// match: the articles and the websites are read with the visitor's
// cookies, which only the browser sends, so the server shows them loading.
// Read on the server, the articles' query fails at once (no address to
// call), and the page rendered the failure the browser never shows at
// first.
describe(ArticlesList, () => {
  it("renders the loading state on the server, as the browser first does", async () => {
    const messages = await loadMessages("en");

    const html = renderToStaticMarkup(
      <RegistryProvider>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <ArticlesList
            canCreate
            workspaceId="00000000-0000-4000-8000-000000000001"
          />
        </NextIntlClientProvider>
      </RegistryProvider>
    );

    expect(html).not.toContain(messages.Articles.list.loadFailed);
    expect(html).toContain("aria-busy");
    expect(html).toContain(messages.Articles.list.loading);
  });
});
