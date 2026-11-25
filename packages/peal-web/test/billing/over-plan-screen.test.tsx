import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Standing } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { OverPlanScreen } from "#components/billing/over-plan-screen.tsx";
import { loadMessages } from "#i18n/messages.ts";

// A free billing account over its free accounts, without a payment method.
const standing: Standing = {
  graceUntil: null,
  mustReduce: true,
  over: [{ allowed: 2, limit: "channels", used: 3 }],
  plan: "free",
  planWithRoom: "payAsYouGo",
  scheduledPosts: 0,
};

// The server's render of the screen, which the browser's first render
// must match. The channels and the members are read with the visitor's
// cookies, which only the browser sends: read on the server, their query
// fails at once (no address to call), while the browser's first render
// sees it loading.
const serverRender = async (canManage: boolean) => {
  const messages = await loadMessages("en");

  return {
    html: renderToStaticMarkup(
      <RegistryProvider>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <OverPlanScreen
            contactUrl={null}
            self="ana"
            standing={standing}
            termsUrl={null}
            workspace={{
              canManage,
              id: "00000000-0000-4000-8000-000000000001",
              name: "Studio Nord",
            }}
          />
        </NextIntlClientProvider>
      </RegistryProvider>
    ),
    t: messages.OverPlan,
  };
};

describe(OverPlanScreen, () => {
  it("renders the loading state on the server for a member who manages billing, as the browser first does", async () => {
    const { html, t } = await serverRender(true);

    expect(html).not.toContain(t.loadFailed);
    expect(html).not.toContain(t.chooseTitle);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(t.loading);
  });

  it("renders the screen at once for a member who does not manage billing, which needs no query", async () => {
    const { html, t } = await serverRender(false);

    expect(html).not.toContain(t.loadFailed);
    expect(html).not.toContain("aria-busy");
    expect(html).toContain("Studio Nord holds more than the free tier allows");
    expect(html).toContain(t.othersUnknown);
    expect(html).not.toContain(t.chooseTitle);
  });
});
