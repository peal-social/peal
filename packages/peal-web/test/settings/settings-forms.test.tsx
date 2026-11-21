import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { ApprovalPolicyForm } from "#components/settings/approval-policy-form.tsx";
import { ShortLinkDefaultForm } from "#components/settings/short-link-default-form.tsx";
import { loadMessages } from "#i18n/messages.ts";

const workspaceId = "00000000-0000-4000-8000-000000000001";

const render = async (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      messages={await loadMessages("en")}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>
  );

// The server has no visitor's cookies: it renders what the browser's first
// render does, nothing, so hydration matches.
describe("the general settings' forms on the server", () => {
  it("leaves the approval policy to the browser", async () => {
    await expect(
      render(<ApprovalPolicyForm workspaceId={workspaceId} />)
    ).resolves.toBe("");
  });

  it("leaves the short link default to the browser", async () => {
    await expect(
      render(<ShortLinkDefaultForm mayChange workspaceId={workspaceId} />)
    ).resolves.toBe("");
  });
});
