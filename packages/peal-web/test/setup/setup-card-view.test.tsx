import { describe, expect, it } from "@effect/vitest";
import { constVoid } from "effect/Function";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { recorded, runOf } from "#channels/connect-run.ts";
import { SetupCardView } from "#components/setup/setup-card-view.tsx";
import type { SetupCardState } from "#components/setup/setup-card-view.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { setupOptionsOf } from "#home/setup.ts";
import { loadMessages } from "#i18n/messages.ts";

const PlainLink: LinkComponent = ({ children, className, href }) => (
  <a className={className} href={href}>
    {children}
  </a>
);

const options = setupOptionsOf(
  {
    instagramConnections: ["facebookLogin"],
    linkedinConnections: ["linkedinProfile", "linkedinPage"],
    platforms: ["x", "linkedin", "mastodon", "youtube"],
  },
  []
);

const choose = (
  overrides: Partial<Extract<SetupCardState, { _tag: "choose" }>> = {}
): SetupCardState => ({
  _tag: "choose",
  cost: null,
  onConnect: constVoid,
  onDismiss: constVoid,
  onToggle: constVoid,
  onType: constVoid,
  options,
  ready: false,
  ticked: [],
  typed: {},
  xClosed: false,
  ...overrides,
});

const render = async (locale: "en" | "fr", state: SetupCardState) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      <SetupCardView
        homeHref="/studio"
        isPending={false}
        link={PlainLink}
        newChannelHref="/studio/channels/new"
        state={state}
        writePostHref="/studio/posts/new"
      />
    </NextIntlClientProvider>
  );

const run = runOf("workspace-1", [
  { instance: "mastodon.social", platform: "mastodon" },
  { connection: "linkedinPage", platform: "linkedin" },
  { platform: "youtube" },
]);

describe(SetupCardView, () => {
  it("lists the platforms, nothing ticked, and links New channel", async () => {
    const html = await render("en", choose());

    expect(html).toContain("Set up your channels");
    expect(html).toContain("LinkedIn profile");
    expect(html).toContain("LinkedIn pages");
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain('href="/studio/channels/new"');
  });

  it("offers Skip for now beside Connect", async () => {
    await expect(render("en", choose())).resolves.toContain("Skip for now");
  });

  it("asks to check the account each platform names", async () => {
    await expect(render("en", choose())).resolves.toContain(
      "check it’s the right one"
    );
  });

  it("asks Mastodon's server once it is ticked", async () => {
    const html = await render(
      "en",
      choose({ ready: false, ticked: ["mastodon"] })
    );

    expect(html).toContain("Your Mastodon server");
    expect(html).toContain("Connect 1 platform");
  });

  it("closes X without a payment method, saying why", async () => {
    const html = await render("en", choose({ xClosed: true }));

    expect(html).toContain("Needs a payment method on the billing page.");
  });

  it("says the cost from the rate card", async () => {
    const free = await render(
      "en",
      choose({ cost: { _tag: "free", free: 2 }, ticked: ["x", "youtube"] })
    );

    const adds = await render(
      "en",
      choose({
        cost: { _tag: "adds", price: { excluded: 800, included: 960 } },
        ticked: ["x", "youtube"],
      })
    );

    expect(free).toContain("Your first 2 accounts are free.");
    expect(adds).toContain("$8.00 a month excl. VAT");
    expect(adds).toContain("$9.60 with France’s 20% VAT");
  });

  it("shows a run stopped on a failure, and offers the next platform", async () => {
    const stopped = recorded(
      recorded(run, "mastodon", { _tag: "connected", handles: ["@peal"] }),
      "linkedin",
      { _tag: "failed", error: "denied" }
    );

    const html = await render("en", {
      _tag: "running",
      next: { platform: "youtube" },
      onContinue: constVoid,
      onSkip: constVoid,
      onStop: constVoid,
      run: stopped,
    });

    expect(html).toContain("Connected: @peal");
    expect(html).toContain("Continue with YouTube");
    expect(html).toContain("Skip YouTube");
  });

  it("sums the run up once it is done", async () => {
    const html = await render("en", {
      _tag: "done",
      connected: 3,
      failed: 1,
      onStartOver: constVoid,
      run,
    });

    expect(html).toContain("3 accounts connected");
    expect(html).toContain("Disconnect it from Channels");
    expect(html).toContain('href="/studio/posts/new"');
    expect(html).toContain('href="/studio"');
  });

  it("offers to start over or go on when nothing connected", async () => {
    const html = await render("en", {
      _tag: "done",
      connected: 0,
      failed: 2,
      onStartOver: constVoid,
      run,
    });

    expect(html).toContain("Start over");
    expect(html).not.toContain("Disconnect it from Channels");
  });

  it("speaks French", async () => {
    const html = await render("fr", choose({ ticked: ["mastodon"] }));

    expect(html).toContain("Configurez vos canaux");
    expect(html).toContain("Votre serveur Mastodon");
    expect(html).toContain("Passer pour l’instant");
  });
});
