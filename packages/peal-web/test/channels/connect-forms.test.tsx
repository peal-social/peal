import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type {
  ChatPlatform,
  InstagramConnection,
  LinkedInConnection,
  Platform,
  SitePlatform,
} from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { ConnectForms } from "#components/channels/connect-forms.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (
  locale: "en" | "fr",
  platforms: readonly Platform[],
  instagramConnections: readonly InstagramConnection[] = [],
  linkedinConnections: readonly LinkedInConnection[] = [],
  sites: readonly SitePlatform[] = [],
  chats: readonly ChatPlatform[] = [],
  docsUrl: string | null = "https://docs.peal.social"
) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <RegistryProvider>
        <ConnectForms
          chats={chats}
          docsUrl={docsUrl}
          instagramConnections={instagramConnections}
          linkedinConnections={linkedinConnections}
          platforms={platforms}
          sites={sites}
          workspaceId="5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"
        />
      </RegistryProvider>
    </NextIntlClientProvider>
  );
};

describe(ConnectForms, () => {
  it("offers no chat the server does not name", async () => {
    const without = await render("en", ["mastodon"]);

    expect(without).not.toContain("Connect Discord");
    expect(without).not.toContain("Connect Telegram");
  });

  it("offers the chats the server connects, each with its secret in a password field", async () => {
    const html = await render(
      "en",
      ["mastodon"],
      [],
      [],
      [],
      ["discord", "telegram"]
    );

    for (const shown of [
      ">Connect Discord<",
      ">Connect Telegram<",
      "Integrations",
      "@BotFather",
      'href="https://docs.peal.social/platforms/discord"',
    ]) {
      expect(html).toContain(shown);
    }
  });

  it("types a chat's secret unseen, and offers the chats in French too", async () => {
    const html = await render(
      "en",
      ["mastodon"],
      [],
      [],
      [],
      ["discord", "telegram"]
    );

    const french = await render(
      "fr",
      ["mastodon"],
      [],
      [],
      [],
      ["discord", "telegram"]
    );

    // The webhook's address and the bot's token beside the websites'
    // password and keys.
    expect(html.match(/type="password"/gu)?.length ?? 0).toBeGreaterThanOrEqual(
      5
    );
    expect(french).toContain(">Connecter Discord<");
    expect(french).toContain(">Connecter Telegram<");
  });

  it("offers the websites by key everywhere, WordPress.com with its app", async () => {
    const without = await render("en", ["mastodon"]);

    expect(without).toContain(">Connect DEV<");
    expect(without).toContain(">Connect Hashnode<");
    expect(without).toContain("Pro plan");
    expect(without).not.toContain("Connect WordPress.com");

    const withApp = await render(
      "fr",
      ["mastodon"],
      [],
      [],
      ["wordpress", "devto", "hashnode", "wordpressCom"]
    );

    expect(withApp).toContain(">Connecter WordPress.com<");
  });

  it("offers every platform the server connects", async () => {
    const html = await render("en", ["x", "linkedin", "bluesky", "mastodon"]);

    expect(html).toContain(">Connect Mastodon<");
    expect(html).toContain(">Connect Bluesky<");
    expect(html).toContain(">Connect LinkedIn<");
    expect(html).toContain(">Connect X<");
    expect(html).toContain("again every 60 days");
  });

  it("leaves out the platforms the server is not set up for", async () => {
    const html = await render("en", ["mastodon"]);

    expect(html).toContain(">Connect Mastodon<");
    expect(html).not.toContain("Bluesky");
    expect(html).not.toContain("LinkedIn");
    expect(html).not.toContain(">Connect X<");
  });

  it("offers Instagram Login first, and a Facebook Page as the other way", async () => {
    const html = await render(
      "en",
      ["instagram", "facebook"],
      ["instagramLogin", "facebookLogin"]
    );

    expect(html).toContain(">Connect with Instagram<");
    expect(html).toContain(">Connect through a Facebook Page<");
    expect(html).toContain("no Facebook Page needed");
    expect(html).toContain(">Connect Facebook Pages<");
    expect(html.indexOf("Connect with Instagram")).toBeLessThan(
      html.indexOf("Connect through a Facebook Page")
    );
  });

  it("offers a business portfolio first, then the other ways in the server has", async () => {
    const html = await render(
      "en",
      ["instagram"],
      ["unifiedLogin", "instagramLogin", "facebookLogin"]
    );

    const buttons = [
      ...html.matchAll(/<button[^>]*>(?<text>[^<]*)<\/button>/gu),
    ].map((button) => button.groups?.["text"]);

    expect(buttons.slice(0, 3)).toStrictEqual([
      "Connect through a business portfolio",
      "Connect with Instagram",
      "Connect through a Facebook Page",
    ]);
    expect(html).toContain("sign in with Instagram or Facebook");
    expect(html).toContain("Meta asks for the account’s password");
    expect(html).not.toContain("Sign in on Instagram.");
  });

  it("says in French what Meta's business sign-in asks", async () => {
    const html = await render("fr", ["instagram"], ["unifiedLogin"]);

    expect(html).toContain(">Passer par un portefeuille business<");
    expect(html).toContain("portefeuille business qui détient");
  });

  it("offers only the way in the server has", async () => {
    const html = await render("fr", ["instagram"], ["facebookLogin"]);

    expect(html).toContain(">Passer par une Page Facebook<");
    expect(html).not.toContain("Se connecter avec Instagram");
  });

  it("offers a LinkedIn profile or company pages where the server has both", async () => {
    const html = await render(
      "en",
      ["linkedin"],
      [],
      ["linkedinProfile", "linkedinPage"]
    );

    expect(html).toContain(">Connect your profile<");
    expect(html).toContain(">Connect company pages<");
    expect(html).toContain("then choose the pages");
    expect(html).not.toContain(">Connect LinkedIn<");
    expect(html.indexOf("Connect your profile")).toBeLessThan(
      html.indexOf("Connect company pages")
    );
  });

  it("offers company pages alone on a server with the pages app only", async () => {
    const html = await render("fr", ["linkedin"], [], ["linkedinPage"]);

    expect(html).toContain(">Connecter des pages d’entreprise<");
    expect(html).not.toContain("Connecter votre profil");
  });

  it("keeps LinkedIn's one button on a server that connects profiles only", async () => {
    const html = await render("en", ["linkedin"], [], ["linkedinProfile"]);

    expect(html).toContain(">Connect LinkedIn<");
    expect(html).not.toContain("company pages");
  });

  it("offers Slack as a sign-in on a server with its app, in both languages", async () => {
    const english = await render("en", ["mastodon", "slack"]);
    const french = await render("fr", ["slack"]);

    expect(english).toContain(">Connect Slack<");
    expect(english).toContain("choose the channel it posts to there");
    expect(french).toContain(">Connecter Slack<");
    await expect(render("en", ["mastodon"])).resolves.not.toContain("Slack");
  });

  it("offers Snapchat as a sign-in on a server with its app, in both languages", async () => {
    const english = await render("en", ["mastodon", "snapchat"]);
    const french = await render("fr", ["snapchat"]);

    expect(english).toContain(">Connect Snapchat<");
    expect(english).toContain("Spotlight videos");
    expect(french).toContain(">Connecter Snapchat<");
    await expect(render("en", ["mastodon"])).resolves.not.toContain("Snapchat");
  });

  it("writes the buttons in French", async () => {
    const html = await render("fr", ["linkedin", "x"]);

    expect(html).toContain(">Connecter LinkedIn<");
    expect(html).toContain(">Connecter X<");
    expect(html).toContain("tous les 60 jours");
  });
});
