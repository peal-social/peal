import type { Redacted } from "effect";

import type { SitePlatform } from "#shared/domain/platform.ts";

/** What a website's calls are made with. */
export interface SiteToken {
  /** The site's credential: its user and application password, or a key. */
  readonly credential: Redacted.Redacted;
  readonly platform: SitePlatform;
  /** The root of the site's API, as the channel keeps it. */
  readonly root: string;
}
