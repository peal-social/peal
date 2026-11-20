import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { ModeSwitch } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const PlainLink: LinkComponent = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const render = async (locale: Locale) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ModeSwitch
        link={PlainLink}
        mode="studio"
        modes={{
          api: "/synthetic-workspace/platforms",
          studio: "/synthetic-workspace",
        }}
      />
    </NextIntlClientProvider>
  );
};

describe(ModeSwitch, () => {
  it.each(["en", "fr"] as const)(
    "names the open mode, untranslated, beside its switch (%s)",
    async (locale) => {
      const html = await render(locale);

      expect(html).toContain(">PealCreative</span>");
      expect(html).toMatch(/aria-label="[^"]*PealCreative[^"]*PealAPI[^"]*"/u);
    }
  );
});
