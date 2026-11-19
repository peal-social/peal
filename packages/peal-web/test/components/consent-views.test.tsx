import { describe, expect, it } from "@effect/vitest";
import { constVoid } from "effect/Function";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ConsentCardView,
  ConsentSettingView,
} from "#components/measurement/consent-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (view: ReactNode, locale: "en" | "fr" = "en") => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {view}
    </NextIntlClientProvider>
  );
};

// Each button's class, which carries its variant and size.
const buttonClasses = (html: string): readonly string[] =>
  [...html.matchAll(/<button[^>]*class="(?<classes>[^"]*)"/gu)].map(
    (match) => match.groups?.["classes"] ?? ""
  );

describe(ConsentCardView, () => {
  it("offers both answers as buttons of the same variant and size", async () => {
    const html = await render(
      <ConsentCardView
        failed={false}
        onChoose={constVoid}
        pending={null}
        privacyUrl="https://peal.test/privacy"
      />
    );

    const [allow, refuse, ...others] = buttonClasses(html);

    expect(others).toStrictEqual([]);
    expect(refuse).toBe(allow);
    expect(html).toMatch(/>Allow<.*>Don’t allow</su);
    expect(html).toContain('href="https://peal.test/privacy"');
  });

  it("leaves the policy's link out where there is none", async () => {
    const html = await render(
      <ConsentCardView
        failed={false}
        onChoose={constVoid}
        pending={null}
        privacyUrl={null}
      />
    );

    expect(html).not.toContain("<a ");
  });

  it("holds both answers while one is saved, and says when it failed", async () => {
    const pending = await render(
      <ConsentCardView
        failed={false}
        onChoose={constVoid}
        pending="granted"
        privacyUrl={null}
      />
    );

    expect(pending.match(/aria-disabled="true"/gu)).toHaveLength(2);

    const failed = await render(
      <ConsentCardView
        failed
        onChoose={constVoid}
        pending={null}
        privacyUrl={null}
      />,
      "fr"
    );

    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Votre choix n’a pas pu être enregistré.");
  });
});

describe(ConsentSettingView, () => {
  const decidedAt = new Date("2026-11-18T10:00:00.000Z");

  it.each([
    ["granted", decidedAt, "Allowed on November 18, 2026."],
    ["refused", decidedAt, "Not allowed since November 18, 2026."],
    ["undecided", null, "Not chosen yet."],
  ] as const)("shows a choice %s", async (consent, at, text) => {
    const html = await render(
      <ConsentSettingView
        consent={consent}
        decidedAt={at}
        failed={false}
        onChoose={constVoid}
        pending={null}
      />
    );

    expect(html).toContain(text);

    const [allow, refuse] = buttonClasses(html);

    expect(refuse).toBe(allow);
  });
});
