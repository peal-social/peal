import { Schema } from "effect";

/**
 * How an Instagram channel reaches its account, one of Meta's three ways
 * in:
 *
 * - `instagramLogin`: the Instagram API with Instagram Login. The member
 *   signs in to the professional account itself, which needs no Facebook
 *   Page; Peal holds an Instagram user token that lasts 60 days and renews
 *   itself, and calls `graph.instagram.com`.
 * - `facebookLogin`: the Instagram API with Facebook Login. The member signs
 *   in to Facebook and picks among the professional accounts linked to the
 *   Pages they manage; Peal posts with the Page's token, which never
 *   expires, on `graph.facebook.com`.
 * - `unifiedLogin`: the Instagram API with Unified Login, Facebook Login
 *   for Business with a configuration that asks for Instagram accounts.
 *   The member signs in with Instagram or Facebook and shares accounts of
 *   a business portfolio; Peal holds that business's system user token,
 *   which never expires and serves every account it shared, and calls
 *   `graph.facebook.com` with the account's id, no Facebook Page needed.
 *
 * The order here is not the server's preference: the registry decides
 * that.
 */
export const InstagramConnectionSchema = Schema.Literals([
  "instagramLogin",
  "facebookLogin",
  "unifiedLogin",
]);

export type InstagramConnection = typeof InstagramConnectionSchema.Type;
