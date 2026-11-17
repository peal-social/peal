import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { SidebarView } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";
import { navigationOf } from "#shell/navigation.ts";

const workspaceId = "00000000-0000-7000-8000-0000000000a1";

const PlainLink: LinkComponent = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const render = async (locale: Locale) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SidebarView
        link={PlainLink}
        navigation={navigationOf({
          pathname: `/app/${workspaceId}/calendar`,
          permissions: ["channel:read", "apiKey:read"],
          workspaceId,
        })}
        workspaceId={workspaceId}
        workspaces={[{ id: workspaceId, name: "Synthetic workspace" }]}
      />
    </NextIntlClientProvider>
  );
};

// What each link of the mode switch reads, in order.
const modeNames = (html: string) => {
  const nav = /<nav aria-label="Mode"[^>]*>(?<inner>.*?)<\/nav>/su.exec(html)
    ?.groups?.["inner"];

  return [...(nav ?? "").matchAll(/<\/svg>(?<name>[^<]+)</gu)].map(
    (match) => match.groups?.["name"] ?? ""
  );
};

describe(SidebarView, () => {
  it.each(["en", "fr"] as const)(
    "names the two sides PealStudio and PealAPI, untranslated (%s)",
    async (locale) => {
      expect(modeNames(await render(locale))).toStrictEqual([
        "PealStudio",
        "PealAPI",
      ]);
    }
  );
});
