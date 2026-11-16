import { Option, Schema } from "effect";

// The Better Auth error codes the forms explain. Anything else reads as a
// generic failure. Messages live in the catalogues under Auth.errors.
const KnownErrorSchema = Schema.Literals([
  "BANNED_USER",
  "EMAIL_NOT_VERIFIED",
  "INVALID_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_TOKEN",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_SHORT",
  "USER_ALREADY_EXISTS",
  // The workspace's plan has no room for another member.
  "MEMBER_LIMIT_REACHED",
  // The owner who pays for the workspace leaves it, is removed or stops
  // being an owner before handing it over.
  "PAYER_MUST_STAY",
  // The account already owns its one free workspace.
  "FREE_WORKSPACE_LIMIT_REACHED",
  // The captcha's token was missing, or Turnstile refused it.
  "MISSING_RESPONSE",
  "VERIFICATION_FAILED",
  // Two-step verification: a wrong code or recovery code, too many
  // attempts at one sign-in, the account locked for a while, a second
  // step that expired, and turning it on twice.
  "INVALID_CODE",
  "INVALID_BACKUP_CODE",
  "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
  "ACCOUNT_TEMPORARILY_LOCKED",
  "INVALID_TWO_FACTOR_COOKIE",
  "TOTP_ALREADY_ENABLED",
  "INVALID_PASSWORD",
  // Peal's own: an address to confirm first, a workspace that keeps it
  // on, and a workspace that refuses a member without it.
  "EMAIL_NOT_VERIFIED_FOR_TWO_STEP",
  "TWO_STEP_REQUIRED_BY_WORKSPACE",
  "TWO_STEP_REQUIRED",
  // A server where accounts are made by invitation refused the address.
  "SIGN_UP_BY_INVITATION",
]);

export type AuthErrorKey =
  | typeof KnownErrorSchema.Type
  | ProviderErrorKey
  | "AUTHORIZATION_FAILED"
  | "TOO_MANY_REQUESTS"
  | "UNKNOWN";

const decodeKnownError = Schema.decodeUnknownOption(KnownErrorSchema);

/** What a Better Auth client call failed with, as its client reports it. */
export interface AuthClientError {
  readonly code?: string | undefined;
  readonly status: number;
}

/**
 * The catalogue key that explains a failed call: what its code says, the
 * rate limit for an unknown one that answered 429 (an account locked by
 * two-step verification answers 429 with its own code).
 */
export const authErrorKey = (error: AuthClientError): AuthErrorKey =>
  decodeKnownError(error.code).pipe(
    Option.getOrElse((): AuthErrorKey =>
      error.status === 429 ? "TOO_MANY_REQUESTS" : "UNKNOWN"
    )
  );

// What a sign-in provider's callback writes into the address it sends the
// browser back to (`?error=<code>`): Peal's admission's codes and Better
// Auth's. The address can be written by anyone, so only these codes are
// read, and never `error_description`.
const providerErrorKeys = {
  access_denied: "PROVIDER_ACCESS_DENIED",
  account_banned: "PROVIDER_FAILED",
  account_not_linked: "PROVIDER_ACCOUNT_NOT_LINKED",
  email_not_found: "PROVIDER_EMAIL_NOT_FOUND",
  provider_email_invalid: "PROVIDER_EMAIL_INVALID",
  provider_email_not_authoritative: "PROVIDER_EMAIL_NOT_AUTHORITATIVE",
  provider_email_unverified: "PROVIDER_EMAIL_UNVERIFIED",
  sign_up_by_invitation: "SIGN_UP_BY_INVITATION",
  signup_disabled: "PROVIDER_SIGN_UP_DISABLED",
  two_step_password: "PROVIDER_TWO_STEP_PASSWORD",
} as const;

const ProviderCodeSchema = Schema.Literals([
  "access_denied",
  "account_banned",
  "account_not_linked",
  "email_not_found",
  "provider_email_invalid",
  "provider_email_not_authoritative",
  "provider_email_unverified",
  "sign_up_by_invitation",
  "signup_disabled",
  "two_step_password",
]);

const decodeProviderCode = Schema.decodeUnknownOption(ProviderCodeSchema);

const decodeCode = Schema.decodeUnknownOption(Schema.String);

// What Better Auth's provider callback answers on its own: its state and
// its exchange with the provider (`OAUTH_CALLBACK_ERROR_CODES`, `StateError`).
const providerFlowCodes: ReadonlySet<string> = new Set([
  "account_already_linked_to_different_user",
  "email_does_not_match",
  "email_not_verified",
  "internal_server_error",
  "invalid_callback_request",
  "invalid_code",
  "issuer_mismatch",
  "issuer_missing",
  "no_callback_url",
  "no_code",
  "nonce_binding_missing",
  "oauth_provider_not_found",
  "state_generation_error",
  "state_invalid",
  "state_mismatch",
  "state_not_found",
  "unable_to_create_user",
  "unable_to_get_user_info",
  "unable_to_link_account",
]);

// What the OAuth server answers an application's authorization it refuses
// before the person is asked (RFC 6749 and OpenID Connect's codes, and Better
// Auth's own), which it sends to the sign-in page as well. A provider sends
// some of them back to its callback too: those come marked.
const authorizationErrorCodes: ReadonlySet<string> = new Set([
  "account_selection_required",
  "client_disabled",
  "consent_required",
  "interaction_required",
  "invalid_client",
  "invalid_redirect",
  "invalid_redirect_uri",
  "invalid_request",
  "invalid_request_object",
  "invalid_request_uri",
  "invalid_scope",
  "invalid_target",
  "login_required",
  "registration_not_supported",
  "request_not_supported",
  "request_uri_not_supported",
  "server_error",
  "temporarily_unavailable",
  "unauthorized_client",
  "unsupported_response_type",
]);

export type ProviderErrorKey =
  | (typeof providerErrorKeys)[keyof typeof providerErrorKeys]
  | "PROVIDER_FAILED"
  | "PROVIDER_NO_ACCOUNT";

/**
 * The catalogue key (under `Auth.errors`) that explains why a provider's
 * sign-in came back with `error`, or none when the address has none; a
 * plain failure where the server offers no provider. A code the
 * authorization server and providers both send is the application's
 * refusal unless the address carries a provider's mark. An
 * unknown code reads as a failure. Where the server takes no sign-up from
 * anyone, an unknown address is told so without being sent to sign up.
 */
export const providerErrorKey = (
  error: string | readonly string[] | undefined,
  {
    fromProvider,
    providersOffered,
    signUpOffered,
  }: {
    /**
     * Whether the address carries a provider's mark (`cameFromProvider`):
     * else a code both send is the authorization server's.
     */
    readonly fromProvider: boolean;
    /** Whether the server offers a provider: else no error is a provider's. */
    readonly providersOffered: boolean;
    readonly signUpOffered: boolean;
  }
): Option.Option<ProviderErrorKey | "AUTHORIZATION_FAILED" | "UNKNOWN"> => {
  if (error === undefined) {
    return Option.none();
  }

  const code = Option.getOrUndefined(decodeCode(error));

  if (code !== undefined && authorizationErrorCodes.has(code)) {
    // A provider sends the same codes back to its callback.
    return Option.some(
      fromProvider && providersOffered
        ? "PROVIDER_FAILED"
        : "AUTHORIZATION_FAILED"
    );
  }

  // Better Auth sends its other errors here too (its own error page's): on
  // a server without a provider, none of them is one.
  if (!providersOffered || code === undefined) {
    return Option.some("UNKNOWN");
  }

  return Option.some(
    decodeProviderCode(code).pipe(
      Option.map((known): ProviderErrorKey => {
        const key = providerErrorKeys[known];

        return key === "PROVIDER_SIGN_UP_DISABLED" && !signUpOffered
          ? "PROVIDER_NO_ACCOUNT"
          : key;
      }),
      Option.orElse(() =>
        providerFlowCodes.has(code)
          ? Option.some<ProviderErrorKey>("PROVIDER_FAILED")
          : Option.none()
      ),
      Option.getOrElse((): ProviderErrorKey | "UNKNOWN" => "UNKNOWN")
    )
  );
};
