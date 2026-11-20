import { DateTime, Duration, Effect, Option, Redacted, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { AuthorizationDenied } from "#channels/application/authorization-denied.ts";
import { AuthorizationFailed } from "#channels/application/authorization-failed.ts";
import type {
  AuthorizedAccount,
  IssuedTokens,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { AvatarUrlSchema } from "#channels/domain/avatar-url.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import type { MetaApp } from "#shared/infrastructure/platforms/meta-apps.ts";
import { threadsUrl } from "#shared/infrastructure/platforms/meta-graph.ts";
import type { MetaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";

import {
  exchange,
  getWith,
  postForm,
  refreshFailure,
  signInFailure,
} from "./meta-exchange.ts";
import type { MetaHttp } from "./meta-exchange.ts";

export const threadsCallbackPath = "/connect/threads/callback";

// Reading the account, publishing for it, and saying who may reply to a
// post (`reply_control` needs threads_manage_replies); insights are not
// asked for.
const threadsScopes = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_replies",
] as const;

// Meta's Threads "Get Access Tokens and Permissions" and "Long-Lived Access
// Tokens" pages: the code buys a short-lived token (an hour), which buys a
// long-lived token (60 days), renewed with itself.
const ShortLivedSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
});

const LongLivedSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
  expires_in: Schema.optionalKey(Schema.Number),
});

const ProfileSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.optionalKey(Schema.String),
  threads_profile_picture_url: Schema.optionalKey(Schema.String),
  username: Schema.NonEmptyString,
});

const decodeAvatar = Schema.decodeUnknownOption(AvatarUrlSchema);

// What Threads' `/debug_token` says of a token (Threads' "Debug Access
// Token" page, read 2026-11-21): the permissions the user granted. Threads'
// consent page lists publishing and managing replies as optional, so a
// sign-in may grant less than it asked.
const DebugTokenSchema = Schema.Struct({
  data: Schema.Struct({
    scopes: Schema.optionalKey(Schema.Array(Schema.String)),
  }),
});

// Without it the channel can post nothing: the sign-in is refused, as
// Facebook Login's is.
const publishScope = "threads_content_publish";

// Meta's tokens expire 60 days after they were issued or renewed; an answer
// without `expires_in` is taken to say so.
const lifetimeOf = (expiresIn: number | undefined) =>
  expiresIn === undefined || expiresIn <= 0
    ? Duration.days(60)
    : Duration.seconds(expiresIn);

const issuedNow = Effect.fnUntraced(function* issuedNow(
  token: typeof LongLivedSchema.Type,
  scopes: readonly string[]
) {
  const now = yield* DateTime.now;

  const tokens: IssuedTokens = {
    accessToken: Redacted.make(token.access_token),
    expiresAt: Option.some(
      DateTime.addDuration(now, lifetimeOf(token.expires_in))
    ),
    // The long-lived token renews itself: there is no refresh token.
    refreshToken: Option.none(),
    renewable: true,
    scopes: [...scopes],
  };

  return tokens;
});

/**
 * Threads, through its own OAuth: the Threads use case of Meta's app gives
 * it an app id and secret apart from the main ones. The authorization code
 * is exchanged for a short-lived token, then a long-lived one that lasts 60
 * days and renews itself once a day old: the refresh sweep renews it a week
 * before it expires. A token nobody renewed in 60 days cannot be renewed
 * again, and the user reconnects.
 */
export const threadsAuthorizer = Effect.fn("ThreadsAuthorizer.make")(
  function* threadsAuthorizer(options: {
    readonly app: MetaApp;
    readonly hosts: MetaHosts;
    readonly http: MetaHttp;
    readonly publicUrl: string;
  }) {
    const random = yield* SecureRandom.SecureRandom;
    const { app, hosts, http } = options;
    const redirectUri = new URL(threadsCallbackPath, options.publicUrl).href;

    const begin: PlatformAuthorizer["begin"] = () =>
      Effect.gen(function* beginning() {
        const state = Base64Url.encode(yield* random.randomBytes(32));
        const url = new URL("/oauth/authorize", hosts.threadsAuthorize);

        url.search = new URLSearchParams({
          client_id: app.appId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: threadsScopes.join(","),
          state,
        }).toString();

        return {
          authorizationUrl: url.href,
          instance: Option.none(),
          // Threads keeps nothing between the two ends of the sign-in but
          // the state, which the attempt is stored under.
          secret: Redacted.make(""),
          state,
        };
      });

    const longLived = (shortLived: Redacted.Redacted) =>
      exchange(
        http,
        getWith(new URL("/access_token", hosts.threadsGraph), {
          access_token: shortLived,
          client_secret: app.appSecret,
          grant_type: "th_exchange_token",
        }),
        LongLivedSchema
      );

    const complete: PlatformAuthorizer["complete"] = ({ callback }) =>
      Effect.gen(function* completing() {
        if (Option.isNone(callback.code)) {
          return yield* new AuthorizationFailed({
            reason: "the callback has no code",
          });
        }

        const shortLived = yield* exchange(
          http,
          postForm(new URL("/oauth/access_token", hosts.threadsGraph), {
            client_id: app.appId,
            client_secret: app.appSecret,
            code: Redacted.make(callback.code.value),
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
          ShortLivedSchema
        ).pipe(Effect.mapError(signInFailure("The code exchange")));

        const token = yield* longLived(
          Redacted.make(shortLived.access_token)
        ).pipe(Effect.mapError(signInFailure("The long-lived token exchange")));

        // The permissions the user granted, read with the app's own token
        // (`TH|<app id>|<app secret>`, server side only). A token Threads
        // will not describe keeps what was asked: the post finds out.
        const granted = yield* exchange(
          http,
          getWith(threadsUrl(hosts, "/debug_token"), {
            access_token: Redacted.make(
              `TH|${app.appId}|${Redacted.value(app.appSecret)}`
            ),
            input_token: Redacted.make(token.access_token),
          }),
          DebugTokenSchema
        ).pipe(
          Effect.map(({ data }) =>
            Option.fromUndefinedOr(data.scopes).pipe(
              Option.getOrElse((): readonly string[] => [...threadsScopes])
            )
          ),
          Effect.catch((error) =>
            Effect.logWarning(
              "Threads did not describe a new token: its scopes are taken as asked",
              error
            ).pipe(Effect.as<readonly string[]>([...threadsScopes]))
          )
        );

        if (!granted.includes(publishScope)) {
          yield* Effect.logWarning(
            "A Threads sign-in did not grant publishing"
          );

          return yield* new AuthorizationDenied();
        }

        const profile = yield* exchange(
          http,
          getWith(threadsUrl(hosts, "/me"), {
            access_token: Redacted.make(token.access_token),
            fields: "id,username,name,threads_profile_picture_url",
          }),
          ProfileSchema
        ).pipe(Effect.mapError(signInFailure("Reading the profile")));

        const account: AuthorizedAccount = {
          accountId: profile.id,
          avatarUrl: Option.fromUndefinedOr(
            profile.threads_profile_picture_url
          ).pipe(Option.flatMap(decodeAvatar)),
          displayName: Option.fromUndefinedOr(profile.name).pipe(
            Option.filter((name) => name.trim() !== "")
          ),
          handle: `@${profile.username}`,
          tokens: yield* issuedNow(token, granted),
        };

        return account;
      });

    // The long-lived token is its own refresh token, and keeps the
    // permissions the sign-in granted.
    const refresh: PlatformAuthorizer["refresh"] = (channel, tokens) =>
      exchange(
        http,
        getWith(new URL("/refresh_access_token", hosts.threadsGraph), {
          access_token: tokens.accessToken,
          grant_type: "th_refresh_token",
        }),
        LongLivedSchema
      ).pipe(
        Effect.mapError(refreshFailure),
        Effect.flatMap((renewed) => issuedNow(renewed, channel.scopes))
      );

    const authorizer: PlatformAuthorizer = {
      begin,
      complete,
      platform: "threads",
      policy: tokenPolicies.threads,
      refresh,
    };

    return authorizer;
  }
);
