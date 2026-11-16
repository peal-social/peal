import { Schema } from "effect";

/**
 * A sign-in provider's discovery document lacks what OpenID Connect
 * requires of it: the server does not start, rather than offer a button
 * that signs nobody in.
 */
export class SignInProviderUnusable extends Schema.TaggedError<SignInProviderUnusable>()(
  "SignInProviderUnusable",
  { message: Schema.String }
) {}
