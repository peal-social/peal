import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why a website was not connected, for clients to explain:
 *
 * - `notWordPress`: the address leads to no WordPress REST API.
 * - `addressNotAllowed`: the website is not reachable over HTTPS on the
 *   default port at a public address, so Peal refuses to call it.
 * - `credentialsRefused`: the website refused the user name and the
 *   application password.
 * - `cannotPublish`: the website's user may not publish posts or upload
 *   files, which publishing articles needs; on Hashnode, the team's
 *   publication lists the member as a contributor.
 * - `otherWayIn`: the platform connects another way: a WordPress site by
 *   its address, user and application password (`connectSite`), a
 *   publishing platform by the member's key (`connectSiteWithKey`).
 * - `publicationRequired`: the Hashnode member has several publications:
 *   name the one to publish to.
 * - `publicationNotFound`: Hashnode has no such publication.
 * - `planRequired`: the Hashnode publication is not on Hashnode's Pro
 *   plan, which its API needs for every request.
 */
export const SiteNotConnectedReasonSchema = Schema.Literals([
  "notWordPress",
  "addressNotAllowed",
  "credentialsRefused",
  "cannotPublish",
  "otherWayIn",
  "publicationRequired",
  "publicationNotFound",
  "planRequired",
]).annotate({ identifier: "SiteNotConnectedReason" });

export type SiteNotConnectedReason = typeof SiteNotConnectedReasonSchema.Type;

/** The website was not connected. */
export class SiteNotConnected extends Schema.TaggedError<SiteNotConnected>()(
  "SiteNotConnected",
  { ...errorEnvelope, reason: SiteNotConnectedReasonSchema },
  {
    description:
      "The website was not connected; `reason` says why. Nothing was saved.",
    httpApiStatus: 422,
  }
) {}
