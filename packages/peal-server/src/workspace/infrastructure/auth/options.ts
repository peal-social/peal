import { apiKey } from "@better-auth/api-key";
import {
  getCurrentAuthEndpointContext,
  tryGetCurrentAuthEndpointContext,
} from "@better-auth/core/context";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { DrizzleAdapterConfig } from "@better-auth/drizzle-adapter/relations-v2";
import { mcp } from "@better-auth/mcp";
import {
  oauthDeviceAuthorization,
  oauthProvider,
} from "@better-auth/oauth-provider";
import type { OAuthOptions, Scope } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import type { Session, User } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import {
  admin,
  genericOAuth,
  jwt,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { Option, Redacted, Schema } from "effect";

import type { SiteMeasurementSettings } from "#shared/application/site-measurement.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { defaultLocale, LocaleSchema } from "#shared/domain/locale.ts";
import type { Locale } from "#shared/domain/locale.ts";
import type { SignUpMethod } from "#shared/domain/product-event.ts";
import { RoleSchema } from "#workspace/domain/roles.ts";

import { accessControl, roles } from "./access-control.ts";
import {
  checkMemberRoom,
  followOwnersAfterLeaving,
  keepPayer,
  keepPayerLeaving,
  refusePersonalSubscriptions,
  stripeBilling,
  turnstile,
} from "./billing.ts";
import type { BillingHooks } from "./billing.ts";
import {
  guardImpersonatedRequest,
  refuseImpersonatedChanges,
} from "./impersonation.ts";
import type { ImpersonationCheck } from "./impersonation.ts";
import {
  apiResourceOf,
  cliClientId,
  mcpResourceOf,
  oauthPages,
  oauthScopes,
  servesMcp,
  workspaceClaim,
} from "./oauth.ts";
import { providerAdmission } from "./provider-admission.ts";
import { guardProviderSignIn } from "./provider-sign-in.ts";
import type { AuthConfiguration } from "./settings.ts";
import { offersProviders } from "./sign-in-provider-settings.ts";
import {
  signInProviderConfigs,
  signInProviderIds,
} from "./sign-in-providers.ts";
import { refuseUnadmittedSignUps } from "./sign-up-gate.ts";
import type { SignUpAdmission } from "./sign-up-gate.ts";
import {
  guardTwoStepChanges,
  forgetTrustedBrowsers,
  noteTwoStepSender,
  refuseLockedOutMembers,
  tellTwoStepChange,
} from "./two-step.ts";
import type { TwoStepPolicy, TwoStepTeller } from "./two-step.ts";
import { expireVisitorCookie, visitorOfSignUp } from "./visitor-cookie.ts";
import { recordWorkspaceChange } from "./workspace-changes.ts";
import type { WorkspaceChangeRecorder } from "./workspace-changes.ts";
import { checkChangedSlug, checkNewSlug } from "./workspace-slugs.ts";

/** A link Better Auth wants mailed, in the recipient's language. */
export interface AuthLink {
  readonly locale: Locale;
  readonly to: string;
  readonly url: string;
}

export interface InvitationLink extends AuthLink {
  readonly inviterName: string;
  readonly role: string;
  readonly workspaceName: string;
}

export type AuthLogLevel = "debug" | "error" | "info" | "warn";

/** An account just made, as product analytics counts it. */
export interface CreatedUser {
  readonly locale: Locale;
  readonly method: SignUpMethod;
  /** Better Auth's id, as it gave it. */
  readonly userId: string;
  /**
   * The site's visitor the request that made the account carried, to link
   * to it: none without one, or where a sign-up links none.
   */
  readonly visitorId: Option.Option<string>;
}

/**
 * What Better Auth calls back into the rest of the server for. The email
 * hooks return at once: Better Auth awaits its email callbacks, and sending
 * inside the request would make the reply slower for known emails than for
 * unknown ones. The billing hooks are awaited.
 */
export interface AuthHooks extends BillingHooks {
  /**
   * Awaited on each request a browser sends in a session staff act as
   * someone in: refuses it once they are no longer staff, and records
   * the changes it asks for.
   */
  readonly impersonatedRequest: ImpersonationCheck;
  readonly invitation: (link: InvitationLink) => void;
  readonly log: (level: AuthLogLevel, message: string) => void;
  readonly resetPassword: (link: AuthLink) => void;
  /** Awaited on each sign-up: whether the server's mode admits the address. */
  readonly signUp: SignUpAdmission;
  /**
   * Awaited on the routes that read or change a workspace, and on turning
   * two-step verification off: what the user's workspaces require.
   */
  readonly twoStep: TwoStepPolicy;
  /** Emails the account what changed in its two-step verification. */
  readonly twoStepChanged: TwoStepTeller;
  /**
   * An account was made: tells product analytics, and returns at once.
   * The made-up user a known address's sign-up answers makes none.
   */
  readonly userCreated: (created: CreatedUser) => void;
  readonly verifyEmail: (link: AuthLink) => void;
  /**
   * Awaited once a route that changes a workspace has answered a browser:
   * keeps the request in the workspace's activity log. Never throws.
   */
  readonly workspaceChange: WorkspaceChangeRecorder;
}

export interface AuthDatabase {
  /**
   * A promise-based Drizzle database (node-postgres), as the adapter awaits
   * its queries, built with the generated relations.
   */
  readonly db: Parameters<typeof drizzleAdapter>[0];
  /** The generated tables, by Better Auth model name. */
  readonly tables: DrizzleAdapterConfig["schema"];
}

export interface AuthDependencies {
  readonly database: AuthDatabase;
  readonly hooks: AuthHooks;
  readonly settings: AuthConfiguration;
  /**
   * Where a sign-up links the site's visitor to the account, and expires
   * the visitor's cookie: none where it links none.
   */
  readonly site: Option.Option<SiteMeasurementSettings>;
}

// Better Auth serves its routes, and writes its links, under this path of
// PUBLIC_URL. The web app forwards /api/* to the server unchanged.
export const authBasePath = "/api/auth";

// Session cookies are named peal.session_token, or __Secure-peal.session_token
// over HTTPS.
export const cookiePrefix = "peal";

// Better Auth passes users as its core type; their locale is an additional
// field it does not type.
const decodeLocaleField = Schema.decodeUnknownOption(
  Schema.Struct({ locale: LocaleSchema })
);

const localeOf = (user: User): Locale =>
  decodeLocaleField(user).pipe(
    Option.match({
      onNone: () => defaultLocale,
      onSome: ({ locale }) => locale,
    })
  );

// The provider a sign-in's callback (`/callback/:id`) names.
const decodeProviderParams = Schema.decodeUnknownOption(
  Schema.Struct({ id: Schema.Literals(signInProviderIds) })
);

/**
 * How an account was made, from the route that made it: a password's
 * sign-up, a provider's callback, or `other` when neither can be read.
 */
export const signUpMethodOf = (
  context: { readonly path?: string; readonly params?: unknown } | null
): SignUpMethod => {
  if (context?.path === "/sign-up/email") {
    return "password";
  }

  return context?.path?.startsWith("/callback/") === true
    ? decodeProviderParams(context.params).pipe(
        Option.match({
          onNone: (): SignUpMethod => "other",
          onSome: ({ id }) => id,
        })
      )
    : "other";
};

const localePrefix = (locale: Locale): string =>
  locale === defaultLocale ? "" : `/${locale}`;

/** The web app's page that answers an invitation, in the reader's language. */
export const invitationUrl = (
  publicUrl: string,
  locale: Locale,
  invitationId: string
): string => `${publicUrl}${localePrefix(locale)}/invitations/${invitationId}`;

const isRole = Schema.is(RoleSchema);

// A member holds one role. Better Auth would store several, comma-separated,
// which the emails and the web app would show as they are.
const oneRole = async (role: string): Promise<void> => {
  if (!isRole(role)) {
    throw APIError.from("BAD_REQUEST", {
      code: "ONE_ROLE_PER_MEMBER",
      message: "A member holds exactly one role",
    });
  }

  await Promise.resolve();
};

const thirtyDays = 60 * 60 * 24 * 30;

const oneDay = 60 * 60 * 24;

const fiveMinutes = 5 * 60;

const oneHour = 60 * 60;

const oneWeek = 7 * oneDay;

/** How long an invitation's link works, in seconds. */
export const invitationLifetime = oneWeek;

/** How many invitations a workspace may have pending, unexpired, at once. */
export const pendingInvitationLimit = 100;

const fifteenMinutes = 15 * 60;

const refreshReplayWindow = 30;

const decodeWorkspaceId = Schema.decodeUnknownOption(WorkspaceIdSchema);

const decodePickedWorkspace = Schema.decodeUnknownOption(
  Schema.Struct({ activeOrganizationId: WorkspaceIdSchema })
);

// The workspace the user picked for an OAuth client: the one they made their
// session's active workspace on the picker page.
const pickedWorkspace = (session: Session): Option.Option<WorkspaceId> =>
  decodePickedWorkspace(session).pipe(
    Option.map(({ activeOrganizationId }) => activeOrganizationId)
  );

const isMember = async (
  userId: string,
  workspaceId: WorkspaceId
): Promise<boolean> => {
  const { adapter } = getCurrentAuthEndpointContext().context;

  const found = await adapter.findOne({
    model: "member",
    select: ["id"],
    where: [
      { field: "userId", value: userId },
      { field: "organizationId", value: workspaceId },
    ],
  });

  return found !== null;
};

// MCP clients register themselves, when the server allows it, with the
// right to ask for reading; writing, publishing and ads they may ask for
// too, and the user then agrees to each or not on the consent page.
const dynamicClientRegistration: Partial<OAuthOptions<Scope[]>> = {
  allowDynamicClientRegistration: true,
  allowUnauthenticatedClientRegistration: true,
  clientRegistrationAllowedScopes: [
    "workspace:write",
    "workspace:publish",
    "workspace:ads",
  ],
  clientRegistrationDefaultApplicationType: "infer",
  clientRegistrationDefaultScopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "workspace:read",
  ],
};

/**
 * The OAuth authorization server, for the HTTP API and the MCP endpoint.
 * Access tokens are JWTs that resource servers check locally, so they are
 * short-lived; refresh tokens renew them, once each.
 *
 * Better Auth's MCP plugin refuses an MCP endpoint that is neither HTTPS nor
 * on a loopback host, as MCP clients do. A server whose PUBLIC_URL is plain
 * HTTP elsewhere, as on a home network, still starts and signs the command
 * line in: it runs the same OAuth provider, with the same tables, without
 * the MCP resource, so no token is ever issued for its MCP endpoint.
 */
const oauthServer = (settings: AuthConfiguration) => {
  const options: OAuthOptions<Scope[]> = {
    accessTokenExpiresIn: fifteenMinutes,
    cachedTrustedClients: new Set([cliClientId]),
    consentPage: oauthPages.consent,
    // A token issued after the user picked a workspace is bound to it.
    // Renewing a token passes the reference it was stored with, which
    // is null for the command line's.
    customAccessTokenClaims: ({ referenceId }) =>
      Option.match(decodeWorkspaceId(referenceId), {
        onNone: () => ({}),
        onSome: (workspaceId) => ({ [workspaceClaim]: workspaceId }),
      }),
    // No client credentials grant: scripts use API keys.
    grantTypes: ["authorization_code", "refresh_token"],
    loginPage: oauthPages.signIn,
    // The workspace picker. Every authorization asks which workspace the
    // client may use, rather than taking the one the user last opened,
    // and the consent is kept per workspace.
    postLogin: {
      consentReferenceId: ({ session }) =>
        Option.getOrThrowWith(pickedWorkspace(session), () =>
          APIError.from("BAD_REQUEST", {
            code: "WORKSPACE_REQUIRED",
            message: "Pick the workspace the client may use",
          })
        ),
      page: oauthPages.workspace,
      // Coming back from the picker, the user must still belong to the
      // workspace they picked.
      shouldRedirect: async ({ isContinuation, session, user }) => {
        const picked = pickedWorkspace(session);

        return (
          !isContinuation ||
          Option.isNone(picked) ||
          !(await isMember(user.id, picked.value))
        );
      },
    },
    // A refresh token sent again within this window gets the answer it got
    // the first time, as when two commands renew the same saved sign-in or
    // a client retries after losing the answer. Sent again later, it reads
    // as stolen, and every refresh token of its user and client is revoked:
    // for the command line, its sign-ins on every machine.
    refreshTokenReuseInterval: refreshReplayWindow,
    resources: [apiResourceOf(settings.publicUrl)],
    scopes: oauthScopes,
  };

  const provider = settings.dynamicClientRegistration
    ? { ...options, ...dynamicClientRegistration }
    : options;

  return servesMcp(settings.publicUrl)
    ? mcp({ ...provider, resource: mcpResourceOf(settings.publicUrl) })
    : oauthProvider(provider);
};

// Every route's before hook. A request staff send while acting as someone
// is checked and recorded first, refused or not. Then what two-step
// verification decides: a workspace's routes for a member it refuses, and
// turning it on or off, and a sign-up the server's mode does not admit,
// and a provider's sign-in that asks for more than Peal's pages do.
const beforeEveryRoute = (hooks: AuthHooks) =>
  createAuthMiddleware(async (ctx) => {
    await guardImpersonatedRequest(ctx, hooks.impersonatedRequest);
    await refuseUnadmittedSignUps(ctx, hooks.signUp);
    guardProviderSignIn(ctx);
    await refuseImpersonatedChanges(ctx);
    refusePersonalSubscriptions(ctx);
    await keepPayerLeaving(ctx, hooks);
    await refuseLockedOutMembers(ctx, hooks.twoStep);
    await guardTwoStepChanges(ctx, hooks.twoStep);
    await noteTwoStepSender(ctx);
  });

// The columns of `auth.account` that hold what a provider issued. Peal needs
// none of it once the person is signed in, so a sign-in provider's account
// keeps only who it is (`account_id`, the provider's subject).
const withoutProviderTokens = <A extends Readonly<Record<string, unknown>>>(
  account: A
) =>
  signInProviderIds.some((id) => id === account["providerId"])
    ? {
        data: {
          ...account,
          accessToken: null,
          accessTokenExpiresAt: null,
          idToken: null,
          refreshToken: null,
          refreshTokenExpiresAt: null,
          scope: null,
        },
      }
    : { data: account };

// A provider's sign-up keeps the language of the page it started on, which
// the sign-up page put in the sign-in's state, as a password sign-up sends
// it in its body. No state, as on a password sign-up: nothing changes.
const localeOfProviderSignUp = async <
  U extends Readonly<Record<string, unknown>>,
>(
  user: U
) => {
  const state: unknown = await getOAuthState();
  const locale = decodeLocaleField(state);

  return Option.isSome(locale)
    ? { data: { ...user, locale: locale.value.locale } }
    : { data: user };
};

/**
 * The Better Auth instance: email and password with verification, workspaces
 * (the organization plugin), staff tools (the admin plugin), API keys owned
 * by workspaces, and the OAuth authorization server that MCP clients and the
 * command line sign in with (the MCP and device authorization plugins, which
 * sign their tokens with the JWT plugin's keys). On a server configured for
 * them, Cloudflare Turnstile on sign-ups and password resets (the captcha
 * plugin) and workspace subscriptions through Stripe (the Stripe plugin).
 *
 * Every other plugin is always on, and options that shape tables are
 * constants. The captcha plugin has no table, and `scripts/auth-schema.ts`
 * generates the tables with the Stripe plugin on, which Better Auth runs
 * without when billing is off, so every deployment has the same tables.
 */
export const makeAuth = ({
  database,
  hooks,
  settings,
  site,
}: AuthDependencies) =>
  betterAuth({
    account: {
      // A provider reaches an account only through an address both sides
      // confirmed: the provider's `email_verified`, on each sign-in, and the
      // account's own (Better Auth's `requireLocalEmailVerified`, on by
      // default). No provider is trusted without it, an address never
      // links to another, and a link copies nothing onto the account.
      accountLinking: {
        allowDifferentEmails: false,
        enabled: true,
        trustedProviders: [],
        updateUserInfoOnLink: false,
      },
      encryptOAuthTokens: true,
      // A sign-in again writes no token: Peal keeps none of a provider's.
      updateAccountOnSignIn: false,
    },
    advanced: {
      cookiePrefix,
      // Better Auth leaves out its check of the addresses a request asks
      // to be sent back to (callbackURL and the like) when NODE_ENV is
      // test: written here, tests run it as production does.
      disableOriginCheck: false,
      database: { generateId: "uuid" },
      ipAddress: {
        ipAddressHeaders: [...settings.ipAddressHeaders],
        trustedProxies: [...settings.trustedProxies],
      },
    },
    appName: "Peal",
    basePath: authBasePath,
    baseURL: settings.publicUrl,
    database: drizzleAdapter(database.db, {
      provider: "pg",
      schema: database.tables,
      schemaName: "auth",
      transaction: true,
    }),
    // API keys go through Peal's own API only (/api/workspaces/:id/api-keys):
    // their permissions are the server's to set, and staff impersonating a
    // member may not see or revoke them, which Better Auth's routes ignore.
    //
    // The JWT plugin's session tokens would be signed with the keys that sign
    // OAuth access tokens; the device grant's session tokens bypass OAuth.
    // OAuth clients are registered by the server (the command line's) or by
    // MCP clients themselves, never by signed-in users.
    //
    // Workspaces and accounts are deleted through Peal's API too
    // (DELETE /api/workspaces/:id and DELETE /api/me), which delete what
    // every context keeps: the admin plugin's removal of a user would leave
    // their notices, preferences and the workspaces they alone belonged to.
    // Staff ban accounts instead.
    //
    // Staff act through the staff console (/api/admin), which records each
    // action in the audit log and calls the admin plugin on the server. Its
    // own routes would act unrecorded, or show sessions' addresses: only
    // stop-impersonating stays, which the impersonation banner calls.
    disabledPaths: [
      "/admin/ban-user",
      "/admin/create-user",
      "/admin/get-user",
      "/admin/has-permission",
      "/admin/impersonate-user",
      "/admin/list-user-sessions",
      "/admin/list-users",
      "/admin/remove-user",
      "/admin/revoke-user-session",
      "/admin/revoke-user-sessions",
      "/admin/set-role",
      "/admin/set-user-password",
      "/admin/unban-user",
      "/admin/update-user",
      // A provider reaches an account only by a confirmed address on both
      // sides, never by a link the person asks for, and Peal keeps none of
      // a provider's tokens to hand out or renew.
      "/account-info",
      "/get-access-token",
      "/link-social",
      "/refresh-token",
      "/unlink-account",
      "/api-key/create",
      "/api-key/delete",
      "/api-key/get",
      "/api-key/list",
      "/api-key/update",
      "/device/token",
      "/oauth2/client/rotate-secret",
      "/oauth2/create-client",
      "/oauth2/delete-client",
      "/oauth2/get-client",
      "/oauth2/get-clients",
      "/oauth2/update-client",
      "/organization/delete",
      "/token",
    ],
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            await Promise.resolve();

            return withoutProviderTokens(account);
          },
        },
        update: {
          before: async (account) => {
            await Promise.resolve();

            return withoutProviderTokens(account);
          },
        },
      },
      user: {
        create: {
          after: async (user, context) => {
            await Promise.resolve();

            hooks.userCreated({
              locale: localeOf(user),
              method: signUpMethodOf(context),
              userId: user.id,
              visitorId: visitorOfSignUp(context, site),
            });
          },
          before: localeOfProviderSignUp,
        },
      },
    },
    emailAndPassword: {
      // A sign-up for an email that already has an account answers with a
      // made-up user. Built with the admin plugin's fields, it reads the same
      // as a real one; `additionalFields` holds the defaults of the others
      // (the locale, two-step verification's flag).
      customSyntheticUser: ({ additionalFields, coreFields, id }) => ({
        ...coreFields,
        banExpires: null,
        banReason: null,
        banned: false,
        locale: defaultLocale,
        role: "user",
        ...additionalFields,
        id,
      }),
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: settings.requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ url, user }) => {
        hooks.resetPassword({ locale: localeOf(user), to: user.email, url });

        await Promise.resolve();
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ url, user }) => {
        hooks.verifyEmail({ locale: localeOf(user), to: user.email, url });

        await Promise.resolve();
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        await recordWorkspaceChange(ctx, hooks.workspaceChange);
        await forgetTrustedBrowsers(ctx);
        await tellTwoStepChange(ctx, hooks.twoStepChanged);
        await followOwnersAfterLeaving(ctx, hooks);
        expireVisitorCookie(ctx, site);
      }),
      before: beforeEveryRoute(hooks),
    },
    // A provider's callback that fails before its state is read sends the
    // browser back to Peal's sign-in page, never to Better Auth's own.
    onAPIError: { errorURL: `${settings.publicUrl}/sign-in` },
    logger: {
      level: "warn",
      // Messages only: Better Auth passes request details as further
      // arguments, which must not reach the logs.
      log: (level, message) => {
        hooks.log(level, message);
      },
    },
    plugins: [
      organization({
        ac: accessControl,
        allowUserToCreateOrganization: true,
        cancelPendingInvitationsOnReInvite: true,
        creatorRole: "owner",
        invitationExpiresIn: invitationLifetime,
        invitationLimit: pendingInvitationLimit,
        organizationHooks: {
          // Its creator pays for it: it joins their billing account.
          afterCreateOrganization: async ({
            organization: workspace,
            user,
          }) => {
            await hooks.workspaceCreated(workspace.id, user.id);
          },
          // Its billing account follows its owners, on a server that
          // bills or not: a payer who is no longer an owner pays for it no
          // more.
          afterRemoveMember: async ({ member }) => {
            await hooks.ownersChanged(member.organizationId);
          },
          afterUpdateMemberRole: async ({ member }) => {
            await hooks.ownersChanged(member.organizationId);
          },
          // An invitation is accepted, or a member added, only while the
          // workspace's plan has room for one more.
          beforeAcceptInvitation: async ({ invitation }) => {
            await checkMemberRoom(
              hooks,
              invitation.organizationId,
              Option.none()
            );
          },
          beforeAddMember: async ({ member }) => {
            await oneRole(member.role);
            await checkMemberRoom(hooks, member.organizationId, Option.none());
          },
          // A workspace's slug names its pages in the web app's addresses:
          // one the app can route, when it is made and when it changes.
          beforeCreateOrganization: async ({ organization: workspace }) => {
            await checkNewSlug(workspace.slug);
          },
          beforeUpdateOrganization: async ({ organization: workspace }) => {
            await checkChangedSlug(workspace);
          },
          beforeCreateInvitation: async ({ invitation }) => {
            await oneRole(invitation.role);
            await checkMemberRoom(
              hooks,
              invitation.organizationId,
              Option.some(invitation.email)
            );
          },
          // A workspace's API keys go with it: they refer to it by id alone,
          // with no foreign key, and would otherwise outlive it. They go
          // first, so that a failure may leave a workspace without its keys,
          // never keys without their workspace. The route that runs this is
          // disabled: Peal's DeleteWorkspace deletes workspaces, and asks
          // billing first.
          beforeDeleteOrganization: async (
            { organization: workspace },
            ctx
          ) => {
            const { adapter } = (ctx ?? getCurrentAuthEndpointContext())
              .context;

            await adapter.deleteMany({
              model: "apikey",
              where: [{ field: "referenceId", value: workspace.id }],
            });
          },
          // The workspace's payer stays one of its owners until they hand
          // it to another payer.
          beforeRemoveMember: async ({ member }) => {
            await keepPayer(hooks, {
              organizationId: member.organizationId,
              role: Option.none(),
              userId: member.userId,
            });
          },
          beforeUpdateMemberRole: async ({ member, newRole }) => {
            await oneRole(newRole);
            await keepPayer(hooks, {
              organizationId: member.organizationId,
              role: Option.some(newRole.split(",").map((role) => role.trim())),
              userId: member.userId,
            });
          },
        },
        requireEmailVerificationOnInvitation: true,
        roles,
        sendInvitationEmail: async ({
          id,
          email,
          invitation,
          inviter,
          organization: workspace,
        }) => {
          // In the reader's language: the invitee's, when they have an
          // account, otherwise the inviter's.
          const invitee =
            await tryGetCurrentAuthEndpointContext()?.context.internalAdapter.findUserByEmail(
              email
            );

          const locale = localeOf(invitee?.user ?? inviter.user);

          hooks.invitation({
            inviterName: inviter.user.name,
            locale,
            role: invitation.role,
            to: email,
            url: invitationUrl(settings.publicUrl, locale, id),
            workspaceName: workspace.name,
          });
        },
      }),
      admin({ adminRoles: ["admin"], impersonationSessionDuration: oneHour }),
      apiKey({
        defaultPrefix: "peal_",
        enableMetadata: true,
        keyExpiration: { defaultExpiresIn: null, maxExpiresIn: 365 },
        // Peal counts a key's requests itself, with those of OAuth
        // applications (RequestLimits): the plugin's own limit, which
        // starts its window again at every request, stays off. These
        // become the defaults of the apikey table's columns, so they stay
        // constants.
        rateLimit: { enabled: false, maxRequests: 600, timeWindow: 60_000 },
        references: "organization",
        requireName: true,
      }),
      // Signs OAuth access tokens and publishes its keys at /api/auth/jwks.
      jwt({ disableSettingJwtHeader: true }),
      // Two-step verification: a code from an authenticator app, or a
      // recovery code, after the password. It comes before the OAuth
      // server, as Better Auth runs plugins' after hooks in this order:
      // on a sign-in during an authorization, its hook must delete the
      // session the password made before the OAuth server's resumes the
      // authorization with it. Its options are the library's own, but the
      // issuer the authenticator app shows.
      twoFactor({ issuer: "Peal" }),
      // Google, and the OpenID Connect provider a self-hoster set, as
      // Better Auth's social providers (`/sign-in/social`,
      // `/callback/:id`): only on a server that set one, as the plugin has
      // no table. It comes after two-step verification and before the
      // OAuth server, whose after hook resumes an authorization once the
      // callback has signed the person in.
      ...(offersProviders(settings.signInProviders)
        ? [
            genericOAuth({
              config: signInProviderConfigs(settings.signInProviders),
            }),
          ]
        : []),
      oauthServer(settings),
      // The command line's sign-in (RFC 8628): it shows a code, which the
      // user enters on the web app's /device page.
      oauthDeviceAuthorization({
        expiresIn: "10m",
        interval: "5s",
        verificationUri: oauthPages.device,
      }),
      ...Option.match(settings.captcha, {
        onNone: () => [],
        onSome: (captcha) => [turnstile(captcha)],
      }),
      ...Option.match(settings.stripe, {
        onNone: () => [],
        onSome: (billing) => [
          stripeBilling(billing, hooks, (message) => {
            hooks.log("warn", message);
          }),
        ],
      }),
    ],
    rateLimit: {
      // Stripe retries its webhooks, whose signature is their guard.
      customRules: { "/stripe/webhook": false },
      enabled: settings.production,
      storage: "database",
    },
    secret: Redacted.value(settings.secret),
    session: {
      cookieCache: { enabled: true, maxAge: fiveMinutes },
      expiresIn: thirtyDays,
      updateAge: oneDay,
    },
    telemetry: { enabled: false },
    trustedOrigins: [...settings.trustedOrigins],
    user: {
      // Who a sign-in provider lets in (provider-admission.ts): a confirmed
      // address, no two-step verification, and the sign-up gate.
      validateUserInfo: providerAdmission(hooks.signUp),
      additionalFields: {
        // Whether the person allows the web app to link what they do in it
        // to their account and to record their sessions, and when they
        // chose: set by Peal's consent endpoint alone, on the server's
        // clock, never through a sign-up or `updateUser` (`input: false`),
        // and never in Better Auth's answers.
        browserAnalyticsConsent: {
          input: false,
          required: false,
          returned: false,
          type: ["granted", "refused"],
        },
        browserAnalyticsConsentAt: {
          input: false,
          required: false,
          returned: false,
          type: "date",
        },
        locale: {
          defaultValue: defaultLocale,
          input: true,
          required: false,
          type: [...LocaleSchema.literals],
        },
      },
    },
  });

export type PealAuth = ReturnType<typeof makeAuth>;
