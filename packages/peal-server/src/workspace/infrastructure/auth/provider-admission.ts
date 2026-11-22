import type {
  GenericEndpointContext,
  ValidateUserInfoSource,
} from "@better-auth/core";
import { getOAuthState } from "better-auth/api";
import { Option, Schema } from "effect";

import { releaseUnconfirmedAccount } from "./sign-up-browser.ts";
import type { SignUpAdmission } from "./sign-up-gate.ts";

/**
 * The codes a provider's sign-in is refused with. The callback writes them
 * into the address it sends the browser back to (`?error=<code>`), so they
 * are lower snake case, and the web app says each in words.
 */
export const providerRefusalCodes = [
  // The provider did not say it confirmed the address (`email_verified`).
  "provider_email_unverified",
  // What the provider gave as the address is none.
  "provider_email_invalid",
  // Google confirmed the address once, but is not its authority: neither a
  // Gmail address nor one of a domain Google Workspace manages (`hd`).
  "provider_email_not_authoritative",
  // The account has two-step verification: it signs in with its password
  // and its code, which a provider's sign-in never asks.
  "two_step_password",
  // The server makes accounts by invitation, and this one names none that
  // went to the address.
  "sign_up_by_invitation",
  // The account is banned, or could not be read.
  "account_banned",
] as const;

export type ProviderRefusalCode = (typeof providerRefusalCodes)[number];

/** What the admission reads of an account that exists. */
export interface StoredStanding {
  readonly banExpires: Date | null;
  readonly banned: boolean;
  readonly twoFactorEnabled: boolean;
}

/** What the admission reads, from the database and the sign-in's state. */
export interface AdmissionReads {
  /** The account as the database holds it now, or null. */
  readonly account: (userId: string) => Promise<StoredStanding | null>;
  /** The invitation the sign-up page named in the sign-in's state. */
  readonly invitationId: () => Promise<string | undefined>;
  readonly now: () => Date;
  readonly signUp: SignUpAdmission;
}

/** What the admission reads of the user Better Auth is about to admit. */
export interface ProvisionedUser {
  readonly source: Pick<ValidateUserInfoSource, "action" | "method"> & {
    /**
     * The provider, and what its ID token says of the address's domain:
     * Google's `hd`, the domain Google Workspace manages it for.
     */
    readonly oauth?:
      | { readonly hd?: string | undefined; readonly providerId: string }
      | undefined;
  };
  readonly user: {
    readonly email?: string | undefined;
    readonly emailVerified?: boolean | undefined;
    readonly id?: string | undefined;
  };
}

const refusal = (error: ProviderRefusalCode) => ({ error });

// The ids Better Auth issues: random, lower-case UUIDs.
const InvitationIdSchema = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
  )
);

const isInvitationId = Schema.is(InvitationIdSchema);

/**
 * Whether Google is the authority for the address, as Google's own guide
 * to its ID tokens says: a Gmail address, or one whose domain Google
 * Workspace manages (`hd`, the same domain). For any other, Google once
 * confirmed the address, but the mailbox may have changed hands since.
 */
export const googleVouchesFor = (
  email: string,
  hd: string | undefined
): boolean => {
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf("@") + 1);

  if (address.endsWith("@gmail.com")) {
    return true;
  }

  return hd !== undefined && hd.trim().toLowerCase() === domain;
};

// An address as the sign-up form takes one: a local part and a domain with
// a dot, no space or control character, 254 characters at most (RFC 5321).
const isAddress = (email: string): boolean =>
  email.length <= 254 &&
  /^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+\.[^\s@\p{Cc}]+$/u.test(email);

const isBanned = (account: StoredStanding, now: Date): boolean =>
  account.banned &&
  (account.banExpires === null || account.banExpires.getTime() > now.getTime());

/**
 * Who a sign-in provider lets in, run by Better Auth before it makes an
 * account (`create-user`), links a provider's identity to an existing one
 * (`link-account`) or signs a linked identity in again (`sign-in`); other
 * ways in are left to their own rules. A refusal is answered, never
 * thrown, and nothing of the address is logged.
 *
 * 1. The provider must have confirmed the address (`email_verified`
 *    true), on every action: an address it did not confirm proves nothing.
 *    Google must also be the address's authority (`googleVouchesFor`).
 * 2. An existing account with two-step verification signs in with its
 *    password: the provider's sign-in has no second step.
 * 3. A new account passes the server's sign-up gate, with the invitation
 *    the sign-up page named.
 */
export const admitProviderUser = async (
  { source, user }: ProvisionedUser,
  reads: AdmissionReads
): Promise<{ readonly error: ProviderRefusalCode } | undefined> => {
  if (source.method !== "oauth") {
    return undefined;
  }

  if (user.emailVerified !== true) {
    return refusal("provider_email_unverified");
  }

  const { email, id } = user;

  if (email === undefined || !isAddress(email)) {
    return refusal("provider_email_invalid");
  }

  if (
    source.oauth?.providerId === "google" &&
    !googleVouchesFor(email, source.oauth.hd)
  ) {
    return refusal("provider_email_not_authoritative");
  }

  if (source.action === "create-user") {
    const invitationId = await reads.invitationId();

    const admitted = await reads
      .signUp(email, isInvitationId(invitationId) ? invitationId : undefined)
      .catch(() => false);

    return admitted ? undefined : refusal("sign_up_by_invitation");
  }

  if (id === undefined) {
    return refusal("account_banned");
  }

  const account = await reads.account(id);

  if (account === null || isBanned(account, reads.now())) {
    return refusal("account_banned");
  }

  return account.twoFactorEnabled ? refusal("two_step_password") : undefined;
};

const StandingSchema = Schema.Struct({
  banExpires: Schema.optional(Schema.NullOr(Schema.Date)),
  banned: Schema.optional(Schema.NullOr(Schema.Boolean)),
  twoFactorEnabled: Schema.optional(Schema.NullOr(Schema.Boolean)),
});

const decodeStanding = Schema.decodeUnknownOption(StandingSchema);

const InvitationStateSchema = Schema.Struct({ invitation: Schema.String });

const decodeInvitationState = Schema.decodeUnknownOption(InvitationStateSchema);

// What Better Auth hands `user.validateUserInfo`: the provider's profile
// is the raw ID token claims sign-in-providers.ts kept.
interface ValidatedUser {
  readonly source: Pick<ValidateUserInfoSource, "action" | "method"> & {
    readonly oauth?:
      | {
          readonly profile?: unknown;
          readonly providerId: string;
        }
      | undefined;
  };
  readonly user: ProvisionedUser["user"];
}

const decodeDomainClaim = Schema.decodeUnknownOption(
  Schema.Struct({ hd: Schema.String })
);

const provisioned = ({ source, user }: ValidatedUser): ProvisionedUser => ({
  source: {
    action: source.action,
    method: source.method,
    oauth:
      source.oauth === undefined
        ? undefined
        : {
            hd: Option.getOrUndefined(
              decodeDomainClaim(source.oauth.profile).pipe(
                Option.map(({ hd }) => hd)
              )
            ),
            providerId: source.oauth.providerId,
          },
  },
  user,
});

/**
 * The admission, as Better Auth's `user.validateUserInfo`. A provider's
 * identity it lets link to an account that never confirmed its address
 * releases that account first (`releaseUnconfirmedAccount`): its password
 * and sessions go, and the provider's sign-in takes it over.
 */
export const providerAdmission =
  (signUp: SignUpAdmission) =>
  async (data: ValidatedUser, ctx: GenericEndpointContext) => {
    const refused = await admitProviderUser(provisioned(data), {
      // From the database, never a session's cached user: a flag turned on
      // a moment ago holds at once.
      account: async (userId) => {
        const found: unknown = await ctx.context.adapter.findOne({
          model: "user",
          where: [{ field: "id", value: userId }],
        });

        return found === null
          ? null
          : Option.getOrNull(
              decodeStanding(found).pipe(
                Option.map((row) => ({
                  banExpires: row.banExpires ?? null,
                  banned: row.banned === true,
                  twoFactorEnabled: row.twoFactorEnabled === true,
                }))
              )
            );
      },
      // What the sign-up page put in the sign-in's state: client-supplied,
      // so only its id shape is taken, and the gate checks the rest.
      invitationId: async () =>
        Option.getOrUndefined(
          decodeInvitationState(await getOAuthState()).pipe(
            Option.map(({ invitation }) => invitation)
          )
        ),
      now: () => new Date(),
      signUp,
    });

    const { id } = data.user;

    if (
      refused === undefined &&
      data.source.method === "oauth" &&
      data.source.action === "link-account" &&
      id !== undefined
    ) {
      await releaseUnconfirmedAccount(ctx, id);
    }

    return refused;
  };
