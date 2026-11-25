import { DateTime, Option, Struct } from "effect";
import { describe, expect, it } from "vitest";

import { english as words } from "../src/catalog/english.ts";
import { renderNoticeEmail } from "../src/index.ts";
import type { Locale, NoticeChannel, NoticeEvent } from "../src/index.ts";
import { subjectOf, textOf } from "./support.ts";

const url = "https://app.example.test/app/0b1c/posts/0190";

const postId = "00000000-0000-7000-8000-000000000001";

const mastodon: Option.Option<NoticeChannel> = Option.some({
  handle: "@alice@social.example",
  platform: "mastodon",
});

const render = async (event: NoticeEvent, locale: Locale) =>
  await renderNoticeEmail({ event, locale, url, workspaceName: "Studio Nord" });

const locales: readonly Locale[] = ["en", "fr"];

describe(renderNoticeEmail, () => {
  const withdrawn: NoticeEvent = {
    _tag: "SubscriptionWithdrawn",
    plan: "starter",
    refunded: { amount: 810, currency: "eur" },
    withdrawnAt: DateTime.makeUnsafe("2026-11-04T08:15:00Z"),
  };

  it("sends members whose channel's messages were turned off to the inbox's own steps", async () => {
    const bluesky = { handle: "@studio.example", platform: "bluesky" } as const;

    const english = await render(
      { _tag: "MessagesTurnedOff", channel: bluesky },
      "en"
    );

    const french = await render(
      { _tag: "MessagesTurnedOff", channel: bluesky },
      "fr"
    );

    expect(english.text).toContain(
      "choose Read its messages for the channel in Settings, Direct messages, then Allow, on Bluesky"
    );
    expect(french.text).toContain(
      "choisissez Lire ses messages pour le canal dans Paramètres, Messages privés, puis Autoriser, sur Bluesky"
    );
    expect(`${english.text}${french.text}`).not.toMatch(/\{\w+\}/u);
  });

  const ruleId = "00000000-0000-7000-8000-00000000f001";

  it("tells follow-ups that did not go out, how many and why, in both languages", async () => {
    const event: NoticeEvent = {
      _tag: "FollowUpsNotSent",
      count: 3,
      reasons: ["failed", "unconfirmed"],
      ruleId,
    };

    const english = await render(event, "en");
    const french = await render(event, "fr");

    expect(english.subject).toBe("Follow-ups did not go out");
    expect(english.text).toContain(
      "A follow-up rule of Studio Nord has follow-ups that did not go out (3): they failed, and the rule shows the platform’s or Peal’s code for each; Peal could not tell whether they went out: check the platform, as Peal never sends them again."
    );
    expect(french.subject).toBe("Des relances ne sont pas parties");
    expect(french.text).toContain(
      "Une règle de relance de Studio Nord a des relances qui ne sont pas parties (3) : elles ont échoué, et la règle donne pour chacune le code de la plateforme ou de Peal ; Peal n’a pas pu savoir si elles sont parties : vérifiez la plateforme, car Peal ne les renvoie jamais."
    );
  });

  it("tells one follow-up that did not go out in the singular, in both languages", async () => {
    const event: NoticeEvent = {
      _tag: "FollowUpsNotSent",
      count: 1,
      reasons: ["failed"],
      ruleId,
    };

    const english = await render(event, "en");
    const french = await render(event, "fr");

    expect(english.subject).toBe("A follow-up did not go out");
    expect(english.text).toContain(
      "A follow-up of a rule of Studio Nord did not go out: it failed, and the rule shows the platform’s or Peal’s code."
    );
    expect(french.subject).toBe("Une relance n’est pas partie");
    expect(french.text).toContain(
      "Une relance d’une règle de Studio Nord n’est pas partie : elle a échoué, et la règle donne le code de la plateforme ou de Peal."
    );
  });

  it("tells a rule that stopped by itself, why, in both languages", async () => {
    const english = await render(
      { _tag: "FollowUpRuleStopped", reason: "channelGone", ruleId },
      "en"
    );

    const french = await render(
      { _tag: "CommentRuleStopped", reason: "starterGone", ruleId },
      "fr"
    );

    expect(english.subject).toBe("A follow-up rule stopped");
    expect(english.text).toContain(
      "A follow-up rule of Studio Nord stopped by itself: its channel was disconnected."
    );
    expect(french.subject).toBe(
      "Une règle de réponse aux commentaires s’est arrêtée"
    );
    expect(french.text).toContain(
      "Une règle de réponse aux commentaires de Studio Nord s’est arrêtée d’elle-même : la personne qui l’a lancée ne peut plus y répondre aux commentaires."
    );
  });

  it("words every reason of the rules that act by themselves in every language", async () => {
    const events: readonly NoticeEvent[] = [
      ...Struct.keys(words.followUpNotSentReasons.one).map(
        (reason): NoticeEvent => ({
          _tag: "FollowUpsNotSent",
          count: 1,
          reasons: [reason],
          ruleId,
        })
      ),
      ...Struct.keys(words.followUpRuleStopReasons).flatMap(
        (reason): readonly NoticeEvent[] => [
          { _tag: "FollowUpRuleStopped", reason, ruleId },
          { _tag: "CommentRuleStopped", reason, ruleId },
        ]
      ),
    ];

    const emails = await Promise.all(
      events.flatMap((event) =>
        locales.map(async (locale) => await render(event, locale))
      )
    );

    for (const { subject, text } of emails) {
      expect(subject).not.toMatch(/\{\w+\}/u);
      expect(text).not.toMatch(/\{\w+\}/u);
      expect(text).not.toContain("undefined");
    }
  });

  it("acknowledges a withdrawal with its date, time and refund", async () => {
    const english = await render(withdrawn, "en");

    expect(english.subject).toBe(
      "Withdrawal received: your Starter subscription has ended"
    );
    expect(english.text).toContain("on November 4, 2026 at 8:15 AM UTC");
    expect(english.text).toContain("€8.10 is refunded");
  });

  it("acknowledges a withdrawal in French", async () => {
    const french = await render(withdrawn, "fr");

    expect(french.subject).toBe(
      "Rétractation reçue : votre abonnement Starter a pris fin"
    );
    expect(french.text).toContain("le 4 novembre 2026 à 08:15 UTC");
    expect(french.text).toContain("8,10\u00A0€ vous est remboursé");
  });

  it("confirms a subscription with its price and the right to withdraw", async () => {
    const email = await render(
      {
        _tag: "SubscriptionStarted",
        interval: "month",
        plan: "pro",
        price: { amount: 1500, currency: "eur" },
        startedAt: DateTime.makeUnsafe("2026-11-09T10:00:00Z"),
        trialEnd: Option.none(),
      },
      "en"
    );

    expect(email.subject).toBe("Your Pro subscription has started");
    expect(email.text).toContain("for €15.00 a month, VAT included");
    expect(email.text).toContain("Withdraw from contract here");
  });

  it("reminds a yearly renewal with what it will charge, VAT included", async () => {
    const email = await render(
      {
        _tag: "SubscriptionRenewing",
        plan: "business",
        price: { amount: 30_000, currency: "eur" },
        renewsAt: DateTime.makeUnsafe("2027-01-31T00:00:00Z"),
      },
      "fr"
    );

    expect(email.subject).toBe(
      "Votre abonnement annuel Business se renouvelle le 31 janvier 2027 à 00:00 UTC"
    );
    expect(email.text).toContain("300,00\u00A0€ TTC");
    // The last day to refuse the renewal, set apart in a box (Code de la
    // consommation L215-1).
    expect(email.text).toContain(
      "\n\nDate limite de non-reconduction : 31 janvier 2027 à 00:00 UTC\n\n"
    );
    expect(email.html).toMatch(
      /<p style="[^"]*border:2px solid[^"]*">Date limite de non-reconduction : 31 janvier 2027 à 00:00 UTC<\/p>/u
    );
    expect(email.text).toContain("Résilier votre contrat");
  });

  it("gives the contract's number with the confirmation and the reminder", async () => {
    const started = await render(
      {
        _tag: "SubscriptionStarted",
        interval: "month",
        plan: "pro",
        price: { amount: 1500, currency: "eur" },
        reference: "7K3M-9QXD-42TN",
        startedAt: DateTime.makeUnsafe("2026-11-09T10:00:00Z"),
        trialEnd: Option.none(),
      },
      "en"
    );

    expect(started.text).toContain("Contract number: 7K3M-9QXD-42TN");
    expect(started.text).toContain("at the foot of every page of the website");

    const renewing = await render(
      {
        _tag: "SubscriptionRenewing",
        plan: "business",
        price: { amount: 30_000, currency: "eur" },
        reference: "7K3M-9QXD-42TN",
        renewsAt: DateTime.makeUnsafe("2027-01-31T00:00:00Z"),
      },
      "fr"
    );

    expect(renewing.text).toContain("Numéro de contrat : 7K3M-9QXD-42TN");
  });

  it("lists what a trial's end leaves beyond the free plan", async () => {
    const ending = {
      _tag: "TrialEnding",
      endsAt: DateTime.makeUnsafe("2026-11-23T10:00:00Z"),
      over: [
        { allowed: 3, limit: "channels", used: 8 },
        { allowed: 2, limit: "members", used: 5 },
        { allowed: 500_000_000, limit: "mediaStorage", used: 1_200_000_000 },
      ],
      plan: "pro",
    } as const;

    await expect(textOf(render(ending, "en"))).resolves.toContain(
      "Today it holds more than the free plan allows: 8 channels (3 allowed), 5 members (2 allowed), 1.2 GB of media (500 MB allowed). From that day, nothing is scheduled or published until it is back within the free plan: posts already scheduled fail when due, and can be posted again afterwards. Add a payment method, or choose which accounts stay, on the billing page."
    );
    await expect(textOf(render(ending, "fr"))).resolves.toContain(
      "Aujourd’hui, il dépasse ce que permet l’offre gratuite : 8 canaux (3 permis), 5 membres (2 permis), 1,2\u202FGo de médias (500\u202FMo permis). À partir de ce jour, rien n’est programmé ni publié tant qu’il n’est pas revenu dans l’offre gratuite : les publications déjà programmées échouent à leur échéance, et peuvent être republiées ensuite. Ajoutez un moyen de paiement, ou choisissez les comptes qui restent, sur la page de facturation."
    );

    const within = await textOf(render({ ...ending, over: [] }, "en"));

    expect(within).toContain(
      "It holds nothing beyond what the free plan allows, and keeps its content."
    );
    expect(within).not.toContain("Today it holds more");
  });

  it("confirms per-account pricing with its rates, charging nothing now", async () => {
    const started = {
      _tag: "SubscriptionStarted",
      interval: "month",
      plan: "payAsYouGo",
      price: { amount: 0, currency: "usd" },
      rates: {
        bands: [
          { monthly: 0, upTo: 2 },
          { monthly: 500, upTo: 10 },
          { monthly: 300, upTo: 100 },
          { monthly: 100, upTo: null },
        ],
        currency: "usd",
        freeAccounts: 2,
      },
      reference: "7K3M-9QXD-42TN",
      startedAt: DateTime.makeUnsafe("2026-11-13T10:00:00Z"),
      trialEnd: Option.none(),
    } as const;

    const english = await render(started, "en");

    expect(english.subject).toBe("Per-account pricing has started");
    expect(english.text).toContain(
      "accounts 1 to 2 free, accounts 3 to 10 at $5.00 a month each, accounts 11 to 100 at $3.00 a month each, accounts 101 and up at $1.00 a month each, excluding tax"
    );
    expect(english.text).toContain("Nothing is charged now");
    expect(english.text).toContain("Contract number: 7K3M-9QXD-42TN");
    await expect(textOf(render(started, "fr"))).resolves.toContain(
      "comptes 1 à 2 gratuits, comptes 3 à 10 à 5,00\u00A0$US par mois chacun"
    );
  });

  it("asks for a payment method before the grace's day", async () => {
    const needed = {
      _tag: "PaymentMethodNeeded",
      accounts: 5,
      allowed: 2,
      graceUntil: DateTime.makeUnsafe("2027-01-31T00:00:00Z"),
    } as const;

    await expect(subjectOf(render(needed, "en"))).resolves.toBe(
      "Add a payment method to Studio Nord before January 31, 2027 at 12:00 AM UTC"
    );
    await expect(textOf(render(needed, "en"))).resolves.toContain(
      "Studio Nord holds 5 connected accounts, more than the 2 the free tier includes"
    );
    await expect(textOf(render(needed, "fr"))).resolves.toContain(
      "Studio Nord compte 5 comptes connectés, plus que les 2 de l’offre gratuite"
    );
  });

  it("tells a legacy plan's retirement, with its last day, in both languages", async () => {
    const retiring = {
      _tag: "PlansRetiring",
      endsAt: DateTime.makeUnsafe("2027-01-01T00:00:00Z"),
      plan: "starter",
    } as const;

    await expect(subjectOf(render(retiring, "en"))).resolves.toBe(
      "The Starter plan of Studio Nord ends on January 1, 2027 at 12:00 AM UTC"
    );
    await expect(textOf(render(retiring, "en"))).resolves.toContain(
      "nothing after that day is charged: the unused part of what was paid for beyond it is refunded to the payment method it was paid with"
    );
    await expect(textOf(render(retiring, "en"))).resolves.not.toContain(
      "nothing more is charged"
    );
    await expect(textOf(render(retiring, "fr"))).resolves.toContain(
      "rien n’est facturé au-delà de ce jour"
    );
    await expect(subjectOf(render(retiring, "fr"))).resolves.toBe(
      "La formule Starter de Studio Nord prend fin le 1 janvier 2027 à 00:00 UTC"
    );
  });

  it("tells a trial's end and a cancellation's", async () => {
    await expect(
      subjectOf(
        render(
          {
            _tag: "TrialEnding",
            endsAt: DateTime.makeUnsafe("2026-11-23T10:00:00Z"),
            over: [],
            plan: "pro",
          },
          "en"
        )
      )
    ).resolves.toBe("Your Pro trial ends on November 23, 2026 at 10:00 AM UTC");

    await expect(
      subjectOf(
        render(
          {
            _tag: "SubscriptionCancelled",
            endsAt: DateTime.makeUnsafe("2026-12-01T00:00:00Z"),
            plan: "agency",
          },
          "fr"
        )
      )
    ).resolves.toBe(
      "Votre abonnement Agency est résilié : il prend fin le 1 décembre 2026 à 00:00 UTC"
    );
  });

  it("tells that a webhook endpoint was turned off, by its host and why", async () => {
    const failing = await render(
      {
        _tag: "WebhookEndpointDisabled",
        endpointId: "00000000-0000-7000-8000-000000000051",
        host: "hooks.example.com",
        reason: "failing",
      },
      "en"
    );

    expect(failing.subject).toBe(
      "Webhook endpoint turned off: hooks.example.com"
    );
    expect(failing.text).toContain(
      "Peal turned off the webhook endpoint at hooks.example.com in Studio Nord: every delivery to it failed for 5 days."
    );
    expect(failing.text).toContain(url);

    const gone = await render(
      {
        _tag: "WebhookEndpointDisabled",
        endpointId: "00000000-0000-7000-8000-000000000051",
        host: "hooks.example.com",
        reason: "gone",
      },
      "fr"
    );

    expect(gone.subject).toBe(
      "Point de terminaison de webhook désactivé : hooks.example.com"
    );
    expect(gone.text).toContain(
      "Peal a désactivé le point de terminaison de webhook hooks.example.com dans Studio Nord : il a répondu 410 Gone, ce qui demande de ne plus rien lui envoyer."
    );
  });

  it("asks to reconnect a channel, in English", async () => {
    const email = await render(
      {
        _tag: "ChannelReconnectRequired",
        channel: { handle: "@alice@social.example", platform: "mastodon" },
      },
      "en"
    );

    expect(email.subject).toBe("Reconnect @alice@social.example on Mastodon");
    expect(email.text).toContain(
      "Peal can no longer post as @alice@social.example on Mastodon in Studio Nord"
    );
    expect(email.text).toContain(`Reconnect the account: ${url}`);
    expect(email.html).toContain(`href="${url}"`);
  });

  it("gives the expiry in the reader's language, in UTC", async () => {
    const email = await render(
      {
        _tag: "ChannelReconnectSoon",
        channel: { handle: "@bob.test", platform: "bluesky" },
        expiresAt: DateTime.makeUnsafe("2026-12-01T09:30:00Z"),
      },
      "fr"
    );

    expect(email.subject).toBe(
      "Reconnectez @bob.test sur Bluesky avant le 1 décembre 2026 à 09:30 UTC"
    );
    expect(email.html).toMatch(/<html [^>]*lang="fr"/u);
  });

  const published: NoticeEvent = {
    _tag: "PostPublished",
    channel: mastodon,
    permalink: Option.some("https://social.example/@alice/1"),
    postId,
  };

  it("tells a published post, in English", async () => {
    const english = await render(published, "en");

    expect(english.subject).toBe(
      "Published on Mastodon (@alice@social.example)"
    );
    expect(english.text).toContain(
      "A post of Studio Nord is live on Mastodon (@alice@social.example)."
    );
    expect(english.text).toContain(`See the post: ${url}`);
  });

  it("tells a published post, in French", async () => {
    const french = await render(published, "fr");

    expect(french.subject).toBe("Publié sur Mastodon (@alice@social.example)");
    expect(french.text).toContain(`Voir la publication\u00A0: ${url}`);
    expect(french.html).toMatch(/<html [^>]*lang="fr"/u);
  });

  it("says why a post failed, in each language", async () => {
    const event: NoticeEvent = {
      _tag: "PostFailed",
      channel: mastodon,
      postId,
      reason: "tokenExpired",
    };

    await expect(textOf(render(event, "en"))).resolves.toContain(
      "A post of Studio Nord did not go out on Mastodon (@alice@social.example): the account’s authorization stopped working. Reconnect it, then post again."
    );
    await expect(textOf(render(event, "fr"))).resolves.toContain(
      "Une publication de Studio Nord n’est pas partie sur Mastodon (@alice@social.example)\u00A0: l’autorisation du compte ne fonctionne plus."
    );
  });

  it("says the post went out when only its first comment did not", async () => {
    const event: NoticeEvent = {
      _tag: "PostFailed",
      channel: mastodon,
      notSent: "firstComment",
      postId,
      reason: "contentRejected",
    };

    const english = await render(event, "en");
    const french = await render(event, "fr");

    expect(english.subject).toBe(
      "A first comment did not go out on Mastodon (@alice@social.example)"
    );
    expect(english.text).toContain(
      "A post of Studio Nord is live on Mastodon (@alice@social.example), but its first comment did not go out:"
    );
    expect(french.text).toContain(
      "Une publication de Studio Nord est en ligne sur Mastodon (@alice@social.example), mais son premier commentaire n’est pas parti\u00A0:"
    );
  });

  it("says the post went out when only its later parts did not", async () => {
    const event: NoticeEvent = {
      _tag: "PostFailed",
      channel: mastodon,
      notSent: "laterParts",
      postId,
      reason: "contentRejected",
    };

    await expect(textOf(render(event, "en"))).resolves.toContain(
      "A post of Studio Nord is live on Mastodon (@alice@social.example), but the parts after its first did not go out:"
    );
    await expect(textOf(render(event, "fr"))).resolves.toContain(
      "Une publication de Studio Nord est en ligne sur Mastodon (@alice@social.example), mais les parties après la première ne sont pas parties\u00A0:"
    );
  });

  // Nothing in Peal turns a channel back on, and reconnecting leaves it off:
  // a new channel for the account is what members can make.
  it("says what members can do with a channel turned off", async () => {
    const event: NoticeEvent = {
      _tag: "PostFailed",
      channel: mastodon,
      postId,
      reason: "channelDisabled",
    };

    await expect(textOf(render(event, "en"))).resolves.toContain(
      "its channel was turned off before it went out. Turn the channel back on, then schedule it in a new post."
    );
    await expect(textOf(render(event, "fr"))).resolves.toContain(
      "son canal a été désactivé avant son départ. Réactivez le canal, puis programmez-la dans une nouvelle publication."
    );
  });

  it("words every failure in every language", async () => {
    const emails = await Promise.all(
      Struct.keys(words.failureReasons).flatMap((reason) =>
        locales.map(
          async (locale) =>
            await render(
              { _tag: "PostFailed", channel: mastodon, postId, reason },
              locale
            )
        )
      )
    );

    // Every placeholder is filled.
    for (const { subject, text } of emails) {
      expect(subject).not.toMatch(/\{\w+\}/u);
      expect(text).not.toMatch(/\{\w+\}/u);
    }
  });

  it("asks to check the platform before reposting an unconfirmed post", async () => {
    const event: NoticeEvent = {
      _tag: "PostUnconfirmed",
      channel: mastodon,
      postId,
    };

    const english = await render(event, "en");
    const french = await render(event, "fr");

    expect(english.subject).toBe(
      "Check Mastodon (@alice@social.example): a post may have gone out"
    );
    expect(english.text).toContain(
      "Check the platform before you post it again"
    );
    expect(french.subject).toBe(
      "Vérifiez Mastodon (@alice@social.example)\u00A0: une publication est peut-être partie"
    );
    expect(french.text).toContain(
      "Vérifiez sur la plateforme avant de la republier"
    );
  });

  it("names a channel disconnected since as such", async () => {
    const event: NoticeEvent = {
      _tag: "PostUnconfirmed",
      channel: Option.none(),
      postId,
    };

    await expect(subjectOf(render(event, "en"))).resolves.toBe(
      "Check a disconnected channel: a post may have gone out"
    );
    await expect(subjectOf(render(event, "fr"))).resolves.toBe(
      "Vérifiez un canal déconnecté\u00A0: une publication est peut-être partie"
    );
  });

  it("escapes names in HTML and keeps them in the text", async () => {
    const email = await renderNoticeEmail({
      event: {
        _tag: "PostPublished",
        channel: Option.some({ handle: "@a<b>", platform: "x" }),
        permalink: Option.none(),
        postId,
      },
      locale: "en",
      url,
      workspaceName: 'Studio "Nord" & Co',
    });

    expect(email.html).toContain("X (@a&lt;b&gt;)");
    expect(email.html).toContain("Studio &quot;Nord&quot; &amp; Co");
    expect(email.html).not.toContain("<b>");
    expect(email.text).toContain('Studio "Nord" & Co');
  });
});
