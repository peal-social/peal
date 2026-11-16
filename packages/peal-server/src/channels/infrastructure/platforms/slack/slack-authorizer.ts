import { Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest } from "effect/http";

import { AuthorizationDenied } from "#channels/application/authorization-denied.ts";
import { AuthorizationFailed } from "#channels/application/authorization-failed.ts";
import type {
  AuthorizedAccount,
  PlatformAuthorizer,
} from "#channels/application/platform-authorizer.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import type { OAuthClient } from "#channels/infrastructure/platforms/oauth-client.ts";
import { randomTexts } from "#channels/infrastructure/platforms/oauth-exchange.ts";
import type { AuthorizerHttp } from "#channels/infrastructure/platforms/oauth-exchange.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  isTransient,
  slackAnswerOf,
  slackMethodUrl,
} from "#shared/infrastructure/platforms/slack-api.ts";
import type { SlackHosts } from "#shared/infrastructure/platforms/slack-api.ts";

/** Where Slack sends members back: the web app's page. */
export const slackCallbackPath = "/connect/slack/callback";

/**
 * What the app asks of a Slack workspace, its bot's scopes: an incoming
 * webhook (`incoming-webhook`), for Slack's own page asks the member which
 * channel it posts to and tells Peal that channel's id and name; posting
 * (`chat:write`), in a public channel the app has not joined too
 * (`chat:write.public`); uploading the images a message shows
 * (`files:write`). None reads a channel, a message or a file.
 */
export const slackScopes: readonly string[] = [
  "incoming-webhook",
  "chat:write",
  "chat:write.public",
  "files:write",
];

// What `oauth.v2.access` answers when it gives a bot token: the token, the
// scopes, the workspace, and the incoming webhook's channel. The webhook's
// own address is in it too, and never read.
const InstallSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
  incoming_webhook: Schema.Struct({
    channel: Schema.String,
    channel_id: Schema.String.check(Schema.isPattern(/^[CDG][A-Z0-9]{2,30}$/u)),
  }),
  ok: Schema.Literal(true),
  scope: Schema.String,
  team: Schema.Struct({
    id: Schema.String.check(Schema.isPattern(/^T[A-Z0-9]{2,30}$/u)),
    name: Schema.String,
  }),
  token_type: Schema.Literal("bot"),
});

const decodeInstall = Schema.decodeUnknownOption(InstallSchema);

// The codes Slack answers for the app's own credentials, which only the
// operator fixes.
const appRefusals: ReadonlySet<string> = new Set([
  "bad_client_secret",
  "invalid_client_id",
]);

// A channel's name as Peal shows it: with its `#`, once.
const handleOf = (name: string) => `#${name.trim().replace(/^#+/u, "")}`;

/**
 * Slack's install, OAuth v2 as "Installing with OAuth" and
 * `oauth.v2.access` give it (docs.slack.dev, read 2026-11-16), with the
 * operator's app: `slack.com/oauth/v2/authorize` with the bot's scopes,
 * comma-separated, then the code exchanged with the app's id and secret
 * as Basic credentials, which Slack "strongly recommend[s]". Slack's page
 * has the member pick the channel the app's incoming webhook posts to
 * (`incoming_webhook.channel_id`): that is the channel connected, so Peal
 * never lists a workspace's channels. The account id is
 * `<team id>/<channel id>`, the handle the channel's name, the display
 * name the workspace's; the token is the bot's.
 *
 * A bot token does not expire while the app's token rotation is off,
 * which Slack cannot turn off again once on: nothing renews it, and one
 * Slack refuses (`invalid_auth`, `token_revoked`, `account_inactive`)
 * marks the channel to reconnect. Nothing revokes it on disconnecting:
 * the one bot token serves every channel of that Slack workspace, in
 * every Peal workspace.
 */
export const slackAuthorizer = Effect.fn("SlackAuthorizer.make")(
  function* slackAuthorizer(options: {
    readonly client: OAuthClient;
    readonly hosts: SlackHosts;
    readonly http: AuthorizerHttp;
    readonly publicUrl: string;
  }) {
    const { client, hosts, http } = options;
    const redirectUri = new URL(slackCallbackPath, options.publicUrl).href;
    const randomText = yield* randomTexts;

    const begin: PlatformAuthorizer["begin"] = () =>
      Effect.gen(function* beginning() {
        const state = yield* randomText;
        const url = new URL("/oauth/v2/authorize", hosts.api);

        url.search = new URLSearchParams({
          client_id: client.clientId,
          redirect_uri: redirectUri,
          scope: slackScopes.join(","),
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

        const answer = yield* http
          .execute(
            HttpClientRequest.post(
              slackMethodUrl(hosts, "oauth.v2.access")
            ).pipe(
              HttpClientRequest.basicAuth(client.clientId, client.clientSecret),
              HttpClientRequest.bodyUrlParams({
                code: callback.code.value,
                redirect_uri: redirectUri,
              })
            )
          )
          .pipe(
            Effect.flatMap(slackAnswerOf),
            Effect.catchTags({
              HttpClientError: () => Effect.fail(new PlatformUnavailable()),
              OutboundRequestRefused: () =>
                Effect.fail(new PlatformUnavailable()),
            })
          );

        if (
          answer._tag === "limited" ||
          answer._tag === "unknown" ||
          (answer._tag === "refused" && isTransient(answer.code))
        ) {
          return yield* new PlatformUnavailable();
        }

        if (answer._tag === "refused") {
          if (appRefusals.has(answer.code)) {
            yield* Effect.logError(
              "Slack refused Peal's app: check SLACK_CLIENT_ID and SLACK_CLIENT_SECRET"
            );
          }

          return yield* new AuthorizationFailed({
            reason: `Slack refused the install (${answer.code})`,
          });
        }

        const install = decodeInstall(answer.body);

        if (Option.isNone(install)) {
          return yield* new AuthorizationFailed({
            reason: "Slack's install gave no bot token and channel",
          });
        }

        const { access_token: token, incoming_webhook: webhook } =
          install.value;

        const scopes = install.value.scope
          .split(",")
          .map((scope) => scope.trim())
          .filter((scope) => scope !== "");

        if (!slackScopes.every((scope) => scopes.includes(scope))) {
          return yield* new AuthorizationDenied();
        }

        const authorized: AuthorizedAccount = {
          accountId: `${install.value.team.id}/${webhook.channel_id}`,
          avatarUrl: Option.none(),
          displayName: Option.some(install.value.team.name.trim()).pipe(
            Option.filter((name) => name !== "")
          ),
          handle: handleOf(webhook.channel),
          tokens: {
            accessToken: Redacted.make(token),
            expiresAt: Option.none(),
            refreshToken: Option.none(),
            renewable: false,
            scopes,
          },
        };

        return authorized;
      });

    const authorizer: PlatformAuthorizer = {
      begin,
      complete,
      platform: "slack",
      policy: tokenPolicies.slack,
      // A bot token is never renewed: a refused one asks the member to
      // connect again.
      refresh: () => Effect.fail(new TokenExpired()),
    };

    return authorizer;
  }
);
