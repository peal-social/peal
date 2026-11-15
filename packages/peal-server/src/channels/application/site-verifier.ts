import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { AvatarUrl } from "#channels/domain/avatar-url.ts";
import type { SitePlatform } from "#channels/domain/platform.ts";
import type { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { KeySitePlatform } from "#shared/domain/platform.ts";

import type { SiteRefused } from "./site-refused.ts";

/** What a member gives to connect a website. */
export interface SiteSignIn {
  /** The site's address, as a visitor types it. */
  readonly address: string;
  readonly applicationPassword: Redacted.Redacted;
  readonly platform: SitePlatform;
  readonly userName: string;
}

/** What a member gives to connect a website with a key made there. */
export interface SiteKeySignIn {
  readonly apiKey: Redacted.Redacted;
  readonly platform: KeySitePlatform;
}

/** The website, as its own API describes it to the user who signed in. */
export interface VerifiedSite {
  /**
   * The root of the site's API, which every call starts from: what tells
   * one site from another, so a workspace connects each once.
   */
  readonly accountId: string;
  readonly avatarUrl: Option.Option<AvatarUrl>;
  /** The site's name. */
  readonly displayName: Option.Option<string>;
  /** The site's home page, without its scheme, as members tell it. */
  readonly handle: string;
  /** What the user may do there that publishing needs, in its words. */
  readonly scopes: readonly string[];
}

/**
 * Checks, on the website itself, that the user and the password open it to
 * publishing, before anything is kept.
 */
export class SiteVerifier extends Context.Service<
  SiteVerifier,
  {
    readonly verify: (
      signIn: SiteSignIn
    ) => Effect.Effect<VerifiedSite, PlatformUnavailable | SiteRefused>;
    /**
     * The account a key opens, on the platform it was made on, once the
     * platform said the key lets Peal publish: its `accountId` is the
     * platform's own id of it.
     */
    readonly verifyKey: (
      signIn: SiteKeySignIn
    ) => Effect.Effect<VerifiedSite, PlatformUnavailable | SiteRefused>;
  }
>()("peal-server/channels/application/SiteVerifier") {}
