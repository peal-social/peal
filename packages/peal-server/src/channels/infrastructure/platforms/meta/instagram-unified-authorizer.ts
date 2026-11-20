import { DateTime, Duration, Effect, Option, Redacted, Schema } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { AuthorizationDenied } from "#channels/application/authorization-denied.ts";
import { AuthorizationFailed } from "#channels/application/authorization-failed.ts";
import type {
  AccountChoice,
  AuthorizedAccount,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import type { MetaApp } from "#shared/infrastructure/platforms/meta-apps.ts";
import {
  appSecretProof,
  graphApiVersion,
  graphUrl,
} from "#shared/infrastructure/platforms/meta-graph.ts";
import type { MetaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";

import { avatarOf, facebookLoginCallbackPath } from "./facebook-login.ts";
import { exchange, getWith, signInFailure } from "./meta-exchange.ts";
import type { ExchangeFailure, MetaHttp } from "./meta-exchange.ts";

// From Meta's "Instagram API with Unified Login" pages (read 2026-11-20):
// the dialog is Facebook Login for Business's, opened with the
// configuration (`config_id`), which holds the permissions and the assets,
// so no `scope` is sent; the code buys a Business Integration System User
// access token of the client's business portfolio, which "covers every
// asset your client shared with your app"; `/me` is that system user, not
// an Instagram account, and `/me/assigned_instagram_accounts` lists the
// accounts shared, whose `id` is "the same value as the `user_id`" of
// Instagram Login.
const TokenSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
  expires_in: Schema.optionalKey(Schema.Number),
});

const SystemUserSchema = Schema.Struct({ id: Schema.NonEmptyString });

// `debug_token`, read with the app's own token: whether the token is
// valid, the app it was issued for, and the permissions it holds, as the
// configuration granted them.
const DebugTokenSchema = Schema.Struct({
  data: Schema.Struct({
    app_id: Schema.optionalKey(Schema.String),
    is_valid: Schema.optionalKey(Schema.Boolean),
    scopes: Schema.optionalKey(Schema.Array(Schema.String)),
  }),
});

// Meta's pages name `username` among the fields listed, but a row without
// it cannot be a channel's handle: it is left out.
const AssignedAccountSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.optionalKey(Schema.String),
  profile_picture_url: Schema.optionalKey(Schema.String),
  username: Schema.optionalKey(Schema.String),
});

const AssignedAccountsSchema = Schema.Struct({
  data: Schema.Array(AssignedAccountSchema),
  paging: Schema.optionalKey(
    Schema.Struct({
      cursors: Schema.optionalKey(
        Schema.Struct({ after: Schema.optionalKey(Schema.String) })
      ),
      next: Schema.optionalKey(Schema.String),
    })
  ),
});

type AssignedAccount = typeof AssignedAccountSchema.Type;

/**
 * What publishing needs of the configuration: reading the account and
 * publishing for it. A configuration edited without either connects
 * nothing Peal can post with.
 */
export const instagramUnifiedRequiredScopes = [
  "instagram_basic",
  "instagram_content_publish",
] as const;

const accountFields = "id,username,name,profile_picture_url";

// What the listing is asked again for when Meta refuses the profile's
// fields (Graph code 100), which its pages do not promise.
const leanAccountFields = "id,username";

// Whether Meta refused a request's parameters: Graph code 100, with or
// without a subcode.
const refusesParameters = (failure: ExchangeFailure) =>
  failure._tag === "refused" &&
  failure.refusal._tag === "refused" &&
  /^graph100(?:\.\d+)?$/u.test(failure.refusal.code);

// Meta lists a hundred accounts at a time; no business shares more than
// this.
const pageSize = 100;

const maxPages = 10;

/**
 * Instagram professional accounts through Meta's Unified login (the
 * Instagram API with Unified Login): Facebook Login for Business with the
 * operator's configuration (`META_INSTAGRAM_CONFIG_ID`), on Meta's main
 * app. The member signs in with Instagram or Facebook, picks a business
 * portfolio and the accounts to share; no Facebook Page is needed. The
 * code becomes the portfolio's system user token, set in the
 * configuration to never expire, which serves every account shared: each
 * becomes an account to choose, with that token, and `grantedBy` is the
 * system user's app-scoped id. The configuration grants all its
 * permissions or none, so the channel records what `debug_token` says the
 * token holds; one without `instagram_basic` or `instagram_content_publish`
 * is refused. Every Graph call carries `appsecret_proof`.
 */
export const instagramUnifiedAuthorizer = Effect.fn(
  "InstagramUnifiedAuthorizer.make"
)(function* instagramUnifiedAuthorizer(options: {
  readonly app: MetaApp;
  /** The configuration's id, which the dialog opens with. */
  readonly configId: string;
  readonly hosts: MetaHosts;
  readonly http: MetaHttp;
  readonly publicUrl: string;
}) {
  const random = yield* SecureRandom.SecureRandom;
  const mac = yield* Mac.Mac;
  const { app, configId, hosts, http } = options;

  // The callback Instagram's other two sign-ins share: the attempt's
  // connection picks the authorizer.
  const redirectUri = new URL(
    facebookLoginCallbackPath("instagram"),
    options.publicUrl
  ).href;

  // The app's own token, which `debug_token` is read with.
  const appToken = Redacted.make(
    `${app.appId}|${Redacted.value(app.appSecret)}`
  );

  // The request, the member's choices and a reconnect change nothing:
  // the configuration decides what is asked.
  const begin: PlatformAuthorizer["begin"] = () =>
    Effect.gen(function* beginning() {
      const state = Base64Url.encode(yield* random.randomBytes(32));

      const url = new URL(
        `/${graphApiVersion}/dialog/oauth`,
        hosts.facebookDialog
      );

      url.search = new URLSearchParams({
        client_id: app.appId,
        config_id: configId,
        override_default_response_type: "true",
        // Shows the Instagram and the Facebook sign-in alike.
        prompt: "login",
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      }).toString();

      return {
        authorizationUrl: url.href,
        instance: Option.none(),
        // Nothing is kept between the two ends of the sign-in but the
        // state, which the attempt is stored under.
        secret: Redacted.make(""),
        state,
      };
    });

  // A Graph read with a token and its proof, both kept out of traces.
  const read = <A, I>(
    path: string,
    token: Redacted.Redacted,
    params: Readonly<Record<string, Redacted.Redacted | string>>,
    schema: Schema.Codec<A, I>
  ) =>
    appSecretProof(token, app.appSecret).pipe(
      Effect.provideService(Mac.Mac, mac),
      Effect.flatMap((proof) =>
        exchange(
          http,
          getWith(graphUrl(hosts, path), {
            ...params,
            access_token: token,
            appsecret_proof: proof,
          }),
          schema
        )
      )
    );

  // Every account the business shared, a hundred at a time, with the
  // fields given.
  const listedWith = Effect.fnUntraced(function* listedWith(
    token: Redacted.Redacted,
    fields: string
  ) {
    const accounts: AssignedAccount[] = [];
    let after = Option.none<string>();

    for (let round = 0; round < maxPages; round += 1) {
      const listed = yield* read(
        "/me/assigned_instagram_accounts",
        token,
        {
          fields,
          limit: String(pageSize),
          ...Option.match(after, {
            onNone: () => ({}),
            onSome: (cursor) => ({ after: cursor }),
          }),
        },
        AssignedAccountsSchema
      );

      accounts.push(...listed.data);
      after = Option.fromUndefinedOr(listed.paging?.cursors?.after);

      if (listed.paging?.next === undefined || Option.isNone(after)) {
        break;
      }
    }

    return accounts;
  });

  // Every account the business shared: with its name and picture, or,
  // when Meta refuses those fields, by id and username alone.
  const accountsOf = (token: Redacted.Redacted) =>
    listedWith(token, accountFields).pipe(
      Effect.catchIf(refusesParameters, () =>
        Effect.logWarning(
          "Meta refused the shared accounts' profile fields; listing them by id and username"
        ).pipe(Effect.andThen(listedWith(token, leanAccountFields)))
      )
    );

  const complete: PlatformAuthorizer["complete"] = ({ callback }) =>
    Effect.gen(function* completing() {
      if (Option.isNone(callback.code)) {
        return yield* new AuthorizationFailed({
          reason: "the callback has no code",
        });
      }

      const issued = yield* exchange(
        http,
        getWith(graphUrl(hosts, "/oauth/access_token"), {
          client_id: app.appId,
          client_secret: app.appSecret,
          code: Redacted.make(callback.code.value),
          redirect_uri: redirectUri,
        }),
        TokenSchema
      ).pipe(Effect.mapError(signInFailure("The code exchange")));

      const token = Redacted.make(issued.access_token);
      const now = yield* DateTime.now;

      // Never, as the configuration Peal documents sets it; a
      // configuration set to 60 days says when.
      const expiresAt = Option.fromUndefinedOr(issued.expires_in).pipe(
        Option.filter((seconds) => seconds > 0),
        Option.map((seconds) =>
          DateTime.addDuration(now, Duration.seconds(seconds))
        )
      );

      const systemUser = yield* read(
        "/me",
        token,
        { fields: "id,client_business_id" },
        SystemUserSchema
      ).pipe(Effect.mapError(signInFailure("Reading the system user")));

      // Open check, for the sandbox: whether Meta takes `appsecret_proof`
      // on a call made with the app's own token (here, the proof of
      // `app_id|app_secret`), or refuses it; `read` sends one on every
      // call, as through a Page.
      const debugged = yield* read(
        "/debug_token",
        appToken,
        { input_token: token },
        DebugTokenSchema
      ).pipe(Effect.mapError(signInFailure("Reading the token's permissions")));

      // A token Meta no longer takes, or one issued for another app, is
      // not the sign-in Peal started: nothing is connected with it.
      if (debugged.data.is_valid !== true) {
        return yield* new AuthorizationFailed({
          reason: "debug_token says the token is not valid",
        });
      }

      if (debugged.data.app_id !== app.appId) {
        return yield* new AuthorizationFailed({
          reason: "debug_token names another app",
        });
      }

      const granted = debugged.data.scopes ?? [];

      const missing = instagramUnifiedRequiredScopes.filter(
        (scope) => !granted.includes(scope)
      );

      // The configuration grants all its permissions or none: one without
      // these was edited too far, which only the operator can fix.
      if (missing.length > 0) {
        yield* Effect.logWarning(
          "Unified login's configuration lacks a permission publishing needs"
        ).pipe(Effect.annotateLogs({ missing: missing.join(",") }));

        return yield* new AuthorizationDenied();
      }

      const shared = yield* accountsOf(token).pipe(
        Effect.mapError(signInFailure("Listing the Instagram accounts"))
      );

      const accounts = new Map<string, AuthorizedAccount>();

      for (const account of shared) {
        const username = account.username?.trim() ?? "";

        // No handle to show it by: left out, and logged by its id alone.
        if (username === "") {
          yield* Effect.logWarning(
            "Meta listed a shared Instagram account without its username"
          ).pipe(Effect.annotateLogs({ accountId: account.id }));

          continue;
        }

        accounts.set(account.id, {
          accountId: account.id,
          avatarUrl: avatarOf(account.profile_picture_url),
          displayName: Option.fromUndefinedOr(account.name).pipe(
            Option.filter((name) => name.trim() !== "")
          ),
          handle: `@${username}`,
          tokens: {
            accessToken: token,
            expiresAt,
            grantedBy: systemUser.id,
            refreshToken: Option.none(),
            renewable: false,
            scopes: granted,
          },
        });
      }

      const choice: AccountChoice = {
        _tag: "choice",
        accounts: [...accounts.values()],
      };

      return choice;
    });

  const authorizer: PlatformAuthorizer = {
    begin,
    complete,
    connection: "unifiedLogin",
    platform: "instagram",
    policy: tokenPolicies.instagramUnified,
    // The token comes without a refresh token, and renewing it takes the
    // token management API, which Peal does not ask for: one that stops
    // working was revoked, and only reconnecting replaces it. No `revoke`
    // either: one token serves every account the business shared.
    refresh: () => Effect.fail(new TokenExpired()),
  };

  return authorizer;
});
