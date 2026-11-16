import { Context, Effect, Layer } from "effect";

/** An identity provider the server lets people sign in with. */
export interface OfferedSignInProvider {
  readonly id: "google" | "oidc";
  /** What the pages' button names it. */
  readonly name: string;
}

/**
 * The identity providers people may sign in and sign up with besides their
 * password, in the order the pages show them: Google, then the OpenID
 * Connect provider the operator set. None until their settings are given.
 */
export class SignInProviders extends Context.Service<
  SignInProviders,
  {
    /** Those whose provider answers now: one may come back later. */
    readonly offered: Effect.Effect<readonly OfferedSignInProvider[]>;
  }
>()("peal-server/workspace/application/SignInProviders") {
  /** For tests: a server offering these. */
  static readonly layerTest = (offered: readonly OfferedSignInProvider[]) =>
    Layer.succeed(
      SignInProviders,
      SignInProviders.of({ offered: Effect.succeed(offered) })
    );
}
