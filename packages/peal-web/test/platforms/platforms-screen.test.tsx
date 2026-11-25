import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformsScreen } from "#components/platforms/platforms-screen.tsx";
import { loadMessages } from "#i18n/messages.ts";

// The server's render of the page, which the browser's first render must
// match: the capabilities and the channels are read with the visitor's
// cookies, which only the browser sends, so the server shows them loading.
// Read on the server, their query fails at once (no address to call), and
// the page rendered the failure the browser never shows at first.
describe(PlatformsScreen, () => {
  it("renders the loading state on the server, as the browser first does", async () => {
    const messages = await loadMessages("en");

    const html = renderToStaticMarkup(
      <RegistryProvider>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <PlatformsScreen workspaceId="00000000-0000-4000-8000-000000000001" />
        </NextIntlClientProvider>
      </RegistryProvider>
    );

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(messages.Platforms.loadFailed);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(messages.Platforms.loading);
  });
});
