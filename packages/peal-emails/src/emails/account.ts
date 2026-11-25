import { DateTime, Match } from "effect";

import type { EmailCatalog, EmailMessages } from "../catalog/email-catalog.ts";
import { catalogs } from "../catalog/index.ts";
import type {
  ContractRequestOutcome,
  TwoStepChange,
} from "../catalog/vocabulary.ts";
import { fill, instantIn, moneyIn } from "../format.ts";
import type { Locale } from "../locale.ts";
import { nameForMail } from "../names.ts";
import type { MessageContent, Money } from "./message-content.ts";
import { resolved } from "./message-content.ts";

// Every account email carries one link, and goes out in its reader's language.
interface Link {
  readonly locale: Locale;
  readonly to: string;
  readonly url: string;
}

/** An email that signing in depends on, or that an account is owed. */
export type AccountEmail =
  // Confirms the address of a new account.
  | (Link & { readonly _tag: "VerifyEmail" })
  // Lets someone who forgot their password choose a new one.
  | (Link & { readonly _tag: "ResetPassword" })
  // Invites someone, who may not have an account yet, to a workspace.
  | (Link & {
      readonly _tag: "Invitation";
      readonly inviterName: string;
      readonly role: string;
      readonly workspaceName: string;
    })
  // Confirms that an account was deleted with its data, how many
  // subscriptions went with it, and what the law has the server keep of it,
  // in years: null when nothing, and without the identity and the account's
  // years on a server that stopped keeping them.
  | (Link & {
      readonly _tag: "AccountDeleted";
      readonly legalHold: {
        readonly accountYears: number | null;
        readonly connectionYears: number;
        readonly identityYears: number | null;
      } | null;
      readonly subscriptionsCancelled: number;
    })
  // Confirms, to the owner who deleted it, that a workspace is deleted, and
  // whether its subscription was cancelled.
  | (Link & {
      readonly _tag: "WorkspaceDeleted";
      readonly subscriptionsCancelled: number;
      readonly workspaceName: string;
    })
  // Tells what changed in the account's two-step verification, with how
  // many recovery codes are left when one was used.
  | (Link & {
      readonly _tag: "TwoStepChanged";
      readonly kind: TwoStepChange;
      readonly recoveryCodesLeft: number | null;
    })
  // Tells that a copy of the account's data was downloaded.
  | (Link & {
      readonly _tag: "DataExported";
      readonly via: "commandLine" | "web";
    })
  // Acknowledges a request to cancel a contract or withdraw from it: when it
  // was received, what it said (the contract empty when not given), and what
  // became of it.
  | (Link & {
      readonly _tag: "ContractRequestAcknowledged";
      readonly contract: string;
      readonly desiredAt: DateTime.Utc | null;
      readonly effectiveAt: DateTime.Utc | null;
      readonly kind: "cancellation" | "withdrawal";
      readonly name: string;
      readonly outcome: ContractRequestOutcome;
      readonly receivedAt: DateTime.Utc;
      readonly refunded: Money | null;
    });

interface Words {
  readonly messages: EmailMessages;
  readonly values: ReadonlyMap<string, string>;
}

// A deletion's body, with what cancelling its subscriptions meant.
const withBilling = (
  messages: EmailMessages,
  subscriptionsCancelled: number,
  billingEnded: string
): EmailMessages =>
  subscriptionsCancelled > 0
    ? { ...messages, body: `${messages.body} ${billingEnded}` }
    : messages;

type LegalHold = Extract<AccountEmail, { _tag: "AccountDeleted" }>["legalHold"];

// How many recovery codes are left, in the catalog's words.
const recoveryCodesLeftIn = (catalog: EmailCatalog, count: number): string => {
  const { none, one, other } = catalog.recoveryCodesLeft;

  if (count === 0) {
    return none;
  }

  return fill(count === 1 ? one : other, new Map([["count", String(count)]]));
};

// A number of years, in the catalog's words.
const yearsIn = (catalog: EmailCatalog, count: number): string =>
  fill(
    count === 1 ? catalog.legalHold.years.one : catalog.legalHold.years.other,
    new Map([["count", String(count)]])
  );

// What the law has the server keep of the account, if anything: who held
// it and how they signed in, or, on a server that stopped keeping these,
// only the connections it already holds.
const legalHoldIn = (catalog: EmailCatalog, legalHold: LegalHold) => {
  if (legalHold === null) {
    return null;
  }

  const { accountYears, connectionYears, identityYears } = legalHold;

  return accountYears === null || identityYears === null
    ? fill(
        catalog.legalHold.connections,
        new Map([["connections", yearsIn(catalog, connectionYears)]])
      )
    : fill(
        catalog.legalHold.identification,
        new Map([
          ["account", yearsIn(catalog, accountYears)],
          ["identity", yearsIn(catalog, identityYears)],
        ])
      );
};

// An account deletion's body, with what the law has the server keep.
const withLegalHold = (
  messages: EmailMessages,
  kept: string | null
): EmailMessages =>
  kept === null ? messages : { ...messages, body: `${messages.body} ${kept}` };

type Acknowledged = Extract<
  AccountEmail,
  { readonly _tag: "ContractRequestAcknowledged" }
>;

// Which words say what became of it: a cancellation that ends on a later
// day its sender asked for renews until then, and a withdrawal from a
// contract that charged nothing refunds nothing.
const outcomeWordsOf = (
  email: Acknowledged
): keyof EmailCatalog["contractRequest"]["outcomes"] => {
  if (
    email.outcome === "cancelled" &&
    email.desiredAt !== null &&
    email.effectiveAt !== null &&
    DateTime.toEpochMillis(email.desiredAt) ===
      DateTime.toEpochMillis(email.effectiveAt)
  ) {
    return "cancelledLater";
  }

  return email.outcome === "withdrawn" && email.refunded === null
    ? "withdrawnUnpaid"
    : email.outcome;
};

// A request's acknowledgement: when it came, what it said, what became of
// it.
const acknowledgementOf = (
  email: Acknowledged,
  { contractRequest: words }: EmailCatalog
): Words => {
  const { locale } = email;

  const body = [
    words.received[email.kind],
    words.content,
    ...(email.desiredAt === null ? [] : [words.desired]),
    words.outcomes[outcomeWordsOf(email)],
    // A cancellation that gives money back: its plan had renewed since.
    ...(email.outcome === "cancelled" && email.refunded !== null
      ? [words.renewalRefunded]
      : []),
  ].join(" ");

  return {
    messages: {
      action:
        email.outcome === "confirm"
          ? words.actions.confirm
          : words.actions.open,
      body,
      ignore: words.ignore,
      subject: words.subjects[email.kind],
    },
    values: new Map([
      [
        "contract",
        email.contract === "" ? words.contractNotGiven : email.contract,
      ],
      [
        "desiredAt",
        email.desiredAt === null ? "" : instantIn(email.desiredAt, locale),
      ],
      [
        "effectiveAt",
        email.effectiveAt === null ? "" : instantIn(email.effectiveAt, locale),
      ],
      ["email", email.to],
      ["name", email.name],
      ["receivedAt", instantIn(email.receivedAt, locale)],
      [
        "refunded",
        email.refunded === null ? "" : moneyIn(email.refunded, locale),
      ],
    ]),
  };
};

const wordsOf = (email: AccountEmail, catalog: EmailCatalog): Words =>
  Match.valueTags(email, {
    AccountDeleted: ({ legalHold, subscriptionsCancelled }): Words => ({
      messages: withBilling(
        withLegalHold(catalog.accountDeleted, legalHoldIn(catalog, legalHold)),
        subscriptionsCancelled,
        catalog.billingEnded.account
      ),
      values: new Map(),
    }),
    ContractRequestAcknowledged: (acknowledged): Words =>
      acknowledgementOf(acknowledged, catalog),
    DataExported: ({ via }): Words => ({
      messages: catalog.dataExported,
      values: new Map([["via", catalog.exportChannels[via]]]),
    }),
    Invitation: (invitation): Words => {
      const roles: ReadonlyMap<string, string> = new Map(
        Object.entries(catalog.roles)
      );

      return {
        messages: catalog.invitation,
        values: new Map([
          [
            "inviterName",
            nameForMail(invitation.inviterName, catalog.withheldNames.person),
          ],
          ["role", roles.get(invitation.role) ?? invitation.role],
          [
            "workspaceName",
            nameForMail(
              invitation.workspaceName,
              catalog.withheldNames.workspace
            ),
          ],
        ]),
      };
    },
    ResetPassword: (): Words => ({
      messages: catalog.resetPassword,
      values: new Map(),
    }),
    TwoStepChanged: ({ kind, recoveryCodesLeft }): Words => ({
      messages: catalog.twoStepChanged[kind],
      values: new Map([
        ["left", recoveryCodesLeftIn(catalog, recoveryCodesLeft ?? 0)],
      ]),
    }),
    VerifyEmail: (): Words => ({
      messages: catalog.verifyEmail,
      values: new Map(),
    }),
    WorkspaceDeleted: ({ subscriptionsCancelled, workspaceName }): Words => ({
      messages: withBilling(
        catalog.workspaceDeleted,
        subscriptionsCancelled,
        catalog.billingEnded.workspace
      ),
      values: new Map([
        [
          "workspaceName",
          nameForMail(workspaceName, catalog.withheldNames.workspace),
        ],
      ]),
    }),
  });

/** An account email's content, in its reader's language. */
export const accountContent = (email: AccountEmail): MessageContent => {
  const { messages, values } = wordsOf(email, catalogs[email.locale]);

  return resolved(messages, values, email.url);
};
