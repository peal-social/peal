import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

/**
 * Who may make an account on the server: anyone (`open`), or only an
 * address a workspace invited (`invitation`), and the first account of a
 * server that has none.
 */
export const SignUpModeSchema = Schema.Literals([
  "open",
  "invitation",
]).annotate({ identifier: "SignUpMode" });

export type SignUpMode = typeof SignUpModeSchema.Type;

/**
 * The header a sign-up names its invitation in, on a server where accounts
 * are made by invitation: the id its emailed or copied link carries.
 */
export const signUpInvitationHeader = "x-peal-invitation";

/**
 * An identity provider people may sign in and sign up with, besides their
 * password: Google, or the OpenID Connect provider the server's operator
 * set (`oidc`), with the name its button shows.
 */
export const SignInProviderSchema = Schema.Struct({
  id: Schema.Literals(["google", "oidc"]),
  name: Schema.String,
}).annotate({ identifier: "SignInProvider" });

export type SignInProvider = typeof SignInProviderSchema.Type;

/**
 * Whether signing up and asking for a password reset need a Cloudflare
 * Turnstile token, and the site key the widget is shown with. Clients send
 * the widget's token in the `x-captcha-response` header. It also says who
 * may sign up.
 */
export const CaptchaSchema = Schema.Struct({
  // The providers people may sign in with, in the order to show them; a
  // server that leaves it out offers none.
  signInProviders: Schema.optionalKey(Schema.Array(SignInProviderSchema)),
  // Who may sign up now; a server that leaves it out lets anyone.
  signUp: Schema.optionalKey(SignUpModeSchema),
  // Null when the server asks for no captcha.
  turnstileSiteKey: Schema.NullOr(Schema.String),
}).annotate({ identifier: "Captcha" });

export type Captcha = typeof CaptchaSchema.Type;

/** The captcha the sign-up and password reset forms show, for anyone. */
export class CaptchaApi extends HttpApiGroup.make("captcha").add(
  HttpApiEndpoint.get("get", "/api/captcha", {
    success: CaptchaSchema,
  }).annotateMerge(
    OpenApi.annotations({
      description:
        "Tells whether signing up and requesting a password reset need a Cloudflare Turnstile token, sent as the `x-captcha-response` header of Better Auth's requests, and the site key to show the widget with; and who may sign up (`signUp`): anyone (`open`), or only an address a workspace invited and the first account (`invitation`), where a sign-up names its invitation's id in the `x-peal-invitation` header and must give the address it went to, and Better Auth refuses any other with 403 `SIGN_UP_BY_INVITATION`. A server by invitation that has no account yet answers `open`: its first account may be made. `signInProviders` lists the identity providers people may sign in and sign up with besides their password (`google`, or `oidc` for the OpenID Connect provider the operator set, with the name to show), in order: a sign-in starts at Better Auth's `POST /api/auth/sign-in/social` with the provider's `id`, and the provider must confirm the address. An account with two-step verification signs in with its password and its code, never through a provider. Needs no credentials.",
      summary: "Get the captcha settings",
    })
  )
) {}
