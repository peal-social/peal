import type { GenericOAuthConfig } from "better-auth/plugins";
import { Option, Redacted, Schema } from "effect";
import { decodeJwt } from "jose";

import { storableLine } from "#shared/domain/platform-text.ts";

import type {
  OidcProviderSettings,
  SignInProviderClient,
  SignInProviderSettings,
} from "./sign-in-provider-settings.ts";

/**
 * The providers' ids, in the order the pages show them: Better Auth's
 * routes name them (`/sign-in/social`, `/callback/:id`), and the accounts
 * they make are stored under them (`auth.account.provider_id`).
 */
export const signInProviderIds = ["google", "oidc"] as const;

export type SignInProviderId = (typeof signInProviderIds)[number];

/** Google's OpenID Provider, a constant: only its client is a setting. */
export const googleIssuer = "https://accounts.google.com";

/** The most characters of the name a provider gives that an account keeps. */
export const maxProviderUserNameLength = 100;

const discoveryOf = (issuer: string): string =>
  `${issuer}/.well-known/openid-configuration`;

/** What a provider's profile says of the person, as Better Auth hands it. */
export interface ProviderProfile {
  readonly email?: string | null | undefined;
  readonly name?: string | undefined;
}

/**
 * What an account keeps of the profile a provider sends: its name, made
 * storable (a provider's text is not Peal's), or the address's local part
 * when it gives none; never its picture's address.
 */
export const profileToUser = ({ email, name }: ProviderProfile) => {
  const kept = storableLine(name ?? "", maxProviderUserNameLength);

  return {
    image: undefined,
    name:
      kept === ""
        ? storableLine(
            (email ?? "").split("@")[0] ?? "",
            maxProviderUserNameLength
          )
        : kept,
  };
};

// The claims an account is made or found from; any other is left out.
const ClaimsSchema = Schema.Struct({
  email: Schema.optional(Schema.String),
  email_verified: Schema.optional(Schema.Unknown),
  // Google's: the domain Google Workspace manages the address for, which
  // makes Google its authority (provider-admission.ts).
  hd: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  sub: Schema.String,
});

const decodeClaims = Schema.decodeUnknownOption(ClaimsSchema);

const readClaims = (idToken: string) => {
  try {
    return decodeClaims(decodeJwt(idToken));
  } catch {
    return Option.none();
  }
};

/**
 * The profile is the ID token's claims, and nothing but them: Better Auth
 * calls this once it has checked the token's signature, issuer, audience
 * and nonce against the provider's discovery (`requireIdTokenVerification`).
 * An answer without an ID token signs nobody in, rather than falling back to
 * the userinfo endpoint unchecked.
 */
const profileFromIdToken: NonNullable<
  GenericOAuthConfig["getUserInfo"]
> = async ({ idToken }) => {
  await Promise.resolve();

  return idToken === undefined
    ? null
    : Option.getOrNull(
        readClaims(idToken).pipe(
          Option.map(({ email, email_verified, hd, name, sub }) => ({
            email,
            hd,
            // As Better Auth reads the claim: true, or the string some
            // providers send. A missing claim, or any other value, is no
            // confirmation.
            emailVerified: email_verified === true || email_verified === "true",
            name,
            sub,
          }))
        )
      );
};

// Who the person is at the provider: the verified ID token's `sub`, which
// Better Auth checked before it asks (an answer without one names nobody).
const subjectOf = (idToken: string | undefined): string =>
  idToken === undefined
    ? ""
    : Option.getOrElse(
        readClaims(idToken).pipe(Option.map(({ sub }) => sub)),
        () => ""
      );

/**
 * The account id an operator's provider's identity is kept under:
 * `<issuer>|<sub>`. A subject is unique at its issuer only, so a server
 * that moves to another provider never signs the new one's subjects in to
 * the accounts the old one's joined (they join again by a confirmed
 * address). Google's is its `sub` alone: its issuer never changes.
 */
export const oidcAccountId = (issuer: string, subject: string): string =>
  // No subject is no account: Better Auth refuses an empty id.
  subject === "" ? "" : `${issuer}|${subject}`;

const mapProfileToUser: NonNullable<
  GenericOAuthConfig["mapProfileToUser"]
> = async (profile) => {
  await Promise.resolve();

  return profileToUser(profile);
};

// What every provider shares. A sign-in makes an account only when the page
// asks for one (the sign-up page, where the terms are), signing out of Peal
// leaves the provider's own session alone, and the provider's profile never
// overwrites an account's name or address.
const common = (client: SignInProviderClient, issuer: string) =>
  ({
    clientId: client.clientId,
    clientSecret: Redacted.value(client.clientSecret),
    disableImplicitSignUp: true,
    disableProviderLogout: true,
    discoveryUrl: discoveryOf(issuer),
    getUserInfo: profileFromIdToken,
    mapProfileToUser,
    overrideUserInfo: false,
    pkce: true,
    requireIdTokenVerification: true,
  }) satisfies Partial<GenericOAuthConfig>;

/**
 * Google, as the OpenID Provider it is. No `accessType: "offline"`: Peal
 * wants no refresh token, and keeps no token at all.
 */
export const googleProvider = (
  client: SignInProviderClient
): GenericOAuthConfig<"google"> => ({
  ...common(client, client.issuer ?? googleIssuer),
  accountSubject: ({ tokens }) => subjectOf(tokens.idToken),
  name: "Google",
  prompt: "select_account",
  providerId: "google",
  scopes: ["openid", "email", "profile"],
});

/** The OpenID Connect provider a self-hoster set. */
export const oidcProvider = (
  settings: OidcProviderSettings
): GenericOAuthConfig<"oidc"> => ({
  ...common(settings, settings.issuer.replace(/\/+$/u, "")),
  discoveryUrl: settings.discoveryUrl,
  accountSubject: ({ tokens }) =>
    oidcAccountId(
      settings.issuer.replace(/\/+$/u, ""),
      subjectOf(tokens.idToken)
    ),
  name: settings.name,
  providerId: "oidc",
  scopes: [...settings.scopes],
});

/** The generic OAuth plugin's providers, those the server has set. */
export const signInProviderConfigs = (
  settings: SignInProviderSettings
): GenericOAuthConfig<SignInProviderId>[] => [
  ...Option.match(settings.google, {
    onNone: () => [],
    onSome: (client) => [googleProvider(client)],
  }),
  ...Option.match(settings.oidc, {
    onNone: () => [],
    onSome: (oidc) => [oidcProvider(oidc)],
  }),
];
