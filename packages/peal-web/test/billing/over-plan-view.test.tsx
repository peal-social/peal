import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type { BillingAccount, Standing } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { OverPlanView } from "#components/billing/over-plan-view.tsx";
import type { OverPlanViewProps } from "#components/billing/over-plan-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const nothing = () => {
  // Rendered once: nothing is clicked.
};

const account: BillingAccount = {
  billingWorkspaceId: "studio",
  billingWorkspaceName: "Studio Nord",
  id: "0190f3a0-0000-7000-8000-00000000b001",
  otherWorkspaces: [],
  partner: false,
  payer: true,
  transfer: null,
  workspaces: 1,
};

const standing: Standing = {
  account,
  graceUntil: null,
  mustReduce: true,
  over: [
    { allowed: 3, limit: "channels", used: 4 },
    { allowed: 2, limit: "members", used: 3 },
    { allowed: 500_000_000, limit: "mediaStorage", used: 900_000_000 },
  ],
  plan: "starter",
  planWithRoom: "payAsYouGo",
  scheduledPosts: 7,
};

const channels = ["one", "two", "three", "four"].map((handle) => ({
  id: handle,
  name: `@${handle}@social.example`,
  platform: "mastodon",
}));

const members = [
  { name: "Ana Example", role: "owner", userId: "ana" },
  { name: "Sam Example", role: "admin", userId: "sam" },
  { name: "Lee Example", role: "viewer", userId: "lee" },
];

const render = async (
  locale: "en" | "fr",
  props: Partial<OverPlanViewProps> = {}
) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <OverPlanView
        applying={false}
        // The app links through next-intl's Link, which needs Next to run.
        billingLink={<span>Open billing</span>}
        canManage
        channels={channels}
        channelsLoad="ready"
        confirmed={false}
        error={null}
        keptChannels={["one", "two", "three"]}
        keptMembers={["ana", "sam"]}
        managers={["Ana Example", "Sam Example"]}
        members={members}
        membersLoad="ready"
        self="ana"
        standing={standing}
        upgrade={<p>The upgrade offer</p>}
        workspaceName="Studio Nord"
        onApply={nothing}
        onConfirm={nothing}
        onKeepChannel={nothing}
        onKeepMember={nothing}
        onRetryChannels={nothing}
        onRetryMembers={nothing}
        {...props}
      />
    </NextIntlClientProvider>
  );
};

describe(OverPlanView, () => {
  it("names the account's other workspaces, which count their channels with this one", async () => {
    const shared = {
      ...standing,
      account: {
        ...account,
        otherWorkspaces: [{ name: "Studio Sud", workspaceId: "south" }],
        workspaces: 3,
      },
    };

    await expect(render("en", { standing: shared })).resolves.toContain(
      "Its channels count with those of the other workspaces of its billing account: Studio Sud."
    );
    await expect(render("fr", { standing: shared })).resolves.toContain(
      "Ses canaux comptent avec ceux des autres espaces de travail de son compte de facturation : Studio Sud."
    );
    await expect(render("en")).resolves.not.toContain("billing account");
  });

  it("says what the workspace holds beyond its plan, and that nothing was deleted", async () => {
    const html = await render("en");

    expect(html).toContain("Studio Nord holds more than its plan allows");
    expect(html).toContain("Its plan is now Starter. Nothing was deleted");
    expect(html).toContain("4 channels connected, 3 allowed");
    expect(html).toContain("3 members, 2 allowed");
    expect(html).toContain("900 MB of media stored, 500 MB allowed");
  });

  it("says a free billing account holds more than its free accounts without a payment method", async () => {
    const free: Standing = {
      ...standing,
      over: [{ allowed: 2, limit: "channels", used: 3 }],
      plan: "free",
    };

    const english = await render("en", { standing: free });

    expect(english).toContain(
      "Studio Nord holds more than the free tier allows"
    );
    expect(english).toContain(
      "Its billing account holds more than 2 connected accounts without a payment method. Nothing was deleted, but nothing is scheduled or published until a payment method is added or 2 accounts are kept."
    );
    expect(english).toContain("3 channels connected, 2 allowed");
    expect(english).toContain("Add a payment method");

    await expect(render("fr", { standing: free })).resolves.toContain(
      "Son compte de facturation a plus de 2 comptes connectés sans moyen de paiement."
    );
  });

  it("says when staff took the free tier away, never that 2 accounts are free", async () => {
    const html = await render("en", {
      standing: {
        ...standing,
        over: [{ allowed: 0, limit: "channels", used: 1 }],
        plan: "free",
      },
    });

    expect(html).toContain(
      "Its billing account connects no account without a payment method."
    );
    expect(html).not.toContain("more than 2");
  });

  it("says what happens to the posts already scheduled", async () => {
    const html = await render("en");

    expect(html).toContain(
      "The 7 posts scheduled this month each fail at their time, with “plan limit” as their reason; they keep their text and channels, and can be posted again from their page once the workspace is within its plan."
    );
  });

  it("offers the upgrade first, then choosing what stays", async () => {
    const html = await render("en");

    expect(html.indexOf("The upgrade offer")).toBeGreaterThan(-1);
    expect(html.indexOf("Or choose what stays")).toBeGreaterThan(
      html.indexOf("The upgrade offer")
    );
    expect(html).toContain("Channels that stay connected (3 of 3)");
    expect(html).toContain("Members who stay (2 of 2)");
  });

  it("asks to confirm what is removed, for good, before it removes anything", async () => {
    const html = await render("en");

    expect(html).toContain(
      "I understand that 1 channel is disconnected and 1 member is removed, for good."
    );
    expect(html).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>Keep these, remove the rest/u
    );
    expect(html).toContain("the platforms that allow it are asked to forget");
  });

  it("refuses a choice that keeps more than the plan allows", async () => {
    const html = await render("en", {
      confirmed: true,
      keptChannels: ["one", "two", "three", "four"],
    });

    expect(html).toContain("Keep at most what the plan allows.");
    expect(html).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>Keep these, remove the rest/u
    );
  });

  it("tells the other members who can fix it, in their language", async () => {
    const html = await render("fr", { canManage: false });

    expect(html).toContain(
      "Les propriétaires et les administrateurs de Studio Nord peuvent ajouter un moyen de paiement ou choisir ce qui reste : Ana Example, Sam Example."
    );
    expect(html).not.toContain("Garder ceux-ci");
    expect(html).not.toContain("The upgrade offer");
  });
});

// How often a piece of markup appears in the page.
const countOf = (html: string, piece: string) => html.split(piece).length - 1;

// The pieces the page lacks, and those it holds.
const missingFrom = (html: string, pieces: readonly string[]) =>
  pieces.filter((piece) => !html.includes(piece));

const foundIn = (html: string, pieces: readonly string[]) =>
  pieces.filter((piece) => html.includes(piece));

// The screen's title and explanation, in each language.
const heading = {
  en: "Studio Nord holds more than its plan allows",
  fr: "Studio Nord dépasse ce que permet son abonnement",
};

// The button that removes what is not kept, while it cannot be pressed.
const applyDisabled = (apply: string) =>
  new RegExp(`<button[^>]*aria-disabled="true"[^>]*>${apply}`, "u");

// While the browser reads the channels and the members, or could not: the
// rest of the screen shows at once, from the standing the server read.
describe("OverPlanView's lists", () => {
  it.each(["en", "fr"] as const)(
    "shows in %s the title, the explanation and the offer at once, each list loading in rows of its own",
    async (locale) => {
      const messages = await loadMessages(locale);
      const t = messages.OverPlan;

      const html = await render(locale, {
        channels: [],
        channelsLoad: "loading",
        members: [],
        membersLoad: "loading",
      });

      expect(
        missingFrom(html, [
          heading[locale],
          "The upgrade offer",
          t.chooseTitle,
          t.channelsNote,
          t.membersNote,
          t.loadingChannels,
          t.loadingMembers,
        ])
      ).toStrictEqual([]);
      expect(countOf(html, 'aria-busy="true"')).toBe(2);
      // A row for each of the 4 channels and 3 members the standing
      // counts, and one for the confirmation, each a box and a label.
      expect(countOf(html, 'data-slot="skeleton"')).toBe(2 * (4 + 3 + 1));
      expect(
        foundIn(html, [t.channelsFailed, t.membersFailed, 'role="alert"'])
      ).toStrictEqual([]);
      expect(html).toMatch(applyDisabled(t.apply));
    }
  );

  it("never draws more than ten rows for a list still loading", async () => {
    const html = await render("en", {
      channels: [],
      channelsLoad: "loading",
      standing: {
        ...standing,
        over: [{ allowed: 2, limit: "channels", used: 40 }],
      },
    });

    expect(countOf(html, 'data-slot="skeleton"')).toBe(2 * (10 + 1));
  });

  it("says the channels could not be read, with a way to read them again, and shows the members", async () => {
    const messages = await loadMessages("en");
    const t = messages.OverPlan;
    const html = await render("en", { channels: [], channelsLoad: "failed" });

    expect(
      missingFrom(html, [
        'role="alert"',
        t.channelsFailed,
        "Sam Example (admin)",
      ])
    ).toStrictEqual([]);
    expect(html).toMatch(new RegExp(`<button[^>]*>${t.retry}</button>`, "u"));
    expect(
      foundIn(html, [t.membersFailed, "aria-busy", "I understand"])
    ).toStrictEqual([]);
    expect(html).toMatch(applyDisabled(t.apply));
  });

  it("says in French the members could not be read, and shows the channels", async () => {
    const messages = await loadMessages("fr");
    const t = messages.OverPlan;
    const html = await render("fr", { members: [], membersLoad: "failed" });

    expect(
      missingFrom(html, [t.membersFailed, "@four@social.example"])
    ).toStrictEqual([]);
    expect(html).toMatch(new RegExp(`<button[^>]*>${t.retry}</button>`, "u"));
    expect(html).not.toContain(t.channelsFailed);
  });

  it("keeps the confirmation for once both lists are read", async () => {
    const html = await render("en", {
      confirmed: true,
      members: [],
      membersLoad: "loading",
    });

    expect(html).not.toContain("I understand");
    expect(html).toMatch(applyDisabled("Keep these, remove the rest"));
  });
});
