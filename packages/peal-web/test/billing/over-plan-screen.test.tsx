import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Standing } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { OverPlanScreen } from "#components/billing/over-plan-screen.tsx";
import { loadMessages } from "#i18n/messages.ts";

const workspaceId = "00000000-0000-4000-8000-000000000001";

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
const serverRender = async (canManage: boolean, of: Standing = standing) => {
  const messages = await loadMessages("en");

  return {
    html: renderToStaticMarkup(
      <RegistryProvider>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <OverPlanScreen
            contactUrl={null}
            self="ana"
            standing={of}
            termsUrl={null}
            workspace={{ canManage, id: workspaceId, name: "Studio Nord" }}
          />
        </NextIntlClientProvider>
      </RegistryProvider>
    ),
    messages,
    t: messages.OverPlan,
  };
};

describe(OverPlanScreen, () => {
  it("renders on the server the title, the explanation and the offer for a member who manages billing, and the channels loading, as the browser first does", async () => {
    const { html, messages, t } = await serverRender(true);

    expect(
      [
        "Studio Nord holds more than the free tier allows",
        "Its billing account holds more than 2 connected accounts without a payment method.",
        "3 channels connected, 2 allowed",
        t.upgradeTitle,
        messages.Billing.payment.order,
        t.chooseTitle,
        'aria-busy="true"',
        t.loadingChannels,
      ].filter((piece) => !html.includes(piece))
    ).toStrictEqual([]);
    expect(
      [t.channelsFailed, t.membersFailed, 'role="alert"'].filter((piece) =>
        html.includes(piece)
      )
    ).toStrictEqual([]);
  });

  it("names on the server the workspace that bills the account, from the standing the server read, rather than offering to order", async () => {
    const { html, messages } = await serverRender(true, {
      ...standing,
      account: {
        billingWorkspaceId: "0190f3a0-0000-7000-8000-00000000b002",
        billingWorkspaceName: "Studio Sud",
        id: "0190f3a0-0000-7000-8000-00000000b001",
        otherWorkspaces: [],
        partner: false,
        payer: false,
        transfer: null,
        workspaces: 2,
      },
    });

    expect(html).toContain("The billing account of Studio Nord is billed on");
    expect(html).toContain("Studio Sud");
    expect(html).not.toContain(messages.Billing.payment.order);
  });

  it("renders the screen at once for a member who does not manage billing, which needs no query", async () => {
    const { html, t } = await serverRender(false);

    expect(html).not.toContain(t.channelsFailed);
    expect(html).not.toContain("aria-busy");
    expect(html).toContain("Studio Nord holds more than the free tier allows");
    expect(html).toContain(t.othersUnknown);
    expect(html).not.toContain(t.chooseTitle);
  });
});
