import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { Authentication } from "./authentication.ts";
import { BrowserAnalyticsSchema } from "./browser-analytics.ts";
import { Forbidden } from "./forbidden.ts";
import { PermissionSchema } from "./permission.ts";
import { Unauthenticated } from "./unauthenticated.ts";

/** A workspace the user belongs to, with their role and what it allows. */
export const MembershipSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  permissions: Schema.Array(PermissionSchema),
  role: Schema.String,
  slug: Schema.String,
  // The workspace requires two-step verification of its members: while the
  // user's account does not have it on, the workspace refuses them
  // (Forbidden, `twoStepRequired`).
  twoStepRequired: Schema.Boolean,
}).annotate({ identifier: "Membership" });

export type Membership = typeof MembershipSchema.Type;

/** The signed-in user and their workspaces. */
export const MeSchema = Schema.Struct({
  // How the web app measures its use for this person: null where the
  // server does not measure it (no product analytics, or not for the web
  // app), in a session staff act in, and for a person the operator
  // excluded. Left out by servers older than it.
  browserAnalytics: Schema.optionalKey(Schema.NullOr(BrowserAnalyticsSchema)),
  // Staff impersonating the user, if any.
  impersonatedBy: Schema.NullOr(Schema.String),
  user: Schema.Struct({
    email: Schema.String,
    emailVerified: Schema.Boolean,
    id: Schema.String,
    image: Schema.NullOr(Schema.String),
    locale: Schema.Literals(["en", "fr"]),
    name: Schema.String,
    // Whether the account has a password. One made through a sign-in
    // provider has none until it sets one through a password reset; the
    // account's deletion and two-step verification ask for it.
    hasPassword: Schema.optionalKey(Schema.Boolean),
    // Whether the account has two-step verification on.
    twoStepEnabled: Schema.Boolean,
  }),
  workspaces: Schema.Array(MembershipSchema),
}).annotate({ identifier: "Me" });

export type Me = typeof MeSchema.Type;

export class SessionApi extends HttpApiGroup.make("session")
  .add(
    HttpApiEndpoint.get("me", "/api/me", {
      error: [Forbidden, Unauthenticated],
      success: MeSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Answers with the signed-in user and every workspace they belong to, with their role and permissions in each, whether the account has two-step verification on and a password, and whether each workspace requires it (a workspace that requires it refuses the user while it is off). Where the server measures the web app's use, it also says how, with the person's choice about it. API keys belong to a workspace, not a user, and get 403.",
        summary: "Get the signed-in user",
      })
    )
  )
  .middleware(Authentication) {}
