import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { PersonalSidebarView } from "#components/shell/personal-shell.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const slug = "synthetic-workspace";

const PlainLink: LinkComponent = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

describe(PersonalSidebarView, () => {
  it("names a workspace's link by the workspace alone, not its initial", async () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={await loadMessages("en")}>
        <PersonalSidebarView
          current={null}
          link={PlainLink}
          workspaces={[
            {
              id: "00000000-0000-7000-8000-0000000000a1",
              name: "Synthetic workspace",
              slug,
            },
          ]}
        />
      </NextIntlClientProvider>
    );

    const link = new RegExp(
      `<a [^>]*href="/${slug}"[^>]*>(?<inner>.*?)</a>`,
      "su"
    ).exec(html)?.groups?.["inner"];

    expect(link).toMatch(/<span aria-hidden="true"[^>]*>S<\/span>/u);
  });
});
