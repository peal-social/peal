import { DateTime, Duration, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { AuthorizationFailed } from "#channels/application/authorization-failed.ts";
import type {
  Authorized,
  IssuedTokens,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { AvatarUrlSchema } from "#channels/domain/avatar-url.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import type { OAuthClient } from "#channels/infrastructure/platforms/oauth-client.ts";
import {
  bodyOf,
  exchanged,
  oauthErrorOf,
  randomTexts,
  scopesOf,
  TokenAnswerSchema,
} from "#channels/infrastructure/platforms/oauth-exchange.ts";
import type {
  AuthorizerHttp,
  TokenAnswer,
} from "#channels/infrastructure/platforms/oauth-exchange.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  isProfileId,
  plainErrorCodeOf,
  snapchatAuthorizePath,
  snapchatEnvelopeOf,
  snapchatTokenPath,
  succeeded,
} from "#shared/infrastructure/platforms/snapchat-api.ts";
import type {
  SnapchatEnvelope,
  SnapchatHosts,
} from "#shared/infrastructure/platforms/snapchat-api.ts";

export const snapchatCallbackPath = "/connect/snapchat/callback";

/**
 * What Peal asks a Snapchat account for: the Public Profile API
 * (`snapchat-profile-api`), which reads the profile and posts to it. The
 * Marketing API's and the Offline Conversions API's scopes are not asked.
 */
export const snapchatScopes: readonly string[] = ["snapchat-profile-api"];

// "Get Profile ID by Auth Token": the profile of the account that signed in.
const ProfileAnswerSchema = Schema.Struct({
  public_profile: Schema.optionalKey(
    Schema.Struct({
      display_name: Schema.optionalKey(Schema.NullOr(Schema.String)),
      id: Schema.String,
      logo_urls: Schema.optionalKey(
        Schema.NullOr(
          Schema.Struct({
            manage_profile_logo_url: Schema.optionalKey(
              Schema.NullOr(Schema.String)
            ),
            original_logo_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
          })
        )
      ),
      snap_user_name: Schema.optionalKey(Schema.NullOr(Schema.String)),
    })
  ),
  request_status: Schema.String,
});

type ProfileAnswer = typeof ProfileAnswerSchema.Type;

type Profile = NonNullable<ProfileAnswer["public_profile"]>;

const decodeAvatar = Schema.decodeUnknownOption(AvatarUrlSchema);

// Errors that name Peal's client rather than the member's tokens: the
// operator's settings are wrong, and no channel should be blamed for it.
const clientErrors: ReadonlySet<string> = new Set([
  "invalid_client",
  "unauthorized_client",
]);

const nonBlank = (text: string | null | undefined) =>
  Option.fromNullishOr(text).pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== "")
  );

const tokensOf = (
  answer: TokenAnswer,
  issuedAt: DateTime.Utc,
  stored: Option.Option<Redacted.Redacted>
): IssuedTokens => {
  // The answer's refresh token replaces the one sent; an answer without one
  // keeps it. Snap does not say whether a refresh replaces it; on
  // 2026-11-26 one answered the same refresh token.
  const refreshToken = Option.fromUndefinedOr(answer.refresh_token).pipe(
    Option.map((token) => Redacted.make(token)),
    Option.orElse(() => stored)
  );

  return {
    accessToken: Redacted.make(answer.access_token),
    expiresAt: Option.some(
      DateTime.addDuration(
        issuedAt,
        Option.fromUndefinedOr(answer.expires_in).pipe(
          Option.filter((seconds) => seconds > 0),
          Option.map((seconds) => Duration.seconds(seconds)),
          Option.getOrElse(() => Duration.hours(1))
        )
      )
    ),
    refreshToken,
    renewable: Option.isSome(refreshToken),
    scopes: scopesOf(answer, snapchatScopes),
  };
};

// The account a profile is: its id as Snap spells it, which goes back into
// Snap's paths; its username as the handle, else its name.
const accountOf = (profile: Profile, tokens: IssuedTokens): Authorized => {
  const displayName = nonBlank(profile.display_name);

  return {
    accountId: profile.id,
    avatarUrl: nonBlank(profile.logo_urls?.manage_profile_logo_url).pipe(
      Option.orElse(() => nonBlank(profile.logo_urls?.original_logo_url)),
      Option.flatMap(decodeAvatar)
    ),
    displayName,
    handle: nonBlank(profile.snap_user_name).pipe(
      Option.map((username) => `@${username}`),
      Option.orElse(() => displayName),
      Option.getOrElse(() => "Snapchat profile")
    ),
    tokens,
  };
};

// Nothing a sign-in can connect: the account has no Public Profile Peal
// can post to. `ConnectChannel` ends it as `NoAccountsToConnect`.
const noProfile = (
  status: number,
  envelope: Option.Option<SnapchatEnvelope>
): Effect.Effect<Authorized> =>
  Effect.logWarning("Snap answered no Public Profile for the sign-in").pipe(
    Effect.annotateLogs({
      errorCode: envelope.pipe(
        Option.flatMap(plainErrorCodeOf),
        Option.getOrElse(() => "none")
      ),
      status,
    }),
    Effect.as({ _tag: "choice" as const, accounts: [] })
  );

// An answer nobody understood: the sign-in fails, and never says the
// member has no profile.
const unreadable = (
  status: number
): Effect.Effect<never, AuthorizationFailed> =>
  Effect.logWarning("Snap answered the profile with an unexpected answer").pipe(
    Effect.annotateLogs({ status }),
    Effect.andThen(
      Effect.fail(
        new AuthorizationFailed({
          reason: `Reading the profile answered ${status}`,
        })
      )
    )
  );

// What `my_profile` answered, read from the status first, then from
// whether the body is Snap's envelope (never its messages).
const profileAnswer = (
  response: HttpClientResponse.HttpClientResponse,
  tokens: IssuedTokens
): Effect.Effect<Authorized, AuthorizationFailed | PlatformUnavailable> =>
  Effect.gen(function* reading() {
    const { status } = response;

    if (status >= 500 || status === 429) {
      return yield* new PlatformUnavailable();
    }

    if (status === 401) {
      return yield* new AuthorizationFailed({
        reason: "Snap refused the token it had just issued",
      });
    }

    const envelope = yield* snapchatEnvelopeOf(response);

    if (status === 403) {
      const code = envelope.pipe(Option.flatMap(plainErrorCodeOf));

      yield* Effect.logError(
        "Snap refused Peal's client for the Public Profile API: is SNAPCHAT_CLIENT_ID allowlisted?"
      ).pipe(
        Effect.annotateLogs({
          errorCode: Option.getOrElse(code, () => "none"),
        })
      );

      return yield* new AuthorizationFailed({
        reason: Option.match(code, {
          onNone: () => "not allowlisted",
          onSome: (name) => `not allowlisted (${name})`,
        }),
      });
    }

    if (status === 404) {
      return yield* noProfile(status, envelope);
    }

    if (Option.isNone(envelope)) {
      return yield* unreadable(status);
    }

    if (!succeeded(envelope.value)) {
      return yield* noProfile(status, envelope);
    }

    if (status < 200 || status >= 300) {
      return yield* unreadable(status);
    }

    const answer = yield* HttpClientResponse.schemaBodyJson(
      ProfileAnswerSchema
    )(response).pipe(Effect.catch(() => unreadable(status)));

    if (answer.public_profile === undefined) {
      return yield* noProfile(status, envelope);
    }

    if (!isProfileId(answer.public_profile.id)) {
      return yield* unreadable(status);
    }

    return accountOf(answer.public_profile, tokens);
  });

// A refusal of the refresh nobody can read: the shape of the token
// endpoint's errors is not documented, and a channel must not be lost to
// it, so it is temporary, with its status in the log.
const notUnderstood = (
  status: number
): Effect.Effect<never, PlatformUnavailable> =>
  Effect.logWarning(
    "Snap refused a refresh with an answer Peal cannot read"
  ).pipe(
    Effect.annotateLogs({ status }),
    Effect.andThen(Effect.fail(new PlatformUnavailable()))
  );

/**
 * A Snapchat account's Public Profile, through Snap's OAuth 2 for its
 * Marketing API (developers.snap.com, Public Profile API, Get Started, and
 * Ads API, Authentication, read 2026-11-26): the authorization code flow as
 * a confidential client, whose id and secret go in the token request's
 * form. Snap documents no PKCE for it, so the state, bound to the workspace
 * and the member by ConnectChannel, guards the callback.
 *
 * The app is made in Business Manager (Business Details), and Snap
 * allowlists its client id for the Public Profile API. Until it has, the
 * consent page and the token exchange still work (Peal's own app,
 * 2026-11-26), and `my_profile` answers a 403 with an empty body: the
 * sign-in fails, and the log tells the operator.
 *
 * The profile is the one `my_profile` answers, the signed-in account's own;
 * an account without one connects nothing. Access tokens last an hour and
 * are renewed with the refresh token. Snap documents no revocation, so a
 * disconnected channel's grant stays until its owner removes it.
 */
export const snapchatAuthorizer = Effect.fn("SnapchatAuthorizer.make")(
  function* snapchatAuthorizer(options: {
    readonly client: OAuthClient;
    readonly hosts: SnapchatHosts;
    readonly http: AuthorizerHttp;
    readonly publicUrl: string;
  }) {
    const { client, hosts, http } = options;
    const redirectUri = new URL(snapchatCallbackPath, options.publicUrl).href;
    const tokenUrl = new URL(snapchatTokenPath, hosts.accounts);
    const randomText = yield* randomTexts;

    const clientParams = () => ({
      client_id: client.clientId,
      client_secret: Redacted.value(client.clientSecret),
    });

    const begin: PlatformAuthorizer["begin"] = () =>
      Effect.gen(function* beginning() {
        const state = yield* randomText;
        const url = new URL(snapchatAuthorizePath, hosts.accounts);

        url.search = new URLSearchParams({
          client_id: client.clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: snapchatScopes.join(" "),
          state,
        }).toString();

        return {
          authorizationUrl: url.href,
          instance: Option.none(),
          // Without PKCE, completing the sign-in needs nothing kept.
          secret: Redacted.make(""),
          state,
        };
      });

    const complete: PlatformAuthorizer["complete"] = ({ callback }) =>
      Effect.gen(function* completing() {
        if (Option.isNone(callback.code)) {
          return yield* new AuthorizationFailed({
            reason: "the callback has no code",
          });
        }

        const issuedAt = yield* DateTime.now;

        const token = yield* HttpClientRequest.post(tokenUrl).pipe(
          HttpClientRequest.bodyUrlParams({
            ...clientParams(),
            code: callback.code.value,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
          http.execute,
          Effect.flatMap(bodyOf("The token exchange", TokenAnswerSchema)),
          exchanged
        );

        const tokens = tokensOf(token, issuedAt, Option.none());

        return yield* HttpClientRequest.get(
          new URL("/v1/public_profiles/my_profile", hosts.api)
        ).pipe(
          HttpClientRequest.bearerToken(token.access_token),
          http.execute,
          Effect.flatMap((response) => profileAnswer(response, tokens)),
          exchanged
        );
      });

    const refresh: PlatformAuthorizer["refresh"] = (_channel, stored) =>
      Effect.gen(function* refreshing() {
        if (Option.isNone(stored.refreshToken)) {
          return yield* new TokenExpired();
        }

        const issuedAt = yield* DateTime.now;

        const response = yield* HttpClientRequest.post(tokenUrl).pipe(
          HttpClientRequest.bodyUrlParams({
            ...clientParams(),
            grant_type: "refresh_token",
            refresh_token: Redacted.value(stored.refreshToken.value),
          }),
          http.execute,
          Effect.catchTags({
            HttpClientError: () => Effect.fail(new PlatformUnavailable()),
            OutboundRequestRefused: () =>
              Effect.fail(new PlatformUnavailable()),
          })
        );

        const { status } = response;

        if (status >= 500 || status === 429) {
          return yield* new PlatformUnavailable();
        }

        const error = yield* oauthErrorOf(response).pipe(
          Effect.map(Option.filter((name) => name !== ""))
        );

        if (Option.exists(error, (name) => clientErrors.has(name))) {
          return yield* Effect.logError(
            "Snap refused Peal's client: check SNAPCHAT_CLIENT_ID and SNAPCHAT_CLIENT_SECRET"
          ).pipe(Effect.andThen(Effect.fail(new PlatformUnavailable())));
        }

        // Only Snap's OAuth refusal of the refresh token asks the member
        // to sign in again.
        if ((status === 400 || status === 401) && Option.isSome(error)) {
          return yield* new TokenExpired();
        }

        if (status < 200 || status >= 300 || Option.isSome(error)) {
          return yield* notUnderstood(status);
        }

        // Nothing shows a refresh spends the token sent: an answer that
        // cannot be read leaves the stored tokens as they were.
        const answer = yield* HttpClientResponse.schemaBodyJson(
          TokenAnswerSchema
        )(response).pipe(Effect.catch(() => notUnderstood(status)));

        return tokensOf(answer, issuedAt, stored.refreshToken);
      });

    const authorizer: PlatformAuthorizer = {
      begin,
      complete,
      platform: "snapchat",
      policy: tokenPolicies.snapchat,
      refresh,
    };

    return authorizer;
  }
);
