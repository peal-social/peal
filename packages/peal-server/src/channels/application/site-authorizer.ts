import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { OAuthSitePlatform } from "#shared/domain/platform.ts";

import type { AuthorizationFailed } from "./authorization-failed.ts";
import type { SiteRefused } from "./site-refused.ts";
import type { VerifiedSite } from "./site-verifier.ts";

/** A sign-in on the website's platform the member is sent to. */
export interface PendingSiteSignIn {
  readonly authorizationUrl: string;
  /** Names the sign-in in the callback. */
  readonly state: string;
}

/** What a completed sign-in gave: the site, and the token to keep. */
export interface SiteGrant {
  readonly accessToken: Redacted.Redacted;
  readonly site: VerifiedSite;
}

/**
 * One website platform's sign-in (OAuth 2.0's authorization code flow):
 * where to send the member, then the site and the token the code is
 * exchanged for, once the site says the member may publish there.
 */
export interface SiteAuthorizer {
  readonly platform: OAuthSitePlatform;
  readonly begin: Effect.Effect<PendingSiteSignIn>;
  readonly complete: (
    code: string
  ) => Effect.Effect<
    SiteGrant,
    AuthorizationFailed | PlatformUnavailable | SiteRefused
  >;
}

/** The website sign-ins this server has, by platform. */
export class SiteAuthorizers extends Context.Service<
  SiteAuthorizers,
  {
    /** The platform's sign-in, if the server has its app. */
    readonly for: (
      platform: OAuthSitePlatform
    ) => Option.Option<SiteAuthorizer>;
  }
>()("peal-server/channels/application/SiteAuthorizers") {}
