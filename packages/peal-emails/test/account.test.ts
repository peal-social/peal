import { DateTime, Predicate, Schema } from "effect";
import { describe, expect, it } from "vitest";

import type { EmailCatalog } from "../src/catalog/email-catalog.ts";
import { english } from "../src/catalog/english.ts";
import { french } from "../src/catalog/french.ts";
import { renderAccountEmail } from "../src/index.ts";
import type { AccountEmail } from "../src/index.ts";
import { accountEmail, subjectOf, textOf } from "./support.ts";

const url =
  "https://app.example.test/api/auth/verify-email?token=abc&callbackURL=%2F";

const at = (iso: string) => DateTime.makeUnsafe(iso);

const invitation = (locale: "en" | "fr", role: string): AccountEmail => ({
  _tag: "Invitation",
  inviterName: "Ada <Admin> & Co",
  locale,
  role,
  to: "grace@example.test",
  url: "https://app.example.test/invitations/42",
  workspaceName: 'Studio "Nord"',
});

// What a server that keeps what French law has a host keep leaves of a
// closed account, and one that turned it off after having kept connections.
const identification = {
  accountYears: 1,
  connectionYears: 1,
  identityYears: 5,
};

const connectionsOnly = {
  accountYears: null,
  connectionYears: 1,
  identityYears: null,
};

// The text of a deletion's confirmation, in `locale`.
const deleted = async (
  locale: "en" | "fr",
  legalHold: typeof identification | typeof connectionsOnly | null
) =>
  await textOf(
    accountEmail({
      _tag: "AccountDeleted",
      legalHold,
      locale,
      subscriptionsCancelled: 0,
      to: "ada@example.test",
      url: "https://app.example.test",
    })
  );

// A cancellation's acknowledgement, in `locale`, with what became of it.
const cancellationAcknowledged = async (
  locale: "en" | "fr",
  outcome: "cancelled" | "confirm" | "review"
) =>
  await accountEmail({
    _tag: "ContractRequestAcknowledged",
    contract: "Studio Nord",
    desiredAt: null,
    effectiveAt:
      outcome === "cancelled" ? at("2026-12-01T00:00:00.000Z") : null,
    kind: "cancellation",
    locale,
    name: "Camille Synthetic",
    outcome,
    receivedAt: at("2026-11-10T08:05:00.000Z"),
    refunded: null,
    to: "camille@example.test",
    url: "https://app.example.test/fr/contract-request?token=abc",
  });

// A withdrawal's acknowledgement in English, which named no contract.
const withdrawalAcknowledged = async (outcome: "expired" | "withdrawn") =>
  await textOf(
    accountEmail({
      _tag: "ContractRequestAcknowledged",
      contract: "",
      desiredAt: null,
      effectiveAt:
        outcome === "withdrawn" ? at("2026-11-10T08:05:00.000Z") : null,
      kind: "withdrawal",
      locale: "en",
      name: "Camille Synthetic",
      outcome,
      receivedAt: at("2026-11-10T08:05:00.000Z"),
      refunded:
        outcome === "withdrawn" ? { amount: 810, currency: "eur" } : null,
      to: "camille@example.test",
      url: "https://app.example.test",
    })
  );

describe(renderAccountEmail, () => {
  it("writes a verification email in English", async () => {
    const email = await accountEmail({
      _tag: "VerifyEmail",
      locale: "en",
      to: "ada@example.test",
      url,
    });

    expect(email.subject).toBe("Confirm your email for Peal");
    expect(email.text).toContain(`Confirm my email: ${url}`);
    expect(email.html).toMatch(/<html [^>]*lang="en"/u);
    expect(email.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
  });

  it("says nothing is refunded when nothing was charged, and that a plan renews until a later day asked for", async () => {
    const base = {
      _tag: "ContractRequestAcknowledged",
      contract: "",
      locale: "en",
      name: "Camille Synthetic",
      receivedAt: at("2026-11-10T08:05:00.000Z"),
      refunded: null,
      to: "camille@example.test",
      url: "https://app.example.test",
    } as const;

    const unpaid = await textOf(
      accountEmail({
        ...base,
        desiredAt: null,
        effectiveAt: at("2026-11-10T08:05:00.000Z"),
        kind: "withdrawal",
        outcome: "withdrawn",
      })
    );

    const later = await textOf(
      accountEmail({
        ...base,
        desiredAt: at("2027-02-15T00:00:00.000Z"),
        effectiveAt: at("2027-02-15T00:00:00.000Z"),
        kind: "cancellation",
        outcome: "cancelled",
      })
    );

    const laterInFrench = await textOf(
      accountEmail({
        ...base,
        desiredAt: at("2027-02-15T00:00:00.000Z"),
        effectiveAt: at("2027-02-15T00:00:00.000Z"),
        kind: "cancellation",
        locale: "fr",
        outcome: "cancelled",
      })
    );

    expect([
      unpaid.includes("Nothing had been charged"),
      later.includes("it renews until then"),
      laterInFrench.includes("il se renouvelle jusque-là"),
    ]).toStrictEqual([true, true, true]);
    // Neither a refund of nothing, nor a promise the renewals break.
    expect(
      [
        unpaid.includes("is refunded to"),
        unpaid.includes("and  is"),
        later.includes("nothing more is charged"),
        laterInFrench.includes("plus rien n’est prélevé"),
      ].filter(Boolean)
    ).toStrictEqual([]);
  });

  it("acknowledges a cancellation with when it came and what it said, in the reader's language", async () => {
    const { subject, text } = await cancellationAcknowledged("fr", "confirm");

    expect(subject).toBe(
      "Nous avons reçu la notification de votre résiliation"
    );
    // The date and the time, the statement's content, and the link.
    expect(text).toContain("10 novembre 2026 à 08:05 UTC");
    expect(text).toContain(
      "nom, Camille Synthetic ; contrat : Studio Nord ; accusé de réception à envoyer à camille@example.test"
    );
    expect(text).toContain("Appliquer ma demande");
    expect(text).toContain(
      "https://app.example.test/fr/contract-request?token=abc"
    );
  });

  it("says what became of a cancellation: applied, or left to a person", async () => {
    const applied = await textOf(cancellationAcknowledged("en", "cancelled"));

    expect(applied).toContain("November 10, 2026 at 8:05 AM UTC");
    expect(applied).toContain(
      "The contract ends on December 1, 2026 at 12:00 AM UTC"
    );
    expect(applied).not.toContain("follow the link");
    await expect(
      textOf(cancellationAcknowledged("en", "review"))
    ).resolves.toContain("a person will look at it");
  });

  it("acknowledges a withdrawal with what is refunded, or why it could not be applied", async () => {
    await expect(withdrawalAcknowledged("withdrawn")).resolves.toContain(
      "€8.10 is refunded"
    );
    await expect(withdrawalAcknowledged("withdrawn")).resolves.toContain(
      "contract: not given"
    );
    await expect(withdrawalAcknowledged("expired")).resolves.toContain(
      "14 days to withdraw were over"
    );
  });

  it("writes a password reset email in French", async () => {
    const email = await accountEmail({
      _tag: "ResetPassword",
      locale: "fr",
      to: "ada@example.test",
      url,
    });

    expect(email.subject).toBe("Réinitialisez votre mot de passe Peal");
    expect(email.text).toContain(`Choisir un nouveau mot de passe : ${url}`);
    expect(email.html).toMatch(/<html [^>]*lang="fr"/u);
  });

  it("confirms an account's deletion in its language, linking to Peal", async () => {
    const inEnglish = await accountEmail({
      _tag: "AccountDeleted",
      legalHold: null,
      locale: "en",
      subscriptionsCancelled: 0,
      to: "ada@example.test",
      url: "https://app.example.test",
    });

    const inFrench = await accountEmail({
      _tag: "AccountDeleted",
      legalHold: null,
      locale: "fr",
      subscriptionsCancelled: 0,
      to: "ada@example.test",
      url: "https://app.example.test/fr",
    });

    expect(inEnglish.subject).toBe("Your Peal account is deleted");
    expect(inEnglish.text).toContain("Open Peal: https://app.example.test");
    expect(inFrench.subject).toBe("Votre compte Peal est supprimé");
    expect(inFrench.text).toContain(
      "Ouvrir Peal\u00A0: https://app.example.test/fr"
    );
  });

  it("says what French law has a host keep after an account's deletion, for how long and for whom, on a server that keeps it", async () => {
    await expect(deleted("en", identification)).resolves.toContain(
      "for judicial authorities only, your name and email address for 5 years, and how you signed in and the connections that created content for 1 year"
    );
    await expect(deleted("fr", identification)).resolves.toContain(
      "pour les seules autorités judiciaires, vos nom et adresse e-mail pendant 5\u00A0ans, et vos moyens de connexion ainsi que les connexions ayant créé du contenu pendant 1\u00A0an"
    );
  });

  it("says nothing is kept on a server that keeps nothing for the law", async () => {
    await expect(deleted("en", null)).resolves.not.toContain("judicial");
    await expect(deleted("en", null)).resolves.not.toContain("French law");
    await expect(deleted("fr", null)).resolves.not.toContain("judiciaires");
  });

  it("says only the connections already kept stay, on a server that stopped keeping them", async () => {
    const inEnglish = await deleted("en", connectionsOnly);

    expect(inEnglish).toContain(
      "the connections that created content, kept so far, stay 1 year from each"
    );
    expect(inEnglish).not.toContain("your name and email address");
    await expect(deleted("fr", connectionsOnly)).resolves.toContain(
      "les connexions ayant créé du contenu, conservées jusqu’ici, le restent 1\u00A0an à compter de chacune"
    );
  });

  it("says when deleting cancelled subscriptions, and that nothing more is charged", async () => {
    const account = await accountEmail({
      _tag: "AccountDeleted",
      legalHold: null,
      locale: "en",
      subscriptionsCancelled: 1,
      to: "ada@example.test",
      url: "https://app.example.test",
    });

    expect(account.text).toContain("nothing more is charged");
    await expect(
      textOf(
        accountEmail({
          _tag: "AccountDeleted",
          legalHold: null,
          locale: "en",
          subscriptionsCancelled: 0,
          to: "ada@example.test",
          url: "https://app.example.test",
        })
      )
    ).resolves.not.toContain("nothing more is charged");

    const workspace = await accountEmail({
      _tag: "WorkspaceDeleted",
      locale: "fr",
      subscriptionsCancelled: 1,
      to: "ada@example.test",
      url: "https://app.example.test/fr/app",
      workspaceName: 'Studio "Nord"',
    });

    expect(workspace.subject).toBe(
      'L’espace de travail Studio "Nord" est supprimé'
    );
    expect(workspace.text).toContain("plus rien n’est facturé");
    expect(workspace.html).toContain("Studio &quot;Nord&quot;");
  });

  it("tells the account a copy of its data was taken, and from where", async () => {
    const web = await accountEmail({
      _tag: "DataExported",
      locale: "en",
      to: "ada@example.test",
      url: "https://app.example.test/app/account",
      via: "web",
    });

    const terminal = await accountEmail({
      _tag: "DataExported",
      locale: "fr",
      to: "ada@example.test",
      url: "https://app.example.test/fr/app/account",
      via: "commandLine",
    });

    expect(web.subject).toBe("A copy of your Peal data was downloaded");
    expect(web.text).toContain("from the web app");
    expect(terminal.text).toContain("depuis la ligne de commande");
  });

  it("names the role an invitation offers, with French elision", async () => {
    await expect(
      textOf(accountEmail(invitation("en", "editor")))
    ).resolves.toContain("on Peal as an editor.");
    await expect(
      textOf(accountEmail(invitation("fr", "editor")))
    ).resolves.toContain("sur Peal en tant qu’éditeur.");
  });

  it("escapes names in HTML and keeps them in the text and subject", async () => {
    const email = await accountEmail(invitation("en", "viewer"));

    expect(email.subject).toBe(
      'Ada <Admin> & Co invited you to Studio "Nord" on Peal'
    );
    expect(email.html).toContain(
      "Ada &lt;Admin&gt; &amp; Co invited you to join Studio &quot;Nord&quot;"
    );
    expect(email.html).not.toContain("<Admin>");
    expect(email.text).toContain("Ada <Admin> & Co invited you");
  });

  it.each([
    ["en", "A member invited you to a workspace on Peal"],
    ["fr", "Un membre"],
  ] as const)(
    "leaves out, in %s, names that read as hosts or addresses, which a mail client would link",
    async (locale, said) => {
      const email = await accountEmail({
        _tag: "Invitation",
        inviterName: "admin@evil.social",
        locale,
        role: "viewer",
        to: "grace@example.test",
        url: "https://app.example.test/invitations/42",
        workspaceName: "Claim at evil.finance",
      });

      expect(email.subject).toContain(said);

      for (const part of [email.subject, email.html, email.text]) {
        expect(part).not.toContain("evil");
      }
    }
  );
});

interface Catalogue {
  readonly [key: string]: string | Catalogue;
}

const CatalogueSchema: Schema.Codec<Catalogue> = Schema.Record(
  Schema.String,
  Schema.Union([
    Schema.String,
    Schema.suspend((): Schema.Codec<Catalogue> => CatalogueSchema),
  ])
);

const decodeCatalogue = Schema.decodeUnknownSync(CatalogueSchema);

const walk = (catalogue: Catalogue, prefix: string): [string, string][] =>
  Object.entries(catalogue).flatMap(([key, value]): [string, string][] =>
    Predicate.isString(value)
      ? [[`${prefix}${key}`, value]]
      : walk(value, `${prefix}${key}.`)
  );

// Every message of a catalogue, with its dotted key.
const entries = (catalog: EmailCatalog): [string, string][] =>
  walk(decodeCatalogue(catalog), "");

describe("the email catalogues", () => {
  it("have the same keys in English and French", () => {
    expect(entries(french).map(([key]) => key)).toStrictEqual(
      entries(english).map(([key]) => key)
    );
  });

  it.each([
    { catalog: english, locale: "en" },
    { catalog: french, locale: "fr" },
  ])("have no empty message in $locale", ({ catalog }) => {
    expect(
      entries(catalog).filter(([, text]) => text.trim() === "")
    ).toStrictEqual([]);
  });
});

// What two-step verification's email says, in `locale`.
const twoStep = async (
  locale: "en" | "fr",
  kind: Extract<AccountEmail, { _tag: "TwoStepChanged" }>["kind"],
  recoveryCodesLeft: number | null = null
) =>
  await accountEmail({
    _tag: "TwoStepChanged",
    kind,
    locale,
    recoveryCodesLeft,
    to: "ada@example.test",
    url: "https://app.example.test/app/account",
  });

describe("two-step verification's emails", () => {
  it.each(["en", "fr"] as const)(
    "tell each change apart, with what to do if it was not them, in %s",
    async (locale) => {
      const kinds = [
        "turnedOn",
        "turnedOff",
        "recoveryCodesRenewed",
        "recoveryCodeUsed",
        "resetByStaff",
      ] as const;

      const emails = await Promise.all(
        kinds.map(async (kind) => await twoStep(locale, kind, 3))
      );

      expect(new Set(emails.map(({ subject }) => subject)).size).toBe(
        kinds.length
      );

      for (const { text } of emails) {
        expect(text).toContain("https://app.example.test/app/account");
        expect(text).toContain(
          locale === "en"
            ? "change your password"
            : "changez votre mot de passe"
        );
      }
    }
  );

  it("says how many recovery codes are left after one was used", async () => {
    await expect(
      textOf(twoStep("en", "recoveryCodeUsed", 9))
    ).resolves.toContain("You have 9 recovery codes left.");
    await expect(
      textOf(twoStep("en", "recoveryCodeUsed", 1))
    ).resolves.toContain("You have 1 recovery code left.");
    await expect(
      textOf(twoStep("en", "recoveryCodeUsed", 0))
    ).resolves.toContain("You have no recovery code left");
    await expect(
      textOf(twoStep("fr", "recoveryCodeUsed", 9))
    ).resolves.toContain("Il vous reste 9 codes de secours.");
    await expect(
      textOf(twoStep("fr", "recoveryCodeUsed", 1))
    ).resolves.toContain("Il vous reste 1 code de secours.");
  });

  it("says the words two-step verification is known by", async () => {
    await expect(subjectOf(twoStep("en", "turnedOn"))).resolves.toContain(
      "Two-step verification"
    );
    await expect(subjectOf(twoStep("fr", "turnedOn"))).resolves.toContain(
      "validation en deux étapes"
    );
  });
});
